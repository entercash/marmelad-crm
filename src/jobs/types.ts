/**
 * BullMQ job payload types.
 *
 * All job payloads use a discriminated union on `type` for exhaustive
 * switch-based routing in the worker.
 *
 * Naming convention: "{source}:{entity}" — e.g. "taboola:campaigns"
 */

// ─── Taboola job payloads ─────────────────────────────────────────────────────

export type TaboolaCampaignsPayload = {
  type: "taboola:campaigns";
  accountId: string;
};

export type TaboolaCampaignStatsDailyPayload = {
  type: "taboola:campaign-stats-daily";
  accountId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
};

export type TaboolaItemStatsDailyPayload = {
  type: "taboola:item-stats-daily";
  accountId: string;
  startDate: string;
  endDate: string;
};

export type TaboolaPublisherStatsDailyPayload = {
  type: "taboola:publisher-stats-daily";
  accountId: string;
  startDate: string;
  endDate: string;
};

export type TaboolaFullSyncPayload = {
  type: "taboola:full-sync";
  mode: "intraday" | "full"; // intraday = today+yesterday, full = 30 days
};

export type TaboolaJobPayload =
  | TaboolaCampaignsPayload
  | TaboolaCampaignStatsDailyPayload
  | TaboolaItemStatsDailyPayload
  | TaboolaPublisherStatsDailyPayload
  | TaboolaFullSyncPayload;

// ─── Keitaro job payloads ─────────────────────────────────────────────────────

export type KeitaroConversionStatsDailyPayload = {
  type: "keitaro:conversion-stats-daily";
  startDate: string;
  endDate: string;
};

export type KeitaroJobPayload = KeitaroConversionStatsDailyPayload;

// ─── Aggregate job payloads ───────────────────────────────────────────────────

export type PnlAggregatePayload = {
  type: "pnl:aggregate";
  startDate: string;
  endDate: string;
};

// ─── Union types ──────────────────────────────────────────────────────────────

export type SyncJobPayload = TaboolaJobPayload | KeitaroJobPayload;
export type AggregateJobPayload = PnlAggregatePayload;
export type AllJobPayloads = SyncJobPayload | AggregateJobPayload;
