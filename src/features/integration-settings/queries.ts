import { prisma } from "@/lib/prisma";
import { encrypt, safeDecrypt } from "@/lib/crypto";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Keys that contain sensitive data and should be encrypted. */
const SENSITIVE_KEYS = new Set(["keitaro.apiKey"]);

// ─── CRUD ───────────────────────────────────────────────────────────────────

/** Get a single setting value (decrypted). Returns null if not found. */
export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.integrationSetting.findUnique({ where: { key } });
  if (!row) return null;
  return SENSITIVE_KEYS.has(key) ? safeDecrypt(row.value) : row.value;
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
    const val = SENSITIVE_KEYS.has(row.key) ? safeDecrypt(row.value) : row.value;
    result[row.key] = val ?? row.value;
  }
  return result;
}

/** Upsert a setting. Encrypts the value if the key is sensitive. */
export async function setSetting(key: string, value: string): Promise<void> {
  const storedValue = SENSITIVE_KEYS.has(key) ? encrypt(value) : value;
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
