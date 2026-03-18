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
import { ValidationError } from "../../lib/errors";
import { isValidDateStr, todayCrm, daysAgoCrm } from "../../lib/date";
import type { TaboolaJobPayload } from "../types";
import {
  syncTaboolaCampaigns,
  syncTaboolaCampaignStatsDaily,
  syncTaboolaItemStatsDaily,
  syncTaboolaPublisherStatsDaily,
} from "../../services/sync/taboola.sync";
import { getTaboolaConnectedAccountIds } from "../../features/integration-settings/queries";

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

    case "taboola:full-sync":
      return handleFullSync(job as Job<typeof data>);

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

// ─── Full sync (orchestrates all steps for all accounts) ─────────────────────

async function handleFullSync(
  job: Job<{ type: "taboola:full-sync"; mode: "intraday" | "full" }>,
): Promise<void> {
  const { mode } = job.data;

  // Resolve date range based on mode
  const endDate = todayCrm();
  const startDate = mode === "intraday" ? daysAgoCrm(1) : daysAgoCrm(30);

  console.log(
    `[taboola:full-sync] Starting | mode=${mode} | ${startDate}→${endDate} | jobId=${job.id}`,
  );

  // Get all connected Taboola accounts
  const accountIds = await getTaboolaConnectedAccountIds();
  if (accountIds.size === 0) {
    console.log("[taboola:full-sync] No connected Taboola accounts — skipping");
    return;
  }

  const dateRange = { startDate, endDate };
  let totalStats = { campaigns: 0, campaignStats: 0, publisherStats: 0, itemStats: 0 };

  for (const accountId of Array.from(accountIds)) {
    try {
      console.log(`[taboola:full-sync] Syncing account ${accountId}...`);

      // 1. Campaigns
      const campResult = await syncTaboolaCampaigns({ accountId });
      totalStats.campaigns += campResult.recordsFetched;

      // 2. Campaign stats
      const statsResult = await syncTaboolaCampaignStatsDaily({ accountId, dateRange });
      totalStats.campaignStats += statsResult.recordsFetched;

      // 3. Publisher stats
      const pubResult = await syncTaboolaPublisherStatsDaily({ accountId, dateRange });
      totalStats.publisherStats += pubResult.recordsFetched;

      // 4. Item stats
      const itemResult = await syncTaboolaItemStatsDaily({ accountId, dateRange });
      totalStats.itemStats += itemResult.recordsFetched;

      console.log(
        `[taboola:full-sync] Account ${accountId} done | campaigns=${campResult.recordsFetched} stats=${statsResult.recordsFetched} publishers=${pubResult.recordsFetched} items=${itemResult.recordsFetched}`,
      );
    } catch (err) {
      console.error(`[taboola:full-sync] Account ${accountId} failed:`, err);
      // Continue with other accounts — don't let one failure stop everything
    }
  }

  console.log(
    `[taboola:full-sync] Complete | mode=${mode} | accounts=${accountIds.size} | campaigns=${totalStats.campaigns} stats=${totalStats.campaignStats} publishers=${totalStats.publisherStats} items=${totalStats.itemStats}`,
  );
}
