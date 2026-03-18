/**
 * Taboola Sync Services
 *
 * Each function orchestrates one full sync pipeline step:
 *   1. Create SyncLog (RUNNING)
 *   2. Authenticate + call Taboola API
 *   3. Persist raw response (RawImportBatch)
 *   4. Normalize response to internal types
 *   5. Upsert normalized records into the database
 *   6. Update SyncLog (SUCCESS | PARTIAL | FAILED)
 *
 * All functions are idempotent — safe to re-run for the same date range.
 * On error, the SyncLog is marked FAILED and the error is re-thrown for BullMQ retry.
 */

import { prisma } from "@/lib/prisma";
import { createTaboolaClient } from "@/integrations/taboola";
import type { TaboolaConfig } from "@/integrations/taboola";
import type { TaboolaItemStatRow } from "@/integrations/taboola";
import { getTaboolaAccountSettings } from "@/features/integration-settings/queries";
import { ConfigurationError } from "@/lib/errors";
import {
  createSyncLog,
  completeSyncLog,
  failSyncLog,
  writeRawBatch,
  markRawBatchProcessed,
} from "./sync-log";
import { SyncCounter } from "./types";
import type { TaboolaSyncParams, SyncResult } from "./types";

import { upsertCampaigns } from "@/services/upsert/campaigns.upsert";
import { upsertCampaignItems } from "@/services/upsert/campaign-items.upsert";
import { upsertPublishers } from "@/services/upsert/publishers.upsert";
import { upsertCampaignStats } from "@/services/upsert/campaign-stats.upsert";
import { upsertItemStats } from "@/services/upsert/item-stats.upsert";
import { upsertPublisherStats } from "@/services/upsert/publisher-stats.upsert";

// ─── Load Taboola config from DB ────────────────────────────────────────────

/**
 * Load Taboola API credentials from integration_settings for a given accountId.
 * Falls back to env vars if DB settings are missing (backward compat).
 */
async function loadTaboolaConfigFromDB(accountId: string): Promise<TaboolaConfig> {
  const settings = await getTaboolaAccountSettings(accountId);

  const clientId = settings.clientId || process.env.TABOOLA_CLIENT_ID;
  const clientSecret = settings.clientSecret || process.env.TABOOLA_CLIENT_SECRET;
  const taboolaAccountId = settings.taboolaAccountId || process.env.TABOOLA_ACCOUNT_ID;

  if (!clientId) throw new ConfigurationError(`TABOOLA_CLIENT_ID is not set for account ${accountId}`);
  if (!clientSecret) throw new ConfigurationError(`TABOOLA_CLIENT_SECRET is not set for account ${accountId}`);
  if (!taboolaAccountId) throw new ConfigurationError(`TABOOLA_ACCOUNT_ID is not set for account ${accountId}`);

  return {
    clientId,
    clientSecret,
    accountId: taboolaAccountId,
    proxyUrl: settings.proxyUrl || undefined,
  };
}

// ─── Resolve internal IDs ──────────────────────────────────────────────────────

/** Look up the internal TrafficSource ID for Taboola (cached per call). */
async function getTaboolaSourceId(): Promise<string> {
  const source = await prisma.trafficSource.findUniqueOrThrow({
    where: { slug: "taboola" },
    select: { id: true },
  });
  return source.id;
}

/**
 * Resolve or create the AdAccount for a given Taboola external account ID.
 * Returns the internal DB id.
 */
async function resolveAdAccountId(
  externalAccountId: string,
  trafficSourceId: string,
): Promise<string> {
  const account = await prisma.adAccount.upsert({
    where: {
      trafficSourceId_externalId: {
        trafficSourceId,
        externalId: externalAccountId,
      },
    },
    update: {},
    create: {
      name: `Taboola ${externalAccountId}`, // will be updated when we have account name
      externalId: externalAccountId,
      trafficSourceId,
    },
    select: { id: true },
  });
  return account.id;
}

// ─── Campaign sync ─────────────────────────────────────────────────────────────

/**
 * Sync all campaigns for a Taboola account.
 * Creates/updates Campaign records. Also creates/updates CampaignItem records
 * for each active campaign (full creative list per campaign).
 *
 * Dependency: none (can run independently)
 * Job payload: { type: "taboola:campaigns", accountId }
 */
