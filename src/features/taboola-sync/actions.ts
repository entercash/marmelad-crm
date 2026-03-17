"use server";

import { revalidatePath } from "next/cache";

import { guardWrite } from "@/lib/auth-guard";
import { TaboolaClient } from "@/integrations/taboola/client";
import type { TaboolaConfig } from "@/integrations/taboola/client";
import {
  getTaboolaConnectedAccountIds,
  getTaboolaAccountSettings,
} from "@/features/integration-settings/queries";
import { prisma } from "@/lib/prisma";

// ─── Result type ────────────────────────────────────────────────────────────

export type SyncTaboolaResult =
  | { success: true; accounts: number; totalCampaigns: number }
  | { success: false; error: string };

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

// ─── Main action ────────────────────────────────────────────────────────────

/**
 * Sync campaigns for all connected Taboola accounts.
 * Loads credentials from DB, creates a client per account, fetches campaigns.
 */
export async function syncAllTaboolaCampaigns(): Promise<SyncTaboolaResult> {
  const denied = await guardWrite();
  if (denied) return { success: false, error: !denied.success ? denied.error : "Access denied" };

  const connectedIds = await getTaboolaConnectedAccountIds();
  if (connectedIds.size === 0) {
    return { success: false, error: "No Taboola accounts configured. Go to Settings to connect." };
  }

  let totalCampaigns = 0;
  let accountsSynced = 0;
  const errors: string[] = [];

  for (const accountId of Array.from(connectedIds)) {
    const config = await buildTaboolaConfig(accountId);
    if (!config) {
      errors.push(`Account ${accountId}: missing credentials`);
      continue;
    }

    try {
      // Get account name for logging
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: { name: true },
      });

      const client = new TaboolaClient(config);
      const response = await client.getCampaigns();

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

      // Create sync log
      const syncLog = await prisma.syncLog.create({
        data: {
          source: "taboola",
          entityType: "campaigns",
          status: "RUNNING",
          startedAt: new Date(),
        },
      });

      // Upsert campaigns
      let created = 0;
      let updated = 0;

      for (const c of response.results) {
        const statusMap: Record<string, string> = {
          RUNNING: "ACTIVE",
          PAUSED: "PAUSED",
          STOPPED: "STOPPED",
          DISABLED: "STOPPED",
          PENDING_APPROVAL: "PAUSED",
          ARCHIVED: "ARCHIVED",
        };

        const existing = await prisma.campaign.findUnique({
          where: {
            trafficSourceId_externalId: {
              trafficSourceId: taboola.id,
              externalId: c.id,
            },
          },
        });

        const data = {
          name: c.name,
          status: (statusMap[c.status] ?? "ACTIVE") as "ACTIVE" | "PAUSED" | "STOPPED" | "ARCHIVED",
          dailyBudget: c.daily_budget ?? null,
          cpcBid: c.cpc ?? null,
          lastSyncedAt: new Date(),
        };

        if (existing) {
          await prisma.campaign.update({
            where: { id: existing.id },
            data,
          });
          updated++;
        } else {
          await prisma.campaign.create({
            data: {
              ...data,
              externalId: c.id,
              trafficSourceId: taboola.id,
              adAccountId: adAccount.id,
            },
          });
          created++;
        }
      }

      // Complete sync log
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

  return { success: true, accounts: accountsSynced, totalCampaigns };
}
