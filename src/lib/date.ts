/**
 * Date utilities for the data ingestion pipeline.
 *
 * Convention:
 *  - API requests use YYYY-MM-DD strings (toApiDate / fromApiDate)
 *  - Database stores UTC midnight Date objects
 *  - All operations are UTC — never use local time
 */

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
