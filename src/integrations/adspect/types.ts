/**
 * Adspect REST API — Type Definitions
 *
 * Adspect is a cloaking & traffic filtering service.
 * The API uses HTTP Basic auth (API key as username, empty password).
 *
 * Reference: https://docs.adspect.ai/en/latest/api.html
 *
 * Important: The /reports/funnel endpoint returns array-of-arrays, NOT
 * array-of-objects. The column order matches group_by[] then metrics[].
 */

// ─── Streams ────────────────────────────────────────────────────────────────

/** A single stream from GET /streams */
export interface AdspectStream {
  stream_id: string;  // UUID (API returns "stream_id", not "id")
  name: string;
}

// ─── Funnel Report ──────────────────────────────────────────────────────────

/** Parsed funnel row (from array-of-arrays response) */
export interface AdspectFunnelRow {
  sub_id: string;        // Taboola site_id (passed via UTM src_id={site_id})
  clicks: number;        // total clicks seen by Adspect
  money_hits: number;    // "good" clicks — real human traffic (passed filter)
  quality: number;       // money_hits / clicks * 100 (% of good traffic)
}

/** Parameters for the funnel report API call */
export interface AdspectFunnelParams {
  streamIds: string[];   // Adspect stream UUIDs to filter by
  dateFrom: string;      // YYYY-MM-DD
  dateTo: string;        // YYYY-MM-DD
}

// ─── Daily Funnel Report ───────────────────────────────────────────────────

/** Parsed daily funnel row (grouped by date + sub_id) */
export interface AdspectDailyFunnelRow {
  date: string;          // YYYY-MM-DD
  sub_id: string;        // Taboola site_id
  clicks: number;
  money_hits: number;
  quality: number;       // 0-1 ratio
}
