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
  id: string;       // UUID
  name: string;
  tags: string[];
}

// ─── Funnel Report ──────────────────────────────────────────────────────────

/** Parsed funnel row (from array-of-arrays response) */
export interface AdspectFunnelRow {
  sub_id: string;        // Taboola site_id (passed via UTM src_id={site_id})
  clicks: number;        // total clicks seen by Adspect
  money_hits: number;    // "good" clicks — real human traffic
  givt: number;          // General Invalid Traffic (IP blacklists, UA, etc.)
  sivt: number;          // Sophisticated Invalid Traffic (fingerprint-based)
  mia: number;           // Missing In Action (no JS fingerprint submitted)
}

/** Parameters for the funnel report API call */
export interface AdspectFunnelParams {
  streamIds: string[];   // Adspect stream UUIDs to filter by
  dateFrom: string;      // YYYY-MM-DD
  dateTo: string;        // YYYY-MM-DD
}
