/**
 * Taboola Integration — Placeholder
 *
 * This module will implement the Taboola Backstage API connector.
 *
 * Planned capabilities (Phase 2):
 *  - OAuth2 client credentials authentication
 *  - Campaign list and performance stats sync
 *  - Publisher / site performance by date range and GEO
 *  - Publisher blocklist management (update via API)
 *  - Spend reporting per campaign and ad account
 *
 * API reference: https://developers.taboola.com/backstage-api/reference
 */

export interface TaboolaConfig {
  clientId: string;
  clientSecret: string;
  accountId: string;
}

export interface TaboolaDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

// ─────────────────────────────────────────────
// CLIENT
// ─────────────────────────────────────────────

export class TaboolaClient {
  private config: TaboolaConfig;

  constructor(config: TaboolaConfig) {
    this.config = config;
  }

  // TODO Phase 2 — implement these methods:
  // async authenticate(): Promise<string>
  // async getCampaigns(): Promise<TaboolaCampaign[]>
  // async getCampaignStats(dateRange: TaboolaDateRange): Promise<TaboolaCampaignStat[]>
  // async getPublisherStats(dateRange: TaboolaDateRange): Promise<TaboolaPublisherStat[]>
  // async updateBlocklist(siteIds: string[]): Promise<void>
}

// ─────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────

export function createTaboolaClient(): TaboolaClient {
  return new TaboolaClient({
    clientId: process.env.TABOOLA_CLIENT_ID ?? "",
    clientSecret: process.env.TABOOLA_CLIENT_SECRET ?? "",
    accountId: process.env.TABOOLA_ACCOUNT_ID ?? "",
  });
}
