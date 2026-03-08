/**
 * Expenses — Zod validation schema.
 *
 * Used by server actions (create, update) to validate FormData.
 *
 * Approach for optional fields:
 *  - Optional text: empty string -> null, non-empty string -> trimmed string
 *
 * Compatible with zod v4 API.
 */

import { z } from "zod";

// ─── Recurrence constants ────────────────────────────────────────────────────

export const EXPENSE_RECURRENCES = [
  "ONE_TIME",
  "WEEKLY",
  "MONTHLY",
  "ANNUAL",
] as const;

export type ExpenseRecurrenceValue = (typeof EXPENSE_RECURRENCES)[number];

export const EXPENSE_RECURRENCE_LABELS: Record<ExpenseRecurrenceValue, string> = {
  ONE_TIME: "One-time",
  WEEKLY:   "Weekly",
  MONTHLY:  "Monthly",
  ANNUAL:   "Annual",
};

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

// ─── Schema ───────────────────────────────────────────────────────────────────

export const expenseSchema = z.object({
  // Required fields
  spendDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Spend date is required"),

  categoryId: z
    .string()
    .min(1, "Category is required"),

  name: z
    .string()
    .min(1, "Title / description is required")
    .max(500, "Title must be 500 characters or less")
    .transform((v) => v.trim()),

  amount: z
    .string()
    .min(1, "Amount is required")
    .transform((v) => {
      const trimmed = v.trim();
      const num = Number(trimmed);
      if (Number.isNaN(num)) return -1; // will fail .positive() check
      return num;
    })
    .refine((n) => n > 0, { message: "Amount must be greater than 0" })
    .refine((n) => n <= 999_999_999.99, { message: "Amount is too large" }),

  recurrence: z.enum(EXPENSE_RECURRENCES, {
    message: "Recurrence is required",
  }),

  // Optional fields — empty string -> null
  vendor:   optionalText(300, "Vendor"),
  source:   optionalText(300, "Source"),
  campaign: optionalText(300, "Campaign"),
  notes:    optionalText(5_000, "Notes"),
  comment:  optionalText(5_000, "Comment"),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;