export async function syncTaboolaCampaigns(
  params: TaboolaSyncParams,
): Promise<SyncResult> {
  const trafficSourceId = await getTaboolaSourceId();
  const adAccountId = await resolveAdAccountId(params.accountId, trafficSourceId);
  const config = await loadTaboolaConfigFromDB(params.accountId);
  const client = createTaboolaClient(config);
  const counter = new SyncCounter();

  const syncLogId = await createSyncLog({
    source: "taboola",
    entityType: "campaigns",
    trafficSourceId,
    meta: { accountId: params.accountId },
  });

  try {
    // Step 1: Fetch campaigns
    const response = await client.getCampaigns();
    counter.fetched = response.recordCount;

    // Step 2: Persist raw batch
    const batchId = await writeRawBatch({
      syncLogId,
      source: "taboola",
      entityType: "campaigns",
      payload: response,
    });

    // Step 3: Upsert campaigns
    const campaignResults = await upsertCampaigns(
      response.results,
      trafficSourceId,
      adAccountId,
    );
    counter.add(campaignResults);

    // Step 4: Fetch and upsert items for each campaign
    // Only sync items for ACTIVE/PAUSED campaigns to avoid orphan records
    const syncableCampaigns = response.results.filter(
      (c) => c.status === "RUNNING" || c.status === "PAUSED",
    );

    for (const campaign of syncableCampaigns) {
      try {
        const itemsResponse = await client.getCampaignItems(campaign.id);
        await upsertCampaignItems(itemsResponse.results, campaign.id, trafficSourceId);
        counter.inserted += itemsResponse.results.length;
      } catch (itemErr) {
        // Don't fail the whole sync if one campaign's items fail
        console.error(
          `[taboola:campaigns] Failed to sync items for campaign ${campaign.id}:`,
          itemErr,
        );
        counter.failed += 1;
      }
    }

    await markRawBatchProcessed(batchId);
    await completeSyncLog(syncLogId, counter);

    return { syncLogId, ...counter.toResult() };
  } catch (err) {
    await failSyncLog(syncLogId, err);
    throw err;
  }
}

// ─── Campaign stats sync ───────────────────────────────────────────────────────

/**
 * Sync daily campaign performance stats for a date range.
 * Upserts CampaignStatsDaily records (one per campaign × day).
 *
 * Dependency: campaigns must exist (run syncTaboolaCampaigns first)
 * Job payload: { type: "taboola:campaign-stats-daily", accountId, startDate, endDate }
 */
