/**
 * Keitaro Sync Services
 *
 * Orchestrates conversion and revenue data ingestion from Keitaro.
 * Follows the same pipeline pattern as Taboola sync services:
 *   1. Create SyncLog
 *   2. Call Keitaro API
 *   3. Persist raw batch
 *   4. Normalize and upsert
 *   5. Update SyncLog
 *
 * Keitaro data is stored independently from spend data.
 * The join with Taboola (for P&L) happens via CampaignMapping at query time.
 */

import { prisma } from "@/lib/prisma";
import { CRM_TIMEZONE } from "@/lib/date";
import { createKeitaroClient } from "@/integrations/keitaro";
import type { KeitaroConfig } from "@/integrations/keitaro";
import type { KeitaroDateRange } from "@/integrations/keitaro";
import { getKeitaroSettings } from "@/features/integration-settings/queries";
import { ConfigurationError } from "@/lib/errors";
import {
  createSyncLog,
  completeSyncLog,
  failSyncLog,
  writeRawBatch,
  markRawBatchProcessed,
} from "./sync-log";
import { SyncCounter } from "./types";
import type { KeitaroSyncParams, SyncResult } from "./types";

import { upsertConversionStats } from "@/services/upsert/conversion-stats.upsert";

// ─── Load Keitaro config from DB ─────────────────────────────────────────────

/**
 * Load Keitaro API credentials from integration_settings (DB).
 * Falls back to env vars (backward compat).
 */
async function loadKeitaroConfigFromDB(): Promise<KeitaroConfig> {
  const settings = await getKeitaroSettings();

  const apiUrl = settings.apiUrl || process.env.KEITARO_API_URL;
  const apiKey = settings.apiKey || process.env.KEITARO_API_KEY;

  if (!apiUrl) throw new ConfigurationError("KEITARO_API_URL is not set");
  if (!apiKey) throw new ConfigurationError("KEITARO_API_KEY is not set");

  return { apiUrl: apiUrl.replace(/\/$/, ""), apiKey };
}

// ─── Resolve internal IDs ──────────────────────────────────────────────────────

async function getKeitaroSourceId(): Promise<string> {
  const source = await prisma.trafficSource.findUniqueOrThrow({
    where: { slug: "keitaro" },
    select: { id: true },
  });
  return source.id;
}

// ─── Conversion stats sync ────────────────────────────────────────────────────

/**
 * Sync daily conversion + revenue stats from Keitaro.
 * Grouped by: campaign_id × country × day.
 *
 * Results are stored in conversion_stats_daily.
 * They are NOT joined with spend data here — that happens in the P&L aggregation job.
 *
 * This sync is independent of Taboola syncs and can run at any time.
 *
 * Job payload: { type: "keitaro:conversion-stats-daily", startDate, endDate }
 */
export async function syncKeitaroConversionStatsDaily(
  params: KeitaroSyncParams,
): Promise<SyncResult> {
  const trafficSourceId = await getKeitaroSourceId();
  const config = await loadKeitaroConfigFromDB();
  const client = createKeitaroClient(config);
  const counter = new SyncCounter();

  const syncLogId = await createSyncLog({
    source: "keitaro",
    entityType: "conversion-stats-daily",
    trafficSourceId,
    meta: {
      startDate: params.dateRange.startDate,
      endDate: params.dateRange.endDate,
    },
  });

  try {
    const keitaroRange: KeitaroDateRange = {
      from: params.dateRange.startDate,
      to: params.dateRange.endDate,
      timezone: CRM_TIMEZONE,
    };

    // Fetch from Keitaro
    const response = await client.getConversionStatsDaily(keitaroRange);
    counter.fetched = response.rows.length;

    // Persist raw batch immediately — before processing
    const batchId = await writeRawBatch({
      syncLogId,
      source: "keitaro",
      entityType: "conversion-stats-daily",
      payload: response,
    });

    // Upsert normalized conversion stats
    if (response.rows.length > 0) {
      const results = await upsertConversionStats(response.rows);
      counter.add(results);
    }

    await markRawBatchProcessed(batchId);
    await completeSyncLog(syncLogId, counter);

    return { syncLogId, ...counter.toResult() };
  } catch (err) {
    await failSyncLog(syncLogId, err);
    throw err;
  }
}
