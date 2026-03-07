/**
 * Agencies — Zod validation schema.
 *
 * Used by server actions (create, update) to validate FormData.
 *
 * Approach for optional fields:
 *  - Optional text:    empty string → null, non-empty string → trimmed string
 *  - Optional decimal: empty string → null, numeric string → parsed number (validated in range)
 *
 * Compatible with zod v3 and v4.
 */

import { z } from "zod";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Accepts any string up to `maxLen` chars. Trims and converts "" to null.
 * Returns `string | null`.
 */
function optionalText(maxLen: number, label: string) {
  return z
    .string()
    .max(maxLen, `${label} must be ${maxLen} characters or less`)
    .transform((v): string | null => (v.trim() === "" ? null : v.trim()));
}

/**
 * Accepts an empty string (→ null) or a numeric string in [0, max].
 * Returns `number | null`.
 */
function optionalDecimal(max: number, label: string) {
  return z
    .union([
      // Empty field → treat as "not provided"
      z.literal(""),
      // Non-empty: must be a valid number in range
      z
        .string()
        .refine((v) => !isNaN(parseFloat(v)) && isFinite(Number(v)), {
          message: `${label} must be a number`,
        })
        .refine((v) => parseFloat(v) >= 0, {
          message: `${label} cannot be negative`,
        })
        .refine((v) => parseFloat(v) <= max, {
          message: `${label} must be ${max} or less`,
        }),
    ])
    .transform((v): number | null => (v === "" ? null : parseFloat(v)));
}

// ─── Schema ───────────────────────────────────────────────────────────────────

export const agencySchema = z.object({
  name: z
    .string()
    .min(1, "Agency name is required")
    .max(200, "Name must be 200 characters or less")
    .transform((v) => v.trim()),

  website:              optionalText(500,       "Website"),
  contact:              optionalText(300,       "Contact"),
  notes:                optionalText(5_000,     "Notes"),

  accountCostUsd:       optionalDecimal(9_999_999, "Account cost"),
  commissionPercent:    optionalDecimal(100,        "Commission"),
  cryptoPaymentPercent: optionalDecimal(100,        "Crypto payment"),
});

export type AgencyFormValues = z.infer<typeof agencySchema>;
