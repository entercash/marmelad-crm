"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { guardWrite } from "@/lib/auth-guard";
import { TaboolaClient } from "@/integrations/taboola/client";
import type { TaboolaConfig } from "@/integrations/taboola/client";
import { fromApiDate } from "@/lib/date";
import {
  getTaboolaConnectedAccountIds,
  getTaboolaAccountSettings,
} from "@/features/integration-settings/queries";
import { prisma } from "@/lib/prisma";

// ─── Result type ────────────────────────────────────────────────────────────

export type SyncTaboolaResult =
  | { success: true; accounts: number; totalCampaigns: number; statsRows: number }
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

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ─── Main action ────────────────────────────────────────────────────────────

/**
 * Sync campaigns + campaign stats (last 30 days) for all connected Taboola accounts.
 */
export async function syncAllTaboolaCampaigns(): Promise<SyncTaboolaResult> {
  const denied = await guardWrite();
  if (denied) return { success: false, error: !denied.success ? denied.error : "Access denied" };

  const connectedIds = await getTaboolaConnectedAccountIds();
  if (connectedIds.size === 0) {
    return { success: false, error: "No Taboola accounts configured. Go to Settings to connect." };
  }

  let totalCampaigns = 0;
  let totalStatsRows = 0;
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

      // Debug: log raw campaign data with actual field names
      console.log(`[taboola:sync] Account ${account?.name}: ${response.results.length} campaigns from API`);
      if (response.results.length > 0) {
        const sample = response.results[0] as unknown as Record<string, unknown>;
        console.log(`[taboola:sync] Sample campaign keys:`, Object.keys(sample));
        console.log(`[taboola:sync] Sample campaign (raw):`, JSON.stringify(sample).slice(0, 500));
      }

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
        // Convert daily_cap to USD
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
          start_date: formatDate(daysAgo(30)),
          end_date: formatDate(new Date()),
        });

        // Debug: log raw stats data with actual field names
        console.log(`[taboola:stats] Account ${account?.name}: ${statsResponse.results.length} stat rows from API`);
        if (statsResponse.results.length > 0) {
          const sample = statsResponse.results[0] as unknown as Record<string, unknown>;
          console.log(`[taboola:stats] Sample stat row keys:`, Object.keys(sample));
          console.log(`[taboola:stats] Sample stat row (raw):`, JSON.stringify(sample).slice(0, 500));
          console.log(`[taboola:stats] campaignIdMap keys (first 5):`, Array.from(campaignIdMap.keys()).slice(0, 5));
        }

        // Create campaign records for IDs found in stats but not in /campaigns (deleted campaigns)
        const unknownCampaignIds = new Set<string>();
        for (const row of statsResponse.results) {
          if (!campaignIdMap.has(row.campaign) && !unknownCampaignIds.has(row.campaign)) {
            unknownCampaignIds.add(row.campaign);
            // Create campaign from stats data (Taboola deleted it but stats remain)
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

        const processable = statsResponse.results;
        console.log(`[taboola:stats] Processable rows: ${processable.length}`);

        const CHUNK_SIZE = 100;
        for (let i = 0; i < processable.length; i += CHUNK_SIZE) {
          const chunk = processable.slice(i, i + CHUNK_SIZE);

          await prisma.$transaction(
            chunk.map((row) => {
              const campaignId = campaignIdMap.get(row.campaign)!;
              // Taboola date format: "YYYY-MM-DD HH:mm:ss.S" → extract date part
              const date = fromApiDate(row.date.slice(0, 10));
              // Convert spend to USD (stats use account currency)
              const spentUsd = (row.spent ?? 0) * (USD_RATES[accountCurrency] ?? 1);

              return prisma.campaignStatsDaily.upsert({
                where: { campaignId_date: { campaignId, date } },
                update: {
                  spend: new Prisma.Decimal(Math.round(spentUsd * 100) / 100),
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
                  spend: new Prisma.Decimal(Math.round(spentUsd * 100) / 100),
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

        totalStatsRows += processable.length;
      } catch (statsErr) {
        // Don't fail the whole sync if stats fail
        console.error(`[taboola:stats] Failed to sync stats for ${account?.name}:`, statsErr);
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

  if (accountsSynced === 0 && errors.length > 0) {
    return { success: false, error: errors.join("; ") };
  }

  return { success: true, accounts: accountsSynced, totalCampaigns, statsRows: totalStatsRows };
}
