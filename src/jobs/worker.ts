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
 *  - Handles graceful shutdown on SIGTERM / SIGINT
 *
 * ⚠️  DO NOT import this file from Next.js.
 */

import { Worker } from "bullmq";
import { getBullMQConnection } from "@/lib/bullmq-connection";
import { toErrorMessage } from "@/lib/errors";
import { handleTaboolaJob } from "./handlers/taboola.handlers";
import { handleKeitaroJob } from "./handlers/keitaro.handlers";
import type { SyncJobPayload } from "./types";

// ─── Config ───────────────────────────────────────────────────────────────────

const QUEUE_NAME = "data-sync";
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? "2", 10);

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
