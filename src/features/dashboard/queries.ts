/**
 * Dashboard data-access layer.
 *
 * All queries run in parallel via Promise.all so total latency is bounded
 * by the slowest individual query, not by the sum.
 *
 * Called only from the Dashboard Server Component — never imported by client code.
 */

import { prisma } from "@/lib/prisma";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type LastSync = {
  source:     string;
  entityType: string;
  status:     string;
  startedAt:  Date;
} | null;

export type DashboardSummary = {
  campaigns: {
    total:  number;
    active: number;
    paused: number;
  };
  publishers:        number;
  adAccounts:        number;
  expenses:          number;
  expenseCategories: number;
  syncLogs: {
    last24hCount: number;
    latest:       LastSync;
  };
};

// ─── Query ─────────────────────────────────────────────────────────────────────

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    campaignTotal,
    campaignActive,
    campaignPaused,
    publisherCount,
    adAccountCount,
    expenseCount,
    expenseCategoryCount,
    syncLast24h,
    latestSync,
  ] = await Promise.all([
    prisma.campaign.count(),
    prisma.campaign.count({ where: { status: "ACTIVE" } }),
    prisma.campaign.count({ where: { status: "PAUSED" } }),
    prisma.publisher.count(),
    prisma.adAccount.count(),
    prisma.expense.count(),
    prisma.expenseCategory.count(),
    prisma.syncLog.count({
      where: { startedAt: { gte: since24h } },
    }),
    prisma.syncLog.findFirst({
      orderBy: { startedAt: "desc" },
      select: {
        source:     true,
        entityType: true,
        status:     true,
        startedAt:  true,
      },
    }),
  ]);

  return {
    campaigns: {
      total:  campaignTotal,
      active: campaignActive,
      paused: campaignPaused,
    },
    publishers:        publisherCount,
    adAccounts:        adAccountCount,
    expenses:          expenseCount,
    expenseCategories: expenseCategoryCount,
    syncLogs: {
      last24hCount: syncLast24h,
      latest:       latestSync,
    },
  };
}
