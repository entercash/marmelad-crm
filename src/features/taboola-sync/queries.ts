/**
 * Taboola integration — data-access layer.
 *
 * Queries for the Taboola integration overview page.
 * Never imported by client components.
 */

import { prisma } from "@/lib/prisma";
import { getTaboolaConnectedAccountIds } from "@/features/integration-settings/queries";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type TaboolaAccountRow = {
  id: string;
  name: string;
  externalId: string | null;
  connected: boolean;
  campaignCount: number;
  activeCampaignCount: number;
  totalSpend: number;
};

export type TaboolaCampaignRow = {
  id: string;
  name: string;
  status: string;
  currency: string;
  dailyBudget: number | null;
  totalSpend: number;
  adAccountName: string | null;
  lastSyncedAt: Date | null;
  updatedAt: Date;
};

export type TaboolaOverviewStats = {
  connectedAccounts: number;
  totalCampaigns: number;
  activeCampaigns: number;
  lastSyncAt: Date | null;
};

// ─── Configuration check ────────────────────────────────────────────────────────

/** Returns true if at least one Account has Taboola API credentials saved. */
export async function isTaboolaConfigured(): Promise<boolean> {
  const connectedIds = await getTaboolaConnectedAccountIds();
  return connectedIds.size > 0;
}

// ─── Overview stats ─────────────────────────────────────────────────────────────

export async function getTaboolaOverviewStats(): Promise<TaboolaOverviewStats> {
  const [connectedIds, taboola] = await Promise.all([
    getTaboolaConnectedAccountIds(),
    prisma.trafficSource.findFirst({ where: { slug: "taboola" }, select: { id: true } }),
  ]);

  if (!taboola) {
    return { connectedAccounts: connectedIds.size, totalCampaigns: 0, activeCampaigns: 0, lastSyncAt: null };
  }

  const [totalCampaigns, activeCampaigns, lastSync] = await Promise.all([
    prisma.campaign.count({ where: { trafficSourceId: taboola.id } }),
    prisma.campaign.count({ where: { trafficSourceId: taboola.id, status: "ACTIVE" } }),
    prisma.syncLog.findFirst({
      where: { source: "taboola", status: { in: ["SUCCESS", "PARTIAL"] } },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
  ]);

  return {
    connectedAccounts: connectedIds.size,
    totalCampaigns,
    activeCampaigns,
    lastSyncAt: lastSync?.finishedAt ?? null,
  };
}

// ─── Account list ───────────────────────────────────────────────────────────────

export async function getTaboolaAccounts(): Promise<TaboolaAccountRow[]> {
  const [accounts, connectedIds, taboola] = await Promise.all([
    prisma.account.findMany({
      where: { platform: "TABOOLA" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, externalId: true },
    }),
    getTaboolaConnectedAccountIds(),
    prisma.trafficSource.findFirst({ where: { slug: "taboola" }, select: { id: true } }),
  ]);

  // If no taboola traffic source, return accounts with zero stats
  if (!taboola) {
    return accounts.map((a) => ({
      id: a.id,
      name: a.name,
      externalId: a.externalId,
      connected: connectedIds.has(a.id),
      campaignCount: 0,
      activeCampaignCount: 0,
      totalSpend: 0,
    }));
  }

  // Fetch campaign counts and spend per adAccount (keyed by externalId)
  const adAccounts = await prisma.adAccount.findMany({
    where: { trafficSourceId: taboola.id },
    select: {
      externalId: true,
      campaigns: {
        select: { status: true },
      },
      _count: { select: { campaigns: true } },
    },
  });

  // Fetch spend aggregates per adAccount
  const spendAgg = await prisma.campaignStatsDaily.groupBy({
    by: ["campaignId"],
    _sum: { spend: true },
    where: {
      campaign: { trafficSourceId: taboola.id },
    },
  });

  // Map campaignId → adAccount externalId
  const campaignToAdAccount = new Map<string, string>();
  const adAccountCampaignIds = await prisma.campaign.findMany({
    where: { trafficSourceId: taboola.id },
    select: { id: true, adAccount: { select: { externalId: true } } },
  });
  for (const c of adAccountCampaignIds) {
    campaignToAdAccount.set(c.id, c.adAccount.externalId);
  }

  // Aggregate spend per adAccount externalId
  const spendByAdAccountExt = new Map<string, number>();
  for (const row of spendAgg) {
    const adAccountExt = campaignToAdAccount.get(row.campaignId);
    if (!adAccountExt) continue;
    const current = spendByAdAccountExt.get(adAccountExt) ?? 0;
    spendByAdAccountExt.set(adAccountExt, current + Number(row._sum.spend ?? 0));
  }

  // Build adAccount stats map (by externalId)
  const adAccountStatsMap = new Map<string, { campaignCount: number; activeCount: number }>();
  for (const aa of adAccounts) {
    const activeCount = aa.campaigns.filter((c) => c.status === "ACTIVE").length;
    adAccountStatsMap.set(aa.externalId, {
      campaignCount: aa._count.campaigns,
      activeCount,
    });
  }

  return accounts.map((a) => {
    // Try to match Account.externalId to AdAccount.externalId
    const adStats = a.externalId ? adAccountStatsMap.get(a.externalId) : undefined;
    const spend = a.externalId ? (spendByAdAccountExt.get(a.externalId) ?? 0) : 0;

    return {
      id: a.id,
      name: a.name,
      externalId: a.externalId,
      connected: connectedIds.has(a.id),
      campaignCount: adStats?.campaignCount ?? 0,
      activeCampaignCount: adStats?.activeCount ?? 0,
      totalSpend: spend,
    };
  });
}

// ─── Campaign list ──────────────────────────────────────────────────────────────

export async function getTaboolaCampaigns(): Promise<TaboolaCampaignRow[]> {
  const taboola = await prisma.trafficSource.findFirst({
    where: { slug: "taboola" },
    select: { id: true },
  });

  if (!taboola) return [];

  const campaigns = await prisma.campaign.findMany({
    where: { trafficSourceId: taboola.id },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      status: true,
      currency: true,
      dailyBudget: true,
      lastSyncedAt: true,
      updatedAt: true,
      adAccount: { select: { name: true } },
    },
  });

  // Fetch total spend per campaign
  const campaignIds = campaigns.map((c) => c.id);
  const spendAgg = await prisma.campaignStatsDaily.groupBy({
    by: ["campaignId"],
    _sum: { spend: true },
    where: { campaignId: { in: campaignIds } },
  });
  const spendMap = new Map(spendAgg.map((r) => [r.campaignId, Number(r._sum.spend ?? 0)]));

  return campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    currency: c.currency,
    dailyBudget: c.dailyBudget !== null ? Number(c.dailyBudget) : null,
    totalSpend: spendMap.get(c.id) ?? 0,
    adAccountName: c.adAccount?.name ?? null,
    lastSyncedAt: c.lastSyncedAt,
    updatedAt: c.updatedAt,
  }));
}
