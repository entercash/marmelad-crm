/**
 * Display formatting helpers for Marmelad CRM.
 *
 * These are pure presentation utilities — no DB access, no side effects.
 * Numerical formatting (currency, percent, compact) lives in lib/utils.ts.
 * This file handles dates, enums → labels, and badge variants.
 */

// ─── Date / time ──────────────────────────────────────────────────────────────

/**
 * Formats a date as "MMM D, YYYY" (e.g. "Jan 7, 2026").
 * Returns "—" for null/undefined.
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

/**
 * Formats a date as "MMM D, YYYY HH:MM" (e.g. "Jan 7, 2026 14:30").
 * Returns "—" for null/undefined.
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Formats a date as a human-readable relative time string.
 * e.g. "2 hours ago", "3 days ago", "just now"
 * Falls back to formatDate when the interval is more than 30 days.
 * Returns "—" for null/undefined.
 */
export function formatRelativeTime(
  date: Date | string | null | undefined,
): string {
  if (!date) return "—";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60)
    return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  if (diffHour < 24)
    return `${diffHour} hour${diffHour !== 1 ? "s" : ""} ago`;
  if (diffDay < 30)
    return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;

  return formatDate(d);
}

// ─── Campaign status ───────────────────────────────────────────────────────────

export function campaignStatusLabel(status: string): string {
  const map: Record<string, string> = {
    ACTIVE:   "Active",
    PAUSED:   "Paused",
    STOPPED:  "Stopped",
    ARCHIVED: "Archived",
  };
  return map[status] ?? status;
}

export function campaignStatusVariant(
  status: string,
): "success" | "warning" | "destructive" | "outline" {
  switch (status) {
    case "ACTIVE":   return "success";
    case "PAUSED":   return "warning";
    case "STOPPED":  return "destructive";
    case "ARCHIVED": return "outline";
    default:         return "outline";
  }
}

// ─── Sync status ───────────────────────────────────────────────────────────────

export function syncStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: "Pending",
    RUNNING: "Running",
    SUCCESS: "Success",
    PARTIAL: "Partial",
    FAILED:  "Failed",
  };
  return map[status] ?? status;
}

export function syncStatusVariant(
  status: string,
): "success" | "warning" | "destructive" | "secondary" | "outline" {
  switch (status) {
    case "SUCCESS": return "success";
    case "PARTIAL": return "warning";
    case "FAILED":  return "destructive";
    case "RUNNING": return "secondary";
    case "PENDING": return "outline";
    default:        return "outline";
  }
}

// ─── Publisher list type ───────────────────────────────────────────────────────

export function listTypeLabel(type: string): string {
  const map: Record<string, string> = {
    BLACKLIST: "Blacklisted",
    WHITELIST: "Whitelisted",
  };
  return map[type] ?? type;
}

export function listTypeVariant(
  type: string,
): "destructive" | "success" | "outline" {
  switch (type) {
    case "BLACKLIST": return "destructive";
    case "WHITELIST": return "success";
    default:          return "outline";
  }
}
