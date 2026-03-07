/**
 * Taboola BullMQ Job Handlers
 *
 * Each handler:
 *  1. Validates the job payload structure
 *  2. Delegates to the appropriate sync service
 *  3. Logs the result
 *
 * Handlers are intentionally thin — all business logic lives in sync services.
 * BullMQ handles retry/backoff based on thrown errors.
 */

import type { Job } from "bullmq";
import { ValidationError } from "@/lib/errors";
import { isValidDateStr } from "@/lib/date";
import type { TaboolaJobPayload } from "@/jobs/types";
import {
  syncTaboolaCampaigns,
  syncTaboolaCampaignStatsDaily,
  syncTaboolaItemStatsDaily,
  syncTaboolaPublisherStatsDaily,
} from "@/services/sync/taboola.sync";

// ─── Main router ──────────────────────────────────────────────────────────────

export async function handleTaboolaJob(
  job: Job<TaboolaJobPayload>,
): Promise<void> {
  const { data } = job;

  switch (data.type) {
    case "taboola:campaigns":
      return handleCampaigns(job as Job<typeof data>);

    case "taboola:campaign-stats-daily":
      return handleCampaignStats(job as Job<typeof data>);

    case "taboola:item-stats-daily":
      return handleItemStats(job as Job<typeof data>);

    case "taboola:publisher-stats-daily":
      return handlePublisherStats(job as Job<typeof data>);

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = data;
      throw new ValidationError(`Unknown Taboola job type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

// ─── Individual handlers ──────────────────────────────────────────────────────

async function handleCampaigns(
  job: Job<{ type: "taboola:campaigns"; accountId: string }>,
): Promise<void> {
  const { accountId } = job.data;

  if (!accountId?.trim()) {
    throw new ValidationError("taboola:campaigns — accountId is required");
  }

  console.log(`[taboola:campaigns] Starting | accountId=${accountId} | jobId=${job.id}`);

  const result = await syncTaboolaCampaigns({ accountId });

  console.log(
    `[taboola:campaigns] Done | fetched=${result.recordsFetched} updated=${result.recordsUpdated} failed=${result.recordsFailed} | syncLogId=${result.syncLogId}`,
  );
}

async function handleCampaignStats(
  job: Job<{
    type: "taboola:campaign-stats-daily";
    accountId: string;
    startDate: string;
    endDate: string;
  }>,
): Promise<void> {
  const { accountId, startDate, endDate } = job.data;

  if (!accountId?.trim()) throw new ValidationError("accountId is required");
  if (!isValidDateStr(startDate)) throw new ValidationError(`Invalid startDate: ${startDate}`);
  if (!isValidDateStr(endDate)) throw new ValidationError(`Invalid endDate: ${endDate}`);
  if (startDate > endDate) throw new ValidationError("startDate must be <= endDate");

  console.log(
    `[taboola:campaign-stats-daily] Starting | accountId=${accountId} | ${startDate}→${endDate} | jobId=${job.id}`,
  );

  const result = await syncTaboolaCampaignStatsDaily({
    accountId,
    dateRange: { startDate, endDate },
  });

  console.log(
    `[taboola:campaign-stats-daily] Done | fetched=${result.recordsFetched} updated=${result.recordsUpdated} skipped=${result.recordsSkipped} | syncLogId=${result.syncLogId}`,
  );
}

async function handleItemStats(
  job: Job<{
    type: "taboola:item-stats-daily";
    accountId: string;
    startDate: string;
    endDate: string;
  }>,
): Promise<void> {
  const { accountId, startDate, endDate } = job.data;

  if (!accountId?.trim()) throw new ValidationError("accountId is required");
  if (!isValidDateStr(startDate)) throw new ValidationError(`Invalid startDate: ${startDate}`);
  if (!isValidDateStr(endDate)) throw new ValidationError(`Invalid endDate: ${endDate}`);

  console.log(
    `[taboola:item-stats-daily] Starting | accountId=${accountId} | ${startDate}→${endDate} | jobId=${job.id}`,
  );

  const result = await syncTaboolaItemStatsDaily({
    accountId,
    dateRange: { startDate, endDate },
  });

  console.log(
    `[taboola:item-stats-daily] Done | fetched=${result.recordsFetched} updated=${result.recordsUpdated} skipped=${result.recordsSkipped} | syncLogId=${result.syncLogId}`,
  );
}

async function handlePublisherStats(
  job: Job<{
    type: "taboola:publisher-stats-daily";
    accountId: string;
    startDate: string;
    endDate: string;
  }>,
): Promise<void> {
  const { accountId, startDate, endDate } = job.data;

  if (!accountId?.trim()) throw new ValidationError("accountId is required");
  if (!isValidDateStr(startDate)) throw new ValidationError(`Invalid startDate: ${startDate}`);
  if (!isValidDateStr(endDate)) throw new ValidationError(`Invalid endDate: ${endDate}`);

  console.log(
    `[taboola:publisher-stats-daily] Starting | accountId=${accountId} | ${startDate}→${endDate} | jobId=${job.id}`,
  );

  const result = await syncTaboolaPublisherStatsDaily({
    accountId,
    dateRange: { startDate, endDate },
  });

  console.log(
    `[taboola:publisher-stats-daily] Done | fetched=${result.recordsFetched} updated=${result.recordsUpdated} skipped=${result.recordsSkipped} failed=${result.recordsFailed} | syncLogId=${result.syncLogId}`,
  );
}
