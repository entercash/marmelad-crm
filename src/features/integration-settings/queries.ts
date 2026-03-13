import { prisma } from "@/lib/prisma";
import { encrypt, safeDecrypt } from "@/lib/crypto";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Check if a key holds sensitive data and should be encrypted at rest. */
function isSensitiveKey(key: string): boolean {
  if (key === "keitaro.apiKey") return true;
  // keitaro.{instanceId}.apiKey
  if (/^keitaro\..+\.apiKey$/.test(key)) return true;
  // taboola.{accountId}.clientId / clientSecret
  if (/^taboola\..+\.(clientId|clientSecret)$/.test(key)) return true;
  return false;
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

/** Get a single setting value (decrypted). Returns null if not found. */
export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.integrationSetting.findUnique({ where: { key } });
  if (!row) return null;
  return isSensitiveKey(key) ? safeDecrypt(row.value) : row.value;
}

/** Get all settings matching a prefix (e.g. "keitaro."). Values decrypted. */
export async function getSettings(
  prefix: string,
): Promise<Record<string, string>> {
  const rows = await prisma.integrationSetting.findMany({
    where: { key: { startsWith: prefix } },
  });

  const result: Record<string, string> = {};
  for (const row of rows) {
    const val = isSensitiveKey(row.key) ? safeDecrypt(row.value) : row.value;
    result[row.key] = val ?? row.value;
  }
  return result;
}

/** Upsert a setting. Encrypts the value if the key is sensitive. */
export async function setSetting(key: string, value: string): Promise<void> {
  const storedValue = isSensitiveKey(key) ? encrypt(value) : value;
  await prisma.integrationSetting.upsert({
    where: { key },
    create: { key, value: storedValue },
    update: { value: storedValue },
  });
}

// ─── Keitaro-specific helpers ───────────────────────────────────────────────

export interface KeitaroSettingsData {
  apiUrl: string | null;
  apiKey: string | null;
}

export interface KeitaroInstanceData {
  id: string;
  name: string;
  apiUrl: string | null;
  apiKey: string | null;
}

/**
 * Get all Keitaro instances stored in the new multi-instance format.
 * Keys: keitaro.{instanceId}.name / apiUrl / apiKey
 */
export async function getKeitaroInstances(): Promise<KeitaroInstanceData[]> {
  const rows = await prisma.integrationSetting.findMany({
    where: { key: { startsWith: "keitaro." } },
  });

  // Group by instanceId (keys with 3 segments: keitaro.{id}.{field})
  const instanceMap = new Map<string, Record<string, string>>();
  for (const row of rows) {
    const parts = row.key.split(".");
    if (parts.length !== 3) continue; // skip legacy keys like "keitaro.apiUrl"
    const [, instanceId, field] = parts;
    const data = instanceMap.get(instanceId) ?? {};
    data[field] = isSensitiveKey(row.key) ? (safeDecrypt(row.value) ?? row.value) : row.value;
    instanceMap.set(instanceId, data);
  }

  const instances: KeitaroInstanceData[] = [];
  instanceMap.forEach((data, id) => {
    instances.push({
      id,
      name: data.name || "",
      apiUrl: data.apiUrl || null,
      apiKey: data.apiKey || null,
    });
  });
  return instances;
}

/** Load a single Keitaro instance's settings. */
export async function getKeitaroInstanceSettings(
  instanceId: string,
): Promise<KeitaroInstanceData> {
  const prefix = `keitaro.${instanceId}.`;
  const settings = await getSettings(prefix);
  return {
    id: instanceId,
    name: settings[`${prefix}name`] || "",
    apiUrl: settings[`${prefix}apiUrl`] || null,
    apiKey: settings[`${prefix}apiKey`] || null,
  };
}

/**
 * Load Keitaro config from DB, falling back to env vars.
 * Backward-compatible: tries new multi-instance format first, then legacy keys.
 */
export async function getKeitaroSettings(): Promise<KeitaroSettingsData> {
  // Try new multi-instance format first
  const instances = await getKeitaroInstances();
  if (instances.length > 0 && instances[0].apiUrl && instances[0].apiKey) {
    return { apiUrl: instances[0].apiUrl, apiKey: instances[0].apiKey };
  }

  // Fallback: legacy single-instance keys
  const settings = await getSettings("keitaro.");
  return {
    apiUrl: settings["keitaro.apiUrl"] || process.env.KEITARO_API_URL || null,
    apiKey: settings["keitaro.apiKey"] || process.env.KEITARO_API_KEY || null,
  };
}

/** Check if Keitaro is configured (both URL and key present). */
export async function isKeitaroConfigured(): Promise<boolean> {
  const { apiUrl, apiKey } = await getKeitaroSettings();
  return !!(apiUrl && apiKey);
}

// ─── Taboola-specific helpers ────────────────────────────────────────────────

export interface TaboolaAccountSettingsData {
  clientId: string | null;
  clientSecret: string | null;
  proxyUrl: string | null;
}

/** Load Taboola API credentials for a specific account. */
export async function getTaboolaAccountSettings(
  accountId: string,
): Promise<TaboolaAccountSettingsData> {
  const prefix = `taboola.${accountId}.`;
  const settings = await getSettings(prefix);

  return {
    clientId: settings[`${prefix}clientId`] || null,
    clientSecret: settings[`${prefix}clientSecret`] || null,
    proxyUrl: settings[`${prefix}proxyUrl`] || null,
  };
}

/** Get the set of accountIds that have Taboola credentials saved. */
export async function getTaboolaConnectedAccountIds(): Promise<Set<string>> {
  const rows = await prisma.integrationSetting.findMany({
    where: { key: { startsWith: "taboola." } },
    select: { key: true },
  });

  // Collect accountIds that have both clientId AND clientSecret
  const hasClientId = new Set<string>();
  const hasClientSecret = new Set<string>();

  for (const row of rows) {
    const match = row.key.match(/^taboola\.(.+)\.(clientId|clientSecret)$/);
    if (!match) continue;
    const [, accountId, field] = match;
    if (field === "clientId") hasClientId.add(accountId);
    if (field === "clientSecret") hasClientSecret.add(accountId);
  }

  const connected = new Set<string>();
  Array.from(hasClientId).forEach((id) => {
    if (hasClientSecret.has(id)) connected.add(id);
  });
  return connected;
}
