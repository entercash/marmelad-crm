/**
 * Domains — Zod validation schema + UI labels.
 */

import { z } from "zod";

// ─── Status constants ─────────────────────────────────────────────────────────

export const DOMAIN_STATUSES = [
  "UP",
  "DOWN",
  "SSL_ERROR",
  "DNS_ERROR",
  "BANNED",
  "EXPIRED",
  "UNKNOWN",
] as const;

export type DomainStatusValue = (typeof DOMAIN_STATUSES)[number];

export const DOMAIN_STATUS_LABELS: Record<DomainStatusValue, string> = {
  UP:        "Up",
  DOWN:      "Down",
  SSL_ERROR: "SSL Error",
  DNS_ERROR: "DNS Error",
  BANNED:    "Banned",
  EXPIRED:   "Expired",
  UNKNOWN:   "Unknown",
};

export const DOMAIN_STATUS_COLORS: Record<
  DomainStatusValue,
  { dot: string; bg: string; text: string }
> = {
  UP:        { dot: "bg-emerald-400", bg: "bg-emerald-500/15", text: "text-emerald-400" },
  DOWN:      { dot: "bg-red-400",     bg: "bg-red-500/15",     text: "text-red-400" },
  SSL_ERROR: { dot: "bg-amber-400",   bg: "bg-amber-500/15",   text: "text-amber-400" },
  DNS_ERROR: { dot: "bg-orange-400",  bg: "bg-orange-500/15",  text: "text-orange-400" },
  BANNED:    { dot: "bg-red-400",     bg: "bg-red-500/15",     text: "text-red-400" },
  EXPIRED:   { dot: "bg-slate-400",   bg: "bg-slate-500/15",   text: "text-slate-400" },
  UNKNOWN:   { dot: "bg-slate-400",   bg: "bg-slate-500/15",   text: "text-slate-400" },
};

// ─── Zod schema ──────────────────────────────────────────────────────────────

export const domainSchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .max(500, "URL must be 500 characters or less")
    .transform((v) => {
      const trimmed = v.trim();
      // Auto-prepend https:// if no protocol
      if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
      return trimmed;
    })
    .refine(
      (v) => {
        try { new URL(v); return true; } catch { return false; }
      },
      { message: "Invalid URL format" },
    ),

  name: z
    .string()
    .max(200, "Name must be 200 characters or less")
    .transform((v): string | null => (v.trim() === "" ? null : v.trim())),

  notes: z
    .string()
    .max(1000, "Notes must be 1000 characters or less")
    .transform((v): string | null => (v.trim() === "" ? null : v.trim())),
});

export type DomainFormValues = z.infer<typeof domainSchema>;
