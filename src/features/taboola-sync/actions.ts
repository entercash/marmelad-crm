"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { guardWrite } from "@/lib/auth-guard";
import { TaboolaClient } from "@/integrations/taboola/client";
import type { TaboolaConfig } from "@/integrations/taboola/client";
import { fromApiDate, todayCrm } from "@/lib/date";
import {
  getTaboolaConnectedAccountIds,
  getTaboolaAccountSettings,
} from "@/features/integration-settings/queries";
import { prisma } from "@/lib/prisma";

// ─── Result type ────────────────────────────────────────────────────────────

export type SyncTaboolaResult =
  | {
      success: true;
      accounts: number;
      totalCampaigns: number;
      statsRows: number;
      publisherStatsRows: number;
      itemStatsRows: number;
    }
  | { success: false; error: string };

// ─── Currency conversion ────────────────────────────────────────────────────

/** Approximate USD exchange rates for common Taboola currencies. */
const USD_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.26,
  HKD: 0.128,
  ILS: 0.27,
  BRL: 0.18,
  JPY: 0.0067,
  AUD: 0.65,
  CAD: 0.74,
  INR: 0.012,
  MXN: 0.058,
  PLN: 0.25,
  SEK: 0.095,
  TRY: 0.031,
};

function toUsd(amount: number | null | undefined, currency: string): number | null {
  if (amount == null || amount === 0) return amount === 0 ? 0 : null;
  const rate = USD_RATES[currency] ?? 1;
  return Math.round(amount * rate * 100) / 100;
}

function toUsdNum(amount: number, currency: string): number {
  const rate = USD_RATES[currency] ?? 1;
  return Math.round(amount * rate * 100) / 100;
}

// ─── Helper: build config from DB settings ──────────────────────────────────

async function buildTaboolaConfig(accountId: string): Promise<TaboolaConfig | null> {
  const settings = await getTaboolaAccountSettings(accountId);
  if (!settings.taboolaAccountId || !settings.clientId || !settings.clientSecret) {
    return null;
  }
  return {
    clientId: settings.clientId,
    clientSecret: settings.clientSecret,
    accountId: settings.taboolaAccountId,
    proxyUrl: settings.proxyUrl ?? undefined,
  };
}

// ─── Date helpers ───────────────────────────────────────────────────────────

