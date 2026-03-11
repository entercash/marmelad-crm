/**
 * AES-256-GCM encryption for sensitive data at rest (e.g. WhitePage passwords).
 *
 * Set the ENCRYPTION_KEY env var to enable encryption.
 * If the key is not set, data is stored and returned as plaintext (backward-compatible).
 *
 * Format: base64( iv[12] + authTag[16] + ciphertext )
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;  // GCM recommended IV size
const TAG_LENGTH = 16; // GCM auth tag

// ─── Key derivation ──────────────────────────────────────────────────────────

function getKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) return null;
  // Derive a 32-byte key from whatever string the user sets
  return crypto.createHash("sha256").update(raw).digest();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a base64-encoded ciphertext (iv + authTag + encrypted data).
 * If ENCRYPTION_KEY is not configured, returns the plaintext as-is.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Pack: iv + tag + ciphertext → base64
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Throws if the key is wrong or the data is tampered with.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  if (!key) return ciphertext;

  const buf = Buffer.from(ciphertext, "base64");
  if (buf.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Ciphertext too short");
  }

  const iv   = buf.subarray(0, IV_LENGTH);
  const tag  = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const data = buf.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Safely decrypts a nullable string.
 * Returns null for null/empty input.
 * Returns the original value if decryption fails (e.g. legacy plaintext data).
 */
export function safeDecrypt(value: string | null): string | null {
  if (!value) return null;

  const key = getKey();
  if (!key) return value; // No encryption configured — return as-is

  try {
    return decrypt(value);
  } catch {
    // Value is likely legacy plaintext — return as-is
    return value;
  }
}

/**
 * Encrypts a nullable string. Returns null for null/empty input.
 */
export function safeEncrypt(value: string | null): string | null {
  if (!value) return null;
  return encrypt(value);
}
