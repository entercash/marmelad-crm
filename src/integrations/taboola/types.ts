/**
 * Taboola Backstage API — Type Definitions
 *
 * Field names mirror Taboola's snake_case API response conventions exactly.
 * Normalization to our internal domain schema happens in the sync service layer,
 * NOT here — these types are a faithful representation of the external API.
 *
 * Reference: https://developers.taboola.com/backstage-api/reference
 */

// ─── Authentication ──────────────────────────────────────────────────────────

export interface TaboolaTokenResponse {
  access_token: string;
  token_type: string;  // "bearer"
  expires_in: number;  // seconds until expiry
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

export type TaboolaCampaignStatus =
  | "RUNNING"
  | "PAUSED"
  | "STOPPED"
  | "DISABLED"
  | "PENDING_APPROVAL"
  | "REJECTED"
  | "ARCHIVED";

export interface TaboolaCampaign {
  id: string;
  name: string;
  status: TaboolaCampaignStatus;
  advertiser_id: string;       // platform account ID
  daily_cap: number | null;    // daily budget cap (API field name)
  cpc: number | null;          // max cost-per-click bid
  spending_limit: number | null;
  start_date: string | null;   // YYYY-MM-DD
  end_date: string | null;     // YYYY-MM-DD, null = no end date
}

export interface TaboolaCampaignsResponse {
  results: TaboolaCampaign[];
  recordCount: number;
}

// ─── Campaign Items (creatives) ──────────────────────────────────────────────

export type TaboolaCampaignItemStatus =
  | "RUNNING"
  | "PAUSED"
  | "STOPPED"
  | "BLOCKED"   // blocked by Taboola policy
  | "CRAWLING"; // Taboola is fetching the creative

export interface TaboolaCampaignItem {
  id: string;
  campaign_id: string;
  title: string | null;
  url: string | null;
  thumbnail_url: string | null;
  status: TaboolaCampaignItemStatus;
}

export interface TaboolaCampaignItemsResponse {
  results: TaboolaCampaignItem[];
  recordCount: number;
}

// ─── Campaign Stats — daily breakdown ────────────────────────────────────────
// Endpoint: /reports/campaign-summary/dimensions/campaign_day_breakdown

export interface TaboolaCampaignStatRow {
  date: string;          // "YYYY-MM-DD HH:mm:ss.S" (Taboola format)
  campaign: string;      // campaign ID (API field name, not "campaign_id")
  campaign_name: string;
  spent: number;         // total spend in account currency
  clicks: number;
  impressions: number;
  cpc: number | null;    // actual average CPC for this day
  cpm: number | null;    // cost per 1000 impressions
  ctr: number | null;    // click-through rate as decimal (0.01 = 1%)
  currency: string;      // e.g. "USD"
}

export interface TaboolaCampaignStatsResponse {
  results: TaboolaCampaignStatRow[];
  recordCount: number;
}

// ─── Item Stats — item_day_breakdown ─────────────────────────────────────────
// Endpoint: /reports/campaign-summary/dimensions/item_day_breakdown

export interface TaboolaItemStatRow {
  date: string;           // YYYY-MM-DD
  campaign_id: string;
  item_id: string;
  title: string | null;
  url: string | null;
  thumbnail_url: string | null;
  spent: number;
  clicks: number;
  impressions: number;
  cpc: number | null;
  ctr: number | null;
  currency: string;
}

export interface TaboolaItemStatsResponse {
  results: TaboolaItemStatRow[];
  recordCount: number;
}

// ─── Publisher Stats — campaign_site_day_breakdown ───────────────────────────
// Endpoint: /reports/top-campaign-content/dimensions/campaign_site_day_breakdown
// This is the most important table for publisher quality analysis.

export interface TaboolaPublisherStatRow {
  date: string;        // YYYY-MM-DD
  campaign_id: string;
  site: string;        // publisher/site ID (used as externalId)
  site_name: string;   // human-readable publisher name
  country: string;     // ISO 3166-1 alpha-2, or "" if unknown
  spent: number;
  clicks: number;
  impressions: number;
  cpc: number | null;
  ctr: number | null;
  currency: string;
}

export interface TaboolaPublisherStatsResponse {
  results: TaboolaPublisherStatRow[];
  recordCount: number;
}

// ─── Shared param types ──────────────────────────────────────────────────────

export interface TaboolaDateRangeParams {
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
}
