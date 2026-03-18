/**
 * Taboola integration — data-access layer.
 *
 * Queries for the Taboola integration overview page.
 * Never imported by client components.
 */

import { prisma } from "@/lib/prisma";
import {
  getTaboolaConnectedAccountIds,
  getTaboolaAccountSettings,
} from "@/features/integration-settings/queries";

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

  // Build mapping: Account.id → taboolaAccountId (from integration settings)
  const accountToTaboolaId = new Map<string, string>();
  for (const accountId of Array.from(connectedIds)) {
    const settings = await getTaboolaAccountSettings(accountId);
    if (settings.taboolaAccountId) {
      accountToTaboolaId.set(accountId, settings.taboolaAccountId);
    }
  }

  // Fetch campaign counts per adAccount (keyed by AdAccount.externalId = taboolaAccountId)
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

  // Build adAccount stats map (by AdAccount.externalId)
  const adAccountStatsMap = new Map<string, { campaignCount: number; activeCount: number }>();
  for (const aa of adAccounts) {
    const activeCount = aa.campaigns.filter((c) => c.status === "ACTIVE").length;
    adAccountStatsMap.set(aa.externalId, {
      campaignCount: aa._count.campaigns,
      activeCount,
    });
  }

  // Fetch spend aggregates per adAccount
  const spendAgg = await prisma.campaignStatsDaily.groupBy({
    by: ["campaignId"],
    _sum: { spend: true },
    where: {
      campaign: { trafficSourceId: taboola.id },
    },
  });

  // Map campaignId → AdAccount.externalId
  const campaignToAdAccount = new Map<string, string>();
  const campaignAdAccounts = await prisma.campaign.findMany({
    where: { trafficSourceId: taboola.id },
    select: { id: true, adAccount: { select: { externalId: true } } },
  });
  for (const c of campaignAdAccounts) {
    campaignToAdAccount.set(c.id, c.adAccount.externalId);
  }

  // Aggregate spend per AdAccount.externalId
  const spendByAdAccountExt = new Map<string, number>();
  for (const row of spendAgg) {
    const adAccountExt = campaignToAdAccount.get(row.campaignId);
    if (!adAccountExt) continue;
    const current = spendByAdAccountExt.get(adAccountExt) ?? 0;
    spendByAdAccountExt.set(adAccountExt, current + Number(row._sum.spend ?? 0));
  }

  return accounts.map((a) => {
    // Match via taboolaAccountId from settings → AdAccount.externalId
    const taboolaId = accountToTaboolaId.get(a.id);
    const adStats = taboolaId ? adAccountStatsMap.get(taboolaId) : undefined;
    const spend = taboolaId ? (spendByAdAccountExt.get(taboolaId) ?? 0) : 0;

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

// ─── Campaign status counts ─────────────────────────────────────────────────────

export type CampaignStatusCounts = Record<string, number> & { ALL: number };

export async function getTaboolaCampaignCounts(): Promise<CampaignStatusCounts> {
  const taboola = await prisma.trafficSource.findFirst({
    where: { slug: "taboola" },
    select: { id: true },
  });
  if (!taboola) return { ALL: 0 };

  const groups = await prisma.campaign.groupBy({
    by: ["status"],
    where: { trafficSourceId: taboola.id },
    _count: true,
  });

  const counts: CampaignStatusCounts = { ALL: 0 };
  for (const g of groups) {
    counts[g.status] = g._count;
    counts.ALL += g._count;
  }
  return counts;
}

// ─── Campaign list ──────────────────────────────────────────────────────────────

export async function getTaboolaCampaigns(
  statusFilter?: string,
  page = 1,
  pageSize = 10,
): Promise<{ rows: TaboolaCampaignRow[]; total: number }> {
  const taboola = await prisma.trafficSource.findFirst({
    where: { slug: "taboola" },
    select: { id: true },
  });

  if (!taboola) return { rows: [], total: 0 };

  const where: Record<string, unknown> = { trafficSourceId: taboola.id };
  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter;
  }

  const total = await prisma.campaign.count({ where });

  const campaigns = await prisma.campaign.findMany({
    where,
    orderBy: [{ status: "asc" }, { name: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
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

  return {
    rows: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      currency: c.currency,
      dailyBudget: c.dailyBudget !== null ? Number(c.dailyBudget) : null,
      totalSpend: spendMap.get(c.id) ?? 0,
      adAccountName: c.adAccount?.name ?? null,
      lastSyncedAt: c.lastSyncedAt,
      updatedAt: c.updatedAt,
    })),
    total,
  };
}
