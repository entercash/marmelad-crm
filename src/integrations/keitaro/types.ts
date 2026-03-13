/**
 * Keitaro Admin API — Type Definitions
 *
 * Field names mirror Keitaro's API response conventions.
 * Keitaro's report API uses a POST-based query builder with flexible grouping.
 *
 * Reference: https://keitaro.io/en/docs/
 *
 * Notes on revenue types:
 *  - Keitaro versions differ on whether revenue is returned as string or number.
 *    Both cases are handled in normalization.
 *  - "leads" = total conversions received (pending + approved + rejected)
 *  - "sales" = approved conversions only
 *  - Revenue typically corresponds to approved conversions only.
 */

// ─── Report API ──────────────────────────────────────────────────────────────

/** Grouping dimensions available in the Keitaro report builder */
export type KeitaroGroupingField =
  | "campaign_id"
  | "campaign_name"
  | "offer_id"
  | "country"
  | "day"
  | "sub_id"
  | "sub_id_1"
  | "sub_id_2";

/** Metric columns available in the Keitaro report builder */
export type KeitaroMetric =
  | "clicks"
  | "conversions"  // all conversions (any status)
  | "leads"        // conversions with "lead" status
  | "sales"        // approved conversions
  | "rejected"     // rejected conversions
  | "revenue"      // revenue from approved conversions
  | "cost"         // traffic cost (if tracked)
  | "profit"       // revenue - cost
  | "roi";

export interface KeitaroDateRange {
  from: string;        // YYYY-MM-DD
  to: string;          // YYYY-MM-DD
  timezone: string;    // e.g. "UTC"
}

export interface KeitaroReportRequest {
  range: KeitaroDateRange;
  grouping: KeitaroGroupingField[];
  metrics: KeitaroMetric[];
  filters?: KeitaroFilter[];
  limit?: number;
  offset?: number;
}

export interface KeitaroFilter {
  name: string;
  operator: "EQUALS" | "NOT_EQUAL" | "CONTAINS" | "NOT_CONTAIN" | "IN_LIST" | "NOT_IN_LIST" | "BETWEEN" | "GREATER_THAN" | "LESS_THAN";
  values: string[];
}

// ─── Report Response ─────────────────────────────────────────────────────────

/**
 * A single row from a Keitaro report.
 * Fields present depend on the requested grouping and metrics.
 * All numeric fields may be returned as strings in some Keitaro versions.
 */
export interface KeitaroReportRow {
  campaign_id?: string;
  campaign_name?: string;
  country?: string;        // ISO 3166-1 alpha-2, or "" for unknown
  day?: string;            // YYYY-MM-DD (when "day" is in grouping)

  // Sub-ID tracking parameters (when in grouping)
  sub_id?: string;
  sub_id_1?: string;
  sub_id_2?: string;

  // Metrics — may be string | number depending on Keitaro version
  clicks?: number | string;
  conversions?: number | string; // all conversions (any status)
  leads?: number | string;       // conversions with "lead" status
  sales?: number | string;       // approved conversions
  rejected?: number | string; // rejected conversions
  revenue?: number | string;  // revenue from approved leads (net)
  cost?: number | string;
  profit?: number | string;
}

export interface KeitaroReportResponse {
  rows: KeitaroReportRow[];
  total?: Partial<KeitaroReportRow>; // aggregate totals row
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

export interface KeitaroCampaign {
  id: number;                                // Keitaro campaign ID (integer)
  name: string;
  alias: string;
  state: "active" | "disabled" | "deleted";
  group_id?: number | null;
}
