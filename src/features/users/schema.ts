/**
 * Users — Zod validation schemas.
 *
 * Used by server actions (create, update) to validate FormData.
 * Compatible with Zod v4.
 */

import { z } from "zod";

// ─── Role constants ──────────────────────────────────────────────────────────

export const USER_ROLES = ["ADMIN", "BUYER", "ANALYST"] as const;
export type UserRoleValue = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRoleValue, string> = {
  ADMIN:   "Admin",
  BUYER:   "Buyer",
  ANALYST: "Analyst",
};

export const USER_ROLE_DESCRIPTIONS: Record<UserRoleValue, string> = {
  ADMIN:   "Full access, user management",
  BUYER:   "Operational pages, create/edit data",
  ANALYST: "Read-only, dashboard and reports",
};

// ─── Create user schema ─────────────────────────────────────────────────────

export const createUserSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address")
    .transform((v) => v.trim().toLowerCase()),

  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password must be 128 characters or less"),

  name: z
    .string()
    .max(200, "Name must be 200 characters or less")
    .transform((v): string | null => (v.trim() === "" ? null : v.trim())),

  role: z.enum(USER_ROLES, {
    message: "Role is required",
  }),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

// ─── Update user schema (password optional) ──────────────────────────────────

export const updateUserSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address")
    .transform((v) => v.trim().toLowerCase()),

  password: z
    .string()
    .max(128, "Password must be 128 characters or less")
    .transform((v): string | null => (v.trim() === "" ? null : v.trim()))
    .refine((v) => v === null || v.length >= 6, {
      message: "Password must be at least 6 characters",
    }),

  name: z
    .string()
    .max(200, "Name must be 200 characters or less")
    .transform((v): string | null => (v.trim() === "" ? null : v.trim())),

  role: z.enum(USER_ROLES, {
    message: "Role is required",
  }),
});

export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;
