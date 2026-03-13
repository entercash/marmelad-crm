/**
 * Date utilities for the data ingestion pipeline.
 *
 * Convention:
 *  - API requests use YYYY-MM-DD strings (toApiDate / fromApiDate)
 *  - Database stores UTC midnight Date objects
 *  - CRM operates in Europe/Moscow (GMT+3) for "today" boundaries
 */

// ─── CRM Timezone ────────────────────────────────────────────────────────────

/** IANA timezone for CRM date calculations (affects "today" boundary). */
export const CRM_TIMEZONE = "Europe/Moscow";

/** UTC offset in hours for CRM timezone. Used for quick date math. */
export const CRM_UTC_OFFSET = 3;

/** Common timezones for account dropdown. */
export const COMMON_TIMEZONES = [
  { value: "US/Eastern",      label: "US/Eastern (GMT-5)" },
  { value: "US/Central",      label: "US/Central (GMT-6)" },
  { value: "US/Mountain",     label: "US/Mountain (GMT-7)" },
  { value: "US/Pacific",      label: "US/Pacific (GMT-8)" },
  { value: "Europe/London",   label: "Europe/London (GMT+0)" },
  { value: "Europe/Berlin",   label: "Europe/Berlin (GMT+1)" },
  { value: "Europe/Moscow",   label: "Europe/Moscow (GMT+3)" },
  { value: "Asia/Dubai",      label: "Asia/Dubai (GMT+4)" },
  { value: "Asia/Kolkata",    label: "Asia/Kolkata (GMT+5:30)" },
  { value: "Asia/Bangkok",    label: "Asia/Bangkok (GMT+7)" },
  { value: "Asia/Shanghai",   label: "Asia/Shanghai (GMT+8)" },
  { value: "Asia/Tokyo",      label: "Asia/Tokyo (GMT+9)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (GMT+11)" },
  { value: "UTC",             label: "UTC (GMT+0)" },
] as const;

/** Format a Date to YYYY-MM-DD for use in API query params */
export function toApiDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parse a YYYY-MM-DD string to a UTC-midnight Date for DB storage */
export function fromApiDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Return yesterday's date at UTC midnight */
export function yesterday(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Return today's date at UTC midnight */
export function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Return today's YYYY-MM-DD in CRM timezone (Europe/Moscow, GMT+3). */
export function todayCrm(): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + CRM_UTC_OFFSET * 3_600_000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Generate an array of YYYY-MM-DD strings for a date range (both ends inclusive).
 * Useful for iterating over multi-day ranges in small API windows.
 */
export function expandDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (cursor <= end) {
    dates.push(toApiDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** Return true if str is a valid YYYY-MM-DD date */
export function isValidDateStr(str: unknown): str is string {
  if (typeof str !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str));
}

/**
 * Clamp a date range to at most maxDays.
 * Used to break large syncs into API-safe windows.
 */
export function clampDateRange(
  startDate: string,
  endDate: string,
  maxDays = 30,
): { startDate: string; endDate: string } {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);

  if (diffDays <= maxDays) return { startDate, endDate };

  const clampedEnd = new Date(start);
  clampedEnd.setUTCDate(clampedEnd.getUTCDate() + maxDays - 1);
  return { startDate, endDate: toApiDate(clampedEnd) };
}