export async function syncTaboolaCampaignStatsDaily(
  params: TaboolaSyncParams & { dateRange: { startDate: string; endDate: string } },
): Promise<SyncResult> {
  const trafficSourceId = await getTaboolaSourceId();
  const config = await loadTaboolaConfigFromDB(params.accountId);
  const client = createTaboolaClient(config);
  const counter = new SyncCounter();

  const syncLogId = await createSyncLog({
    source: "taboola",
    entityType: "campaign-stats-daily",
    trafficSourceId,
    meta: {
      accountId: params.accountId,
      startDate: params.dateRange.startDate,
      endDate: params.dateRange.endDate,
    },
  });

  try {
    // Build lookup: externalId → internal Campaign.id
    const campaigns = await prisma.campaign.findMany({
      where: { trafficSourceId },
      select: { id: true, externalId: true },
    });
    const campaignIdMap = new Map(campaigns.map((c) => [c.externalId, c.id]));

    // Fetch stats
    const response = await client.getCampaignStatsDaily({
      start_date: params.dateRange.startDate,
      end_date: params.dateRange.endDate,
    });
    counter.fetched = response.results.length;

    // Persist raw batch
    const batchId = await writeRawBatch({
      syncLogId,
      source: "taboola",
      entityType: "campaign-stats-daily",
      payload: response,
    });

    // Upsert stats — skip rows for campaigns we don't have in DB yet
    const knownRows = response.results.filter((row) =>
      campaignIdMap.has(row.campaign),
    );
    counter.skipped = response.results.length - knownRows.length;

    if (knownRows.length > 0) {
      const results = await upsertCampaignStats(knownRows, campaignIdMap);
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

// ─── Item stats sync ───────────────────────────────────────────────────────────

/**
 * Sync daily item (creative) performance stats for a date range.
 * Upserts CampaignItemStatsDaily records.
 *
 * Dependency: campaign items must exist (run syncTaboolaCampaigns first)
 * Job payload: { type: "taboola:item-stats-daily", accountId, startDate, endDate }
 */
export async function syncTaboolaItemStatsDaily(
  params: TaboolaSyncParams & { dateRange: { startDate: string; endDate: string } },
): Promise<SyncResult> {
  const trafficSourceId = await getTaboolaSourceId();
  const config = await loadTaboolaConfigFromDB(params.accountId);
  const client = createTaboolaClient(config);
  const counter = new SyncCounter();

  const syncLogId = await createSyncLog({
    source: "taboola",
    entityType: "item-stats-daily",
    trafficSourceId,
    meta: {
      accountId: params.accountId,
      startDate: params.dateRange.startDate,
      endDate: params.dateRange.endDate,
    },
  });

  try {
    // Build lookup: campaign externalId → { campaignDbId, Map<itemExternalId, itemDbId> }
    const campaigns = await prisma.campaign.findMany({
      where: { trafficSourceId },
      select: {
        id: true,
        externalId: true,
        items: { select: { id: true, externalId: true } },
      },
    });

    // Flat map: itemExternalId → itemDbId
    const itemIdMap = new Map<string, string>();
    for (const campaign of campaigns) {
      for (const item of campaign.items) {
        itemIdMap.set(item.externalId, item.id);
      }
    }

    // Fetch stats (all items, all campaigns, all days in range)
    const response = await client.getItemStats({
      start_date: params.dateRange.startDate,
      end_date: params.dateRange.endDate,
    });
    counter.fetched = response.results.length;

    const batchId = await writeRawBatch({
      syncLogId,
      source: "taboola",
      entityType: "item-stats",
      payload: response,
    });

    const knownRows = response.results.filter((row: TaboolaItemStatRow) =>
      itemIdMap.has(row.item),
    );
    counter.skipped = response.results.length - knownRows.length;

    if (knownRows.length > 0) {
      const results = await upsertItemStats(knownRows, itemIdMap);
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

// ─── Publisher stats sync ──────────────────────────────────────────────────────

/**
 * Sync daily publisher/site performance stats for a date range.
 * Auto-creates Publisher records for any new sites encountered.
 * Upserts PublisherStatsDaily records (publisher × campaign × day × GEO).
 *
 * This is the most data-intensive sync — may return thousands of rows per day.
 *
 * Dependency: campaigns must exist (run syncTaboolaCampaigns first)
 * Job payload: { type: "taboola:publisher-stats-daily", accountId, startDate, endDate }
 */
export async function syncTaboolaPublisherStatsDaily(
  params: TaboolaSyncParams & { dateRange: { startDate: string; endDate: string } },
): Promise<SyncResult> {
  const trafficSourceId = await getTaboolaSourceId();
  const config = await loadTaboolaConfigFromDB(params.accountId);
  const client = createTaboolaClient(config);
  const counter = new SyncCounter();

  const syncLogId = await createSyncLog({
    source: "taboola",
    entityType: "publisher-stats-daily",
    trafficSourceId,
    meta: {
      accountId: params.accountId,
      startDate: params.dateRange.startDate,
      endDate: params.dateRange.endDate,
    },
  });

  try {
    // Build campaign lookup map
    const campaigns = await prisma.campaign.findMany({
      where: { trafficSourceId },
      select: { id: true, externalId: true },
    });
    const campaignIdMap = new Map(campaigns.map((c) => [c.externalId, c.id]));

    // Fetch publisher stats
    const response = await client.getPublisherStatsDaily({
      start_date: params.dateRange.startDate,
      end_date: params.dateRange.endDate,
    });
    counter.fetched = response.results.length;

    const batchId = await writeRawBatch({
      syncLogId,
      source: "taboola",
      entityType: "publisher-stats-daily",
      payload: response,
    });

    // Auto-create Publisher records for any sites we haven't seen before
    const publisherResults = await upsertPublishers(
      response.results,
      trafficSourceId,
    );
    counter.add(publisherResults);

    // Build publisher lookup map (re-query after upserts)
    const publishers = await prisma.publisher.findMany({
      where: { trafficSourceId },
      select: { id: true, externalId: true },
    });
    const publisherIdMap = new Map(publishers.map((p) => [p.externalId, p.id]));

    // Upsert publisher stats — skip if campaign or publisher not in DB
    const knowableRows = response.results.filter(
      (row) => campaignIdMap.has(row.campaign_id) && publisherIdMap.has(row.site),
    );
    counter.skipped += response.results.length - knowableRows.length;

    if (knowableRows.length > 0) {
      const statsResults = await upsertPublisherStats(
        knowableRows,
        publisherIdMap,
        campaignIdMap,
      );
      counter.add(statsResults);
    }

    await markRawBatchProcessed(batchId);
    await completeSyncLog(syncLogId, counter);

    return { syncLogId, ...counter.toResult() };
  } catch (err) {
    await failSyncLog(syncLogId, err);
    throw err;
  }
}
