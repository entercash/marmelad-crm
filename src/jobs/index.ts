/**
 * Background Jobs — BullMQ
 *
 * Queue-based job system for async data sync and processing.
 *
 * Queues (Phase 2):
 *  - data-sync: Pull data from Taboola and Keitaro on a schedule
 *  - pnl-aggregate: Re-compute P&L snapshots after each sync
 *  - report-export: Generate and deliver scheduled reports
 *
 * Workers run as a separate Node.js process (not inside Next.js).
 */

import { Queue, Worker, type Job } from "bullmq";
import { redis } from "@/lib/redis";

// ─────────────────────────────────────────────
// JOB PAYLOAD TYPES
// ─────────────────────────────────────────────

export type SyncJobData =
  | { type: "taboola:campaigns"; accountId: string }
  | { type: "taboola:publishers"; accountId: string; startDate: string; endDate: string }
  | { type: "keitaro:conversions"; startDate: string; endDate: string }
  | { type: "keitaro:revenue"; startDate: string; endDate: string };

export type AggregateJobData = {
  type: "pnl:aggregate";
  startDate: string;
  endDate: string;
};

export type JobData = SyncJobData | AggregateJobData;

// ─────────────────────────────────────────────
// QUEUES
// ─────────────────────────────────────────────

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 5_000,
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};

export const syncQueue = new Queue<SyncJobData>("data-sync", {
  connection: redis,
  defaultJobOptions,
});

export const aggregateQueue = new Queue<AggregateJobData>("pnl-aggregate", {
  connection: redis,
  defaultJobOptions,
});

// ─────────────────────────────────────────────
// WORKER — Placeholder, implement in Phase 2
// ─────────────────────────────────────────────

export function createSyncWorker(): Worker<SyncJobData> {
  return new Worker<SyncJobData>(
    "data-sync",
    async (job: Job<SyncJobData>) => {
      console.log(`[Jobs][data-sync] Processing: ${job.data.type}`, { jobId: job.id });

      // TODO Phase 2: route to integration handlers
      // switch (job.data.type) {
      //   case "taboola:campaigns": return syncTaboolaCampaigns(job.data);
      //   case "taboola:publishers": return syncTaboolaPublishers(job.data);
      //   case "keitaro:conversions": return syncKeitaroConversions(job.data);
      //   case "keitaro:revenue": return syncKeitaroRevenue(job.data);
      // }

      throw new Error(`[Jobs] Handler not yet implemented: ${job.data.type}`);
    },
    { connection: redis }
  );
}
