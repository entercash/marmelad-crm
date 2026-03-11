/**
 * Account Top-Ups — Zod validation schema.
 *
 * Used by server actions (create, update) to validate FormData.
 * Amount is always in USD.
 */

import { z } from "zod";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function optionalText(maxLen: number, label: string) {
  return z
    .string()
    .max(maxLen, `${label} must be ${maxLen} characters or less`)
    .transform((v): string | null => (v.trim() === "" ? null : v.trim()));
}

// ─── Schema ───────────────────────────────────────────────────────────────────

export const topUpSchema = z.object({
  accountId: z
    .string()
    .min(1, "Account is required"),

  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),

  amount: z
    .string()
    .min(1, "Amount is required")
    .transform((v) => {
      const trimmed = v.trim();
      const num = Number(trimmed);
      if (Number.isNaN(num)) return -1;
      return num;
    })
    .refine((n) => n > 0, { message: "Amount must be greater than 0" })
    .refine((n) => n <= 999_999_999.99, { message: "Amount is too large" }),

  note: optionalText(1_000, "Note"),
});

export type TopUpFormValues = z.infer<typeof topUpSchema>;
