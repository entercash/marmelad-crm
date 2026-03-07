/**
 * BullMQ Queue Definitions
 *
 * Queues are defined here and imported by:
 *  - The worker process (to create Workers)
 *  - Next.js API routes / Server Actions (to enqueue jobs)
 *
 * ⚠️  Never pass the shared ioredis singleton (lib/redis.ts) to BullMQ.
 *     BullMQ manages its own internal Redis connections and expects a plain
 *     ConnectionOptions object. Use getBullMQConnection() instead.
 */

import { Queue } from "bullmq";
import { getBullMQConnection } from "@/lib/bullmq-connection";
import type { SyncJobPayload, AggregateJobPayload } from "./types";

// ─── Shared defaults ──────────────────────────────────────────────────────────

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 10_000, // 10 seconds initial, doubles each retry
  },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 100 },
};

// ─── Queue instances ──────────────────────────────────────────────────────────

/**
 * Primary sync queue — processes Taboola and Keitaro data imports.
 * Jobs: taboola:campaigns, taboola:*-stats-daily, keitaro:conversion-stats-daily
 */
export const syncQueue = new Queue<SyncJobPayload>("data-sync", {
  connection: getBullMQConnection(),
  defaultJobOptions,
});

/**
 * P&L aggregation queue — re-computes PnlDaily snapshots after syncs.
 * Jobs: pnl:aggregate
 */
export const aggregateQueue = new Queue<AggregateJobPayload>("pnl-aggregate", {
  connection: getBullMQConnection(),
  defaultJobOptions,
});

// ─── Enqueue helpers ──────────────────────────────────────────────────────────

import { toApiDate, yesterday } from "@/lib/date";
import type {
  TaboolaCampaignsPayload,
  TaboolaCampaignStatsDailyPayload,
  TaboolaItemStatsDailyPayload,
  TaboolaPublisherStatsDailyPayload,
  KeitaroConversionStatsDailyPayload,
} from "./types";

/** Enqueue a Taboola campaign sync for the given account */
export async function enqueueTaboolaCampaigns(
  accountId: string,
): Promise<void> {
  const payload: TaboolaCampaignsPayload = { type: "taboola:campaigns", accountId };
  await syncQueue.add("taboola:campaigns", payload, { jobId: `taboola-campaigns-${accountId}` });
}

/** Enqueue a Taboola campaign stats sync for yesterday */
export async function enqueueTaboolaCampaignStatsYesterday(
  accountId: string,
): Promise<void> {
  const date = toApiDate(yesterday());
  const payload: TaboolaCampaignStatsDailyPayload = {
    type: "taboola:campaign-stats-daily",
    accountId,
    startDate: date,
    endDate: date,
  };
  await syncQueue.add("taboola:campaign-stats-daily", payload);
}

/** Enqueue a Taboola item stats sync for a date range */
export async function enqueueTaboolaItemStats(
  accountId: string,
  startDate: string,
  endDate: string,
): Promise<void> {
  const payload: TaboolaItemStatsDailyPayload = {
    type: "taboola:item-stats-daily",
    accountId,
    startDate,
    endDate,
  };
  await syncQueue.add("taboola:item-stats-daily", payload);
}

/** Enqueue a Taboola publisher stats sync for a date range */
export async function enqueueTaboolaPublisherStats(
  accountId: string,
  startDate: string,
  endDate: string,
): Promise<void> {
  const payload: TaboolaPublisherStatsDailyPayload = {
    type: "taboola:publisher-stats-daily",
    accountId,
    startDate,
    endDate,
  };
  await syncQueue.add("taboola:publisher-stats-daily", payload);
}

/** Enqueue a Keitaro conversion stats sync for a date range */
export async function enqueueKeitaroConversionStats(
  startDate: string,
  endDate: string,
): Promise<void> {
  const payload: KeitaroConversionStatsDailyPayload = {
    type: "keitaro:conversion-stats-daily",
    startDate,
    endDate,
  };
  await syncQueue.add("keitaro:conversion-stats-daily", payload);
}
