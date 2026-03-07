/**
 * White Pages — Zod validation schema + status metadata.
 *
 * Used by server actions (create, update) to validate FormData.
 *
 * Approach for optional fields:
 *  - Optional text: empty string → null, non-empty string → trimmed string
 *
 * Status labels are kept here (alongside the enum values) so both the form
 * and the table can import from a single source of truth.
 *
 * Compatible with zod v3 and v4.
 */

import { z } from "zod";

// ─── Status constants ──────────────────────────────────────────────────────────

export const WHITE_PAGE_STATUSES = [
  "PREMODERATION",
  "ACCOUNT_ISSUED",
  "WARMUP_STARTED",
  "IN_PROGRESS",
  "PREMODERATION_FAILED",
  "ACCOUNT_BANNED",
] as const;

export type WhitePageStatusValue = (typeof WHITE_PAGE_STATUSES)[number];

/** Human-readable Russian labels displayed in the UI. */
export const WHITE_PAGE_STATUS_LABELS: Record<WhitePageStatusValue, string> = {
  PREMODERATION:        "Премодерация",
  ACCOUNT_ISSUED:       "Выдали аккаунт",
  WARMUP_STARTED:       "Запуск прогрева",
  IN_PROGRESS:          "В работе",
  PREMODERATION_FAILED: "Не прошли премодерацию",
  ACCOUNT_BANNED:       "Бан аккаунта",
};

/** Tailwind classes for the status badge rendered in the table. */
export const WHITE_PAGE_STATUS_BADGE_CLASS: Record<WhitePageStatusValue, string> = {
  PREMODERATION:        "bg-slate-100 text-slate-600",
  ACCOUNT_ISSUED:       "bg-blue-100  text-blue-700",
  WARMUP_STARTED:       "bg-amber-100 text-amber-700",
  IN_PROGRESS:          "bg-green-100 text-green-700",
  PREMODERATION_FAILED: "bg-red-100   text-red-700",
  ACCOUNT_BANNED:       "bg-red-200   text-red-800",
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

export const whitePageSchema = z.object({
  // Required fields
  transferDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Transfer date is required"),

  geo: z
    .string()
    .min(1, "GEO is required")
    .max(10, "GEO must be 10 characters or less")
    .transform((v) => v.trim().toUpperCase()),

  url: z
    .string()
    .min(1, "URL is required")
    .max(2_000, "URL must be 2000 characters or less")
    .transform((v) => v.trim()),

  status: z.enum(WHITE_PAGE_STATUSES, {
    errorMap: () => ({ message: "Status is required" }),
  }),

  // Optional fields — empty string → null
  topic:           optionalText(300,   "Topic"),
  zohoEmail:       optionalText(300,   "Zoho email"),
  password:        optionalText(200,   "Password"),
  legalEntityData: optionalText(5_000, "Legal entity data"),
  taxNumber:       optionalText(100,   "Tax number"),
});

export type WhitePageFormValues = z.infer<typeof whitePageSchema>;
