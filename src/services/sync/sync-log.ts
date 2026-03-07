/**
 * SyncLog management utilities.
 *
 * Every sync run gets a SyncLog record:
 *  - Created at job start (RUNNING)
 *  - Updated at job finish (SUCCESS | PARTIAL | FAILED)
 *
 * Also handles writing RawImportBatch records for debugging/re-processing.
 */

import { Prisma, SyncStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toErrorMessage, toErrorStack } from "@/lib/errors";
import type { SyncCounter } from "./types";

// ─── SyncLog lifecycle ────────────────────────────────────────────────────────

interface CreateSyncLogInput {
  source: string;        // e.g. "taboola"
  entityType: string;    // e.g. "campaigns"
  trafficSourceId?: string;
  meta?: Record<string, unknown>;
}

export async function createSyncLog(input: CreateSyncLogInput): Promise<string> {
  const log = await prisma.syncLog.create({
    data: {
      source: input.source,
      entityType: input.entityType,
      trafficSourceId: input.trafficSourceId,
      status: SyncStatus.RUNNING,
      startedAt: new Date(),
      // Cast: meta values are always JSON-serializable job-context data.
      // Record<string, unknown> is too wide for Prisma's InputJsonValue.
      meta: (input.meta ?? {}) as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  return log.id;
}

export async function completeSyncLog(
  id: string,
  counter: SyncCounter,
): Promise<void> {
  const status = counter.failed > 0 ? SyncStatus.PARTIAL : SyncStatus.SUCCESS;

  await prisma.syncLog.update({
    where: { id },
    data: {
      status,
      finishedAt: new Date(),
      recordsFetched: counter.fetched,
      recordsInserted: counter.inserted,
      recordsUpdated: counter.updated,
      recordsSkipped: counter.skipped,
      recordsFailed: counter.failed,
    },
  });
}

export async function failSyncLog(id: string, error: unknown): Promise<void> {
  await prisma.syncLog.update({
    where: { id },
    data: {
      status: SyncStatus.FAILED,
      finishedAt: new Date(),
      errorMessage: toErrorMessage(error),
      // Store truncated stack for space efficiency
      meta: {
        errorStack: toErrorStack(error)?.slice(0, 2000),
      },
    },
  });
}

// ─── RawImportBatch ───────────────────────────────────────────────────────────

/**
 * Persist the raw API response payload before processing begins.
 * This ensures we have the raw data even if the normalization step fails.
 * Call this immediately after the API response is received.
 */
export async function writeRawBatch(input: {
  syncLogId: string;
  source: string;
  entityType: string;
  payload: unknown;
}): Promise<string> {
  const batch = await prisma.rawImportBatch.create({
    data: {
      syncLogId: input.syncLogId,
      source: input.source,
      entityType: input.entityType,
      payload: input.payload as never,
    },
    select: { id: true },
  });
  return batch.id;
}

export async function markRawBatchProcessed(batchId: string): Promise<void> {
  await prisma.rawImportBatch.update({
    where: { id: batchId },
    data: { processedAt: new Date() },
  });
}
