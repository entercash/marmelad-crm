/**
 * BullMQ Worker — Entry Point
 *
 * This file is the standalone worker process.
 * Run it separately from Next.js:
 *   npm run worker
 *
 * The worker:
 *  - Creates a BullMQ Worker for the "data-sync" queue using its own Redis
 *    connection (via getBullMQConnection — NOT the shared ioredis singleton)
 *  - Routes jobs by type prefix to the correct handler
 *  - Registers repeatable job schedulers (intraday + nightly sync)
 *  - Handles graceful shutdown on SIGTERM / SIGINT
 *
 * ⚠️  DO NOT import this file from Next.js.
 */

import { Worker } from "bullmq";
import { getBullMQConnection } from "../lib/bullmq-connection";
import { toErrorMessage } from "../lib/errors";
import { handleTaboolaJob } from "./handlers/taboola.handlers";
import { handleKeitaroJob } from "./handlers/keitaro.handlers";
import { syncQueue } from "./queues";
import type { SyncJobPayload } from "./types";

// ─── Config ───────────────────────────────────────────────────────────────────

const QUEUE_NAME = "data-sync";
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? "2", 10);

// ─── Scheduler registration ──────────────────────────────────────────────────

/**
 * Register repeatable job schedulers (idempotent — safe on restart).
 * Uses BullMQ upsertJobScheduler API: if a scheduler with the same name
 * already exists, it updates the schedule; otherwise creates a new one.
 */
async function registerSchedulers(): Promise<void> {
  // ── Taboola intraday: every 10 min, today + yesterday ──
  await syncQueue.upsertJobScheduler(
    "taboola-intraday",
    { every: 10 * 60 * 1000 },
    { name: "taboola:full-sync", data: { type: "taboola:full-sync" as const, mode: "intraday" as const } },
  );

  // ── Taboola nightly: once at 04:00 MSK, last 30 days ──
  await syncQueue.upsertJobScheduler(
    "taboola-nightly",
    { pattern: "0 4 * * *", tz: "Europe/Moscow" },
    { name: "taboola:full-sync", data: { type: "taboola:full-sync" as const, mode: "full" as const } },
  );

  // ── Keitaro intraday: every 10 min, today + yesterday ──
  await syncQueue.upsertJobScheduler(
    "keitaro-intraday",
    { every: 10 * 60 * 1000 },
    { name: "keitaro:conversion-stats-daily", data: { type: "keitaro:conversion-stats-daily" as const, startDate: "AUTO_INTRADAY", endDate: "AUTO_INTRADAY" } },
  );

  // ── Keitaro nightly: once at 04:10 MSK, last 30 days ──
  await syncQueue.upsertJobScheduler(
    "keitaro-nightly",
    { pattern: "10 4 * * *", tz: "Europe/Moscow" },
    { name: "keitaro:conversion-stats-daily", data: { type: "keitaro:conversion-stats-daily" as const, startDate: "AUTO_FULL", endDate: "AUTO_FULL" } },
  );

  console.log("[Worker] Registered 4 job schedulers (taboola-intraday, taboola-nightly, keitaro-intraday, keitaro-nightly)");
}

// ─── Worker ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("[Worker] Starting Marmelad CRM sync worker...");
  console.log(`[Worker] Queue: ${QUEUE_NAME} | Concurrency: ${CONCURRENCY}`);

  const worker = new Worker<SyncJobPayload>(
    QUEUE_NAME,
    async (job) => {
      const { type } = job.data;

      if (type.startsWith("taboola:")) {
        return handleTaboolaJob(job as Parameters<typeof handleTaboolaJob>[0]);
      }

      if (type.startsWith("keitaro:")) {
        return handleKeitaroJob(job as Parameters<typeof handleKeitaroJob>[0]);
      }

      // Future sources: add routing here
      throw new Error(`[Worker] No handler registered for job type: ${type}`);
    },
    {
      // BullMQ manages its own Redis connection independently.
      // Do NOT pass the shared ioredis singleton here.
      connection: getBullMQConnection(),
      concurrency: CONCURRENCY,
      // Stalled job threshold — if a job doesn't heartbeat within the interval, it's re-queued.
      stalledInterval: parseInt(process.env.WORKER_STALLED_INTERVAL ?? "30000", 10),
      maxStalledCount: 2,
    },
  );

  // ─── Event listeners ───────────────────────────────────────────────────────

  worker.on("active", (job) => {
    console.log(`[Worker] Job active | type=${job.data.type} | id=${job.id}`);
  });

  worker.on("completed", (job) => {
    console.log(`[Worker] Job completed | type=${job.data.type} | id=${job.id}`);
  });

  worker.on("failed", (job, err) => {
    const type = job?.data?.type ?? "unknown";
    const attempts = job?.attemptsMade ?? "?";
    console.error(
      `[Worker] Job failed | type=${type} | attempt=${attempts} | error=${toErrorMessage(err)}`,
    );
  });

  worker.on("error", (err) => {
    console.error("[Worker] Worker error:", toErrorMessage(err));
  });

  // ─── Register repeatable schedulers ─────────────────────────────────────────

  await registerSchedulers();

  // ─── Graceful shutdown ─────────────────────────────────────────────────────

  async function shutdown(signal: string): Promise<void> {
    console.log(`[Worker] Received ${signal} — graceful shutdown...`);
    await worker.close();
    console.log("[Worker] Worker closed. Exiting.");
    process.exit(0);
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT",  () => void shutdown("SIGINT"));

  console.log("[Worker] Ready. Waiting for jobs...");
}

main().catch((err) => {
  console.error("[Worker] Fatal error during startup:", err);
  process.exit(1);
});
