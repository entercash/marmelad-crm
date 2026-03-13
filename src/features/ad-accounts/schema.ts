/**
 * Accounts — Zod validation schema.
 *
 * Used by server actions (create, update) to validate FormData.
 */

import { z } from "zod";

// ─── Status constants ─────────────────────────────────────────────────────────

export const ACCOUNT_STATUSES = [
  "EMPTY",
  "UNDER_MODERATION",
  "ACTIVE",
  "BANNED",
] as const;

export type AccountStatusValue = (typeof ACCOUNT_STATUSES)[number];

export const ACCOUNT_STATUS_LABELS: Record<AccountStatusValue, string> = {
  EMPTY:            "Empty",
  UNDER_MODERATION: "Under Moderation",
  ACTIVE:           "Active",
  BANNED:           "Banned",
};

// ─── Platform constants ───────────────────────────────────────────────────────

export const ACCOUNT_PLATFORMS = [
  "TABOOLA",
  "FACEBOOK",
  "GOOGLE",
  "TIKTOK",
  "OTHER",
] as const;

export type AccountPlatformValue = (typeof ACCOUNT_PLATFORMS)[number];

export const ACCOUNT_PLATFORM_LABELS: Record<AccountPlatformValue, string> = {
  TABOOLA:  "Taboola",
  FACEBOOK: "Facebook",
  GOOGLE:   "Google",
  TIKTOK:   "TikTok",
  OTHER:    "Other",
};

// ─── Account Type constants ───────────────────────────────────────────────────

export const ACCOUNT_TYPES = [
  "AGENCY",
  "AGENCY_FARM",
  "FARM",
] as const;

export type AccountTypeValue = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountTypeValue, string> = {
  AGENCY:       "Agency",
  AGENCY_FARM:  "Agency Farm",
  FARM:         "Farm",
};

// ─── Currency constants ───────────────────────────────────────────────────────

export const CURRENCIES = [
  "USD", "EUR", "GBP", "ILS", "JPY", "CAD", "AUD", "CHF", "CNY", "BRL", "HKD",
] as const;

export type CurrencyValue = (typeof CURRENCIES)[number];

export const CURRENCY_LABELS: Record<CurrencyValue, string> = {
  USD: "USD ($)",
  EUR: "EUR (\u20AC)",
  GBP: "GBP (\u00A3)",
  ILS: "ILS (\u20AA)",
  JPY: "JPY (\u00A5)",
  CAD: "CAD (C$)",
  AUD: "AUD (A$)",
  CHF: "CHF (Fr)",
  CNY: "CNY (\u00A5)",
  BRL: "BRL (R$)",
  HKD: "HKD (HK$)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function optionalText(maxLen: number, label: string) {
  return z
    .string()
    .max(maxLen, `${label} must be ${maxLen} characters or less`)
    .transform((v): string | null => (v.trim() === "" ? null : v.trim()));
}

// ─── Schema ───────────────────────────────────────────────────────────────────

export const accountSchema = z.object({
  name: z
    .string()
    .min(1, "Account name is required")
    .max(200, "Name must be 200 characters or less")
    .transform((v) => v.trim()),

  externalId: optionalText(200, "External ID"),

  agencyId: z
    .string()
    .transform((v): string | null => (v.trim() === "" ? null : v.trim())),

  platform: z.enum(ACCOUNT_PLATFORMS, {
    message: "Platform is required",
  }),

  accountType: z.enum(ACCOUNT_TYPES, {
    message: "Account type is required",
  }),

  status: z.enum(ACCOUNT_STATUSES, {
    message: "Status is required",
  }),

  currency: z
    .string()
    .min(1, "Currency is required")
    .max(10)
    .default("USD"),

  accountCountry: optionalText(100, "Account Country"),
  trafficCountry: optionalText(100, "Traffic Country"),
  timezone: optionalText(50, "Timezone"),
});

export type AccountFormValues = z.infer<typeof accountSchema>;
