/**
 * Keitaro Integration — Placeholder
 *
 * This module will implement the Keitaro tracker API connector.
 *
 * Planned capabilities (Phase 2):
 *  - Campaign and offer data sync
 *  - Conversion and revenue reporting by campaign, publisher, and GEO
 *  - Click and lead tracking data pull
 *  - Custom date range queries
 *
 * API reference: https://keitaro.io/en/docs/
 */

export interface KeitaroConfig {
  apiUrl: string;
  apiKey: string;
}

export interface KeitaroDateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

// ─────────────────────────────────────────────
// CLIENT
// ─────────────────────────────────────────────

export class KeitaroClient {
  private config: KeitaroConfig;

  constructor(config: KeitaroConfig) {
    this.config = config;
  }

  // TODO Phase 2 — implement these methods:
  // async getCampaigns(): Promise<KeitaroCampaign[]>
  // async getConversions(dateRange: KeitaroDateRange): Promise<KeitaroConversion[]>
  // async getRevenue(dateRange: KeitaroDateRange): Promise<KeitaroRevenue[]>
  // async getClickStats(dateRange: KeitaroDateRange): Promise<KeitaroClickStat[]>
}

// ─────────────────────────────────────────────
// FACTORY
// ─────────────────────────────────────────────

export function createKeitaroClient(): KeitaroClient {
  return new KeitaroClient({
    apiUrl: process.env.KEITARO_API_URL ?? "",
    apiKey: process.env.KEITARO_API_KEY ?? "",
  });
}
