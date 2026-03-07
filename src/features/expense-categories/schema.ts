/**
 * Expense Categories — Zod validation schema.
 *
 * Used by server actions (create, update) to validate FormData.
 *
 * Compatible with zod v4 API.
 */

import { z } from "zod";

// ─── Predefined colour palette ────────────────────────────────────────────────

/** 12 visually distinct colours the user can pick from. */
export const CATEGORY_COLORS = [
  "#3b82f6", // blue
  "#0ea5e9", // sky
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#10b981", // emerald
  "#14b8a6", // teal
  "#64748b", // slate
] as const;

// ─── Schema ───────────────────────────────────────────────────────────────────

export const expenseCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .transform((v) => v.trim()),

  color: z
    .string()
    .max(20, "Color value too long")
    .transform((v): string | null => (v.trim() === "" ? null : v.trim())),
});

export type ExpenseCategoryFormValues = z.infer<typeof expenseCategorySchema>;
