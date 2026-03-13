import { prisma } from "@/lib/prisma";
import { encrypt, safeDecrypt } from "@/lib/crypto";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Check if a key holds sensitive data and should be encrypted at rest. */
function isSensitiveKey(key: string): boolean {
  if (key === "keitaro.apiKey") return true;
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

/**
 * Load Keitaro config from DB, falling back to env vars.
 * Returns null fields if nothing is configured.
 */
export async function getKeitaroSettings(): Promise<KeitaroSettingsData> {
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