/** Days ago from CRM "today" (Europe/Moscow GMT+3). */
function daysAgoCrm(n: number): string {
  const today = todayCrm(); // YYYY-MM-DD in Moscow TZ
  const d = new Date(`${today}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Extract YYYY-MM-DD from Taboola date formats ("YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss.S"). */
function extractDate(taboolaDate: string): string {
  return taboolaDate.slice(0, 10);
}

/** Normalize publisher domain from site_name (best-effort root domain extraction). */
function extractDomain(siteName: string): string | null {
  try {
    // Many Taboola site names are domains already (e.g. "msn.com", "yahoo.com")
    const cleaned = siteName.replace(/^www\./, "").toLowerCase().trim();
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleaned)) return cleaned;
    return null;
  } catch {
    return null;
  }
}

// ─── Dynamic field accessors (Taboola API field names vary by endpoint) ──────

/* eslint-disable @typescript-eslint/no-explicit-any */
const dyn = (row: any, ...keys: string[]): string | undefined => {
  for (const k of keys) if (row[k] != null) return String(row[k]);
  return undefined;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Main action ────────────────────────────────────────────────────────────

/**
 * Full Taboola sync: campaigns, campaign stats, publisher stats, item stats.
 * Date range: last 30 days from CRM "today" (Europe/Moscow GMT+3).
 */
export async function syncAllTaboolaCampaigns(): Promise<SyncTaboolaResult> {
  const denied = await guardWrite();
  if (denied) return { success: false, error: !denied.success ? denied.error : "Access denied" };

  const connectedIds = await getTaboolaConnectedAccountIds();
  if (connectedIds.size === 0) {
    return { success: false, error: "No Taboola accounts configured. Go to Settings to connect." };
  }

  // Date range in CRM timezone (Europe/Moscow)
  const endDate = todayCrm();
  const startDate = daysAgoCrm(30);
  console.log(`[taboola:sync] Date range: ${startDate} → ${endDate} (CRM timezone)`);

  let totalCampaigns = 0;
  let totalStatsRows = 0;
  let totalPublisherStatsRows = 0;
  let totalItemStatsRows = 0;
  let accountsSynced = 0;
  const errors: string[] = [];

  for (const accountId of Array.from(connectedIds)) {
    const config = await buildTaboolaConfig(accountId);
    if (!config) {
      errors.push(`Account ${accountId}: missing credentials`);
      continue;
    }

    try {
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: { name: true, currency: true },
      });

      const client = new TaboolaClient(config);
      const accountCurrency = account?.currency ?? "USD";

      // Resolve traffic source
      const taboola = await prisma.trafficSource.findUniqueOrThrow({
        where: { slug: "taboola" },
        select: { id: true },
      });

      console.log(`[taboola:sync] Account ${account?.name}: externalId for bridge = ${config.accountId}`);

      // Resolve or create AdAccount
      const adAccount = await prisma.adAccount.upsert({
        where: {
          trafficSourceId_externalId: {
            trafficSourceId: taboola.id,
            externalId: config.accountId,
          },
        },
        update: {},
        create: {
          name: account?.name ?? `Taboola ${config.accountId}`,
          externalId: config.accountId,
          trafficSourceId: taboola.id,
        },
        select: { id: true },
      });

      // ── Step 1: Sync campaigns ──────────────────────────────────────────

      const response = await client.getCampaigns();
      console.log(`[taboola:sync] Account ${account?.name}: ${response.results.length} campaigns from API`);

      const syncLog = await prisma.syncLog.create({
        data: {
          source: "taboola",
          entityType: "campaigns",
          status: "RUNNING",
          startedAt: new Date(),
        },
      });

      const statusMap: Record<string, string> = {
        RUNNING: "ACTIVE",
        PAUSED: "PAUSED",
        STOPPED: "STOPPED",
        DISABLED: "STOPPED",
        PENDING_APPROVAL: "PENDING_REVIEW",
        REJECTED: "REJECTED",
        ARCHIVED: "ARCHIVED",
      };

      let created = 0;
      let updated = 0;

      // Build externalId → internal id map for stats sync
      const campaignIdMap = new Map<string, string>();

      for (const c of response.results) {
        const dailyBudgetUsd = toUsd(c.daily_cap, accountCurrency);

        const data = {
          name: c.name,
          status: (statusMap[c.status] ?? "ACTIVE") as "ACTIVE" | "PENDING_REVIEW" | "REJECTED" | "PAUSED" | "STOPPED" | "ARCHIVED",
          currency: "USD",
          dailyBudget: dailyBudgetUsd,
          cpcBid: c.cpc != null ? toUsd(c.cpc, accountCurrency) : null,
          lastSyncedAt: new Date(),
        };

        const existing = await prisma.campaign.findUnique({
          where: {
            trafficSourceId_externalId: {
              trafficSourceId: taboola.id,
              externalId: c.id,
            },
          },
        });

        if (existing) {
          await prisma.campaign.update({ where: { id: existing.id }, data });
          campaignIdMap.set(c.id, existing.id);
          updated++;
        } else {
          const newCampaign = await prisma.campaign.create({
            data: {
              ...data,
              externalId: c.id,
              trafficSourceId: taboola.id,
              adAccountId: adAccount.id,
            },
          });
          campaignIdMap.set(c.id, newCampaign.id);
          created++;
        }
      }

      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
          recordsFetched: response.results.length,
          recordsInserted: created,
          recordsUpdated: updated,
        },
      });

      totalCampaigns += response.results.length;

      // ── Step 2: Sync campaign stats (last 30 days) ────────────────────

      try {
        const statsResponse = await client.getCampaignStatsDaily({
          start_date: startDate,
          end_date: endDate,
        });

        console.log(`[taboola:stats] Account ${account?.name}: ${statsResponse.results.length} campaign stat rows`);

        // Auto-create campaigns found in stats but not in /campaigns (deleted campaigns)
        const unknownCampaignIds = new Set<string>();
        for (const row of statsResponse.results) {
          if (!campaignIdMap.has(row.campaign) && !unknownCampaignIds.has(row.campaign)) {
            unknownCampaignIds.add(row.campaign);
            const existing = await prisma.campaign.findUnique({
              where: {
                trafficSourceId_externalId: {
                  trafficSourceId: taboola.id,
                  externalId: row.campaign,
                },
              },
            });
            if (existing) {
              campaignIdMap.set(row.campaign, existing.id);
            } else {
              const newCampaign = await prisma.campaign.create({
                data: {
                  name: row.campaign_name,
                  externalId: row.campaign,
                  trafficSourceId: taboola.id,
                  adAccountId: adAccount.id,
                  status: "STOPPED",
                  currency: "USD",
                  lastSyncedAt: new Date(),
                },
              });
              campaignIdMap.set(row.campaign, newCampaign.id);
              created++;
            }
          }
        }
        if (unknownCampaignIds.size > 0) {
          console.log(`[taboola:stats] Created ${unknownCampaignIds.size} campaigns from stats (deleted in Taboola)`);
        }

        // Upsert campaign stats
        const CHUNK_SIZE = 100;
        for (let i = 0; i < statsResponse.results.length; i += CHUNK_SIZE) {
          const chunk = statsResponse.results.slice(i, i + CHUNK_SIZE);
          await prisma.$transaction(
            chunk.map((row) => {
              const campaignId = campaignIdMap.get(row.campaign)!;
              const date = fromApiDate(extractDate(row.date));
              const spentUsd = toUsdNum(row.spent ?? 0, accountCurrency);

              return prisma.campaignStatsDaily.upsert({
                where: { campaignId_date: { campaignId, date } },
                update: {
                  spend: new Prisma.Decimal(spentUsd),
                  clicks: row.clicks,
                  impressions: row.impressions,
                  cpc: row.cpc != null ? new Prisma.Decimal(row.cpc) : null,
                  cpm: row.cpm != null ? new Prisma.Decimal(row.cpm) : null,
                  ctr: row.ctr != null ? new Prisma.Decimal(row.ctr) : null,
                  currency: "USD",
                },
                create: {
                  campaignId,
                  date,
                  spend: new Prisma.Decimal(spentUsd),
                  clicks: row.clicks,
                  impressions: row.impressions,
                  cpc: row.cpc != null ? new Prisma.Decimal(row.cpc) : null,
                  cpm: row.cpm != null ? new Prisma.Decimal(row.cpm) : null,
                  ctr: row.ctr != null ? new Prisma.Decimal(row.ctr) : null,
                  currency: "USD",
                },
                select: { id: true },
              });
            }),
          );
        }

        totalStatsRows += statsResponse.results.length;
      } catch (statsErr) {
        console.error(`[taboola:stats] Failed to sync campaign stats for ${account?.name}:`, statsErr);
      }

      // ── Step 3: Sync publisher stats (last 30 days) ───────────────────

      try {
        const pubResponse = await client.getPublisherStatsDaily({
          start_date: startDate,
          end_date: endDate,
        });

        console.log(`[taboola:publishers] Account ${account?.name}: ${pubResponse.results.length} publisher stat rows`);

        // Debug: log first raw row to verify field names
        if (pubResponse.results.length > 0) {
          console.log(`[taboola:publishers] FIRST RAW ROW:`, JSON.stringify(pubResponse.results[0]));
        }

        // Build publisher ID map (auto-create publishers for new sites)
        const publisherIdMap = new Map<string, string>();
        const seenSites = new Set<string>();

        for (const row of pubResponse.results) {
          const siteKey = dyn(row, "site", "site_id", "publisher");
          if (!siteKey) {
            console.log(`[taboola:publishers] Row missing site field:`, JSON.stringify(row));
            continue;
          }
          if (seenSites.has(siteKey)) continue;
          seenSites.add(siteKey);

          const existing = await prisma.publisher.findUnique({
            where: {
              trafficSourceId_externalId: {
                trafficSourceId: taboola.id,
                externalId: siteKey,
              },
            },
          });

          if (existing) {
            publisherIdMap.set(siteKey, existing.id);
          } else {
            const siteName = dyn(row, "site_name", "publisher_name") || siteKey;
            const newPub = await prisma.publisher.create({
              data: {
                externalId: siteKey,
                trafficSourceId: taboola.id,
                name: siteName,
                domain: extractDomain(siteName),
              },
            });
            publisherIdMap.set(siteKey, newPub.id);
          }
        }

        // Upsert publisher stats (filter to rows where campaign is known)
        const pubProcessable = pubResponse.results.filter(
          (row) => {
            const cId = dyn(row, "campaign_id", "campaign");
            const sId = dyn(row, "site", "site_id", "publisher");
            return cId && campaignIdMap.has(cId) && sId && publisherIdMap.has(sId);
          },
        );

        console.log(`[taboola:publishers] Processable: ${pubProcessable.length} / ${pubResponse.results.length}`);
        if (pubProcessable.length === 0 && pubResponse.results.length > 0) {
          const sample = pubResponse.results[0];
          const cId = dyn(sample, "campaign_id", "campaign");
          const sId = dyn(sample, "site", "site_id", "publisher");
          console.log(`[taboola:publishers] Filter debug: campaign=${cId} inMap=${cId ? campaignIdMap.has(cId) : 'N/A'}, site=${sId} inMap=${sId ? publisherIdMap.has(sId) : 'N/A'}`);
          console.log(`[taboola:publishers] campaignIdMap keys (first 5):`, Array.from(campaignIdMap.keys()).slice(0, 5));
        }

        const PUB_CHUNK = 50;
        for (let i = 0; i < pubProcessable.length; i += PUB_CHUNK) {
          const chunk = pubProcessable.slice(i, i + PUB_CHUNK);
          await prisma.$transaction(
            chunk.map((row) => {
              const publisherId = publisherIdMap.get(dyn(row, "site", "site_id", "publisher")!)!;
              const campaignId = campaignIdMap.get(dyn(row, "campaign_id", "campaign")!)!;
              const date = fromApiDate(extractDate(row.date));
              const rawGeo = dyn(row, "country", "country_code", "geo") ?? "";
              const geo = /^[A-Z]{2}$/.test(rawGeo) ? rawGeo : "XX";
              const spentUsd = toUsdNum(row.spent ?? 0, accountCurrency);

              return prisma.publisherStatsDaily.upsert({
                where: {
                  publisherId_campaignId_date_geo: { publisherId, campaignId, date, geo },
                },
                update: {
                  spend: new Prisma.Decimal(spentUsd),
                  clicks: row.clicks,
                  impressions: row.impressions,
                  cpc: row.cpc != null ? new Prisma.Decimal(row.cpc) : null,
                  ctr: row.ctr != null ? new Prisma.Decimal(row.ctr) : null,
                  currency: "USD",
                },
                create: {
                  publisherId,
                  campaignId,
                  date,
                  geo,
                  spend: new Prisma.Decimal(spentUsd),
                  clicks: row.clicks,
                  impressions: row.impressions,
                  cpc: row.cpc != null ? new Prisma.Decimal(row.cpc) : null,
                  ctr: row.ctr != null ? new Prisma.Decimal(row.ctr) : null,
                  currency: "USD",
                },
                select: { id: true },
              });
            }),
          );
        }

        totalPublisherStatsRows += pubProcessable.length;
      } catch (pubErr) {
        console.error(`[taboola:publishers] Failed to sync publisher stats for ${account?.name}:`, pubErr);
      }

      // ── Step 4: Sync campaign items + item stats ──────────────────────

      try {
        const itemStatusMap: Record<string, "ACTIVE" | "PAUSED" | "STOPPED" | "ARCHIVED"> = {
          RUNNING: "ACTIVE",
          CRAWLING: "ACTIVE",
          PAUSED: "PAUSED",
          STOPPED: "STOPPED",
          BLOCKED: "STOPPED",
        };

        // Fetch items for active/paused campaigns to limit API calls
        // Also include campaigns with stats in last 30 days (some may be "STOPPED" but still have recent data)
        const activeCampaignExternalIds = response.results
          .filter((c) => c.status === "RUNNING" || c.status === "PAUSED")
          .map((c) => c.id);
        console.log(`[taboola:items] Active/paused campaigns for item fetch: ${activeCampaignExternalIds.length}`);

        const itemIdMap = new Map<string, string>(); // externalId → internal id

        for (const campExtId of activeCampaignExternalIds) {
          const campInternalId = campaignIdMap.get(campExtId);
          if (!campInternalId) continue;

          try {
            const itemsResponse = await client.getCampaignItems(campExtId);

            for (const item of itemsResponse.results) {
              const itemData = {
                title: item.title,
                url: item.url,
                thumbnailUrl: item.thumbnail_url,
                status: itemStatusMap[item.status] ?? "ACTIVE",
                lastSyncedAt: new Date(),
              };

              const existingItem = await prisma.campaignItem.findUnique({
                where: {
                  campaignId_externalId: {
                    campaignId: campInternalId,
                    externalId: item.id,
                  },
                },
              });

              if (existingItem) {
                await prisma.campaignItem.update({ where: { id: existingItem.id }, data: itemData });
                itemIdMap.set(item.id, existingItem.id);
              } else {
                const newItem = await prisma.campaignItem.create({
                  data: {
                    ...itemData,
                    externalId: item.id,
                    campaignId: campInternalId,
                  },
                });
                itemIdMap.set(item.id, newItem.id);
              }
            }
          } catch (itemErr) {
            console.error(`[taboola:items] Failed to fetch items for campaign ${campExtId}:`, itemErr);
          }
        }

        console.log(`[taboola:items] Account ${account?.name}: ${itemIdMap.size} items synced`);

        // Fetch item stats if we have items (aggregated, not daily — use endDate as snapshot date)
        if (itemIdMap.size > 0) {
          const itemStatsResponse = await client.getItemStats({
            start_date: startDate,
            end_date: endDate,
          });

          console.log(`[taboola:items] ${itemStatsResponse.results.length} item stat rows from API`);
          if (itemStatsResponse.results.length > 0) {
            console.log(`[taboola:items] FIRST RAW ROW:`, JSON.stringify(itemStatsResponse.results[0]));
          }

          const itemProcessable = itemStatsResponse.results.filter(
            (row) => {
              const iId = dyn(row, "item", "item_id", "content_id");
              return iId && itemIdMap.has(iId);
            },
          );

          // Item stats are aggregated for the date range, store with endDate as snapshot
          const snapshotDate = fromApiDate(endDate);

          const ITEM_CHUNK = 100;
          for (let i = 0; i < itemProcessable.length; i += ITEM_CHUNK) {
            const chunk = itemProcessable.slice(i, i + ITEM_CHUNK);
            await prisma.$transaction(
              chunk.map((row) => {
                const campaignItemId = itemIdMap.get(dyn(row, "item", "item_id", "content_id")!)!;
                const spentUsd = toUsdNum(row.spent ?? 0, accountCurrency);

                return prisma.campaignItemStatsDaily.upsert({
                  where: {
                    campaignItemId_date: { campaignItemId, date: snapshotDate },
                  },
                  update: {
                    spend: new Prisma.Decimal(spentUsd),
                    clicks: row.clicks,
                    impressions: row.impressions,
                    cpc: row.cpc != null ? new Prisma.Decimal(row.cpc) : null,
                    ctr: row.ctr != null ? new Prisma.Decimal(row.ctr) : null,
                    currency: "USD",
                  },
                  create: {
                    campaignItemId,
                    date: snapshotDate,
                    spend: new Prisma.Decimal(spentUsd),
                    clicks: row.clicks,
                    impressions: row.impressions,
                    cpc: row.cpc != null ? new Prisma.Decimal(row.cpc) : null,
                    ctr: row.ctr != null ? new Prisma.Decimal(row.ctr) : null,
                    currency: "USD",
                  },
                  select: { id: true },
                });
              }),
            );
          }

          totalItemStatsRows += itemProcessable.length;
        }
      } catch (itemErr) {
        console.error(`[taboola:items] Failed to sync items for ${account?.name}:`, itemErr);
      }

      accountsSynced++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: { name: true },
      });
      errors.push(`${account?.name ?? accountId}: ${msg}`);
    }
  }

  revalidatePath("/integrations/taboola");
  revalidatePath("/publishers");

  if (accountsSynced === 0 && errors.length > 0) {
    return { success: false, error: errors.join("; ") };
  }

  return {
    success: true,
    accounts: accountsSynced,
    totalCampaigns,
    statsRows: totalStatsRows,
    publisherStatsRows: totalPublisherStatsRows,
    itemStatsRows: totalItemStatsRows,
  };
}
