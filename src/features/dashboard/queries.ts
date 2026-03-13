/**
 * Dashboard data-access layer.
 *
 * Aggregates the 4 core business metrics:
 *   1. Spent     — ad spend (commission-adjusted) + account costs + expenses
 *   2. Received  — net revenue from conversions + campaign links + SEO
 *   3. ROI       — ((Received − Spent) / Spent) × 100
 *   4. Result    — Received − Spent
 *
 * Supports optional date range filtering. When no dates provided, shows all-time data.
 * Called only from the Dashboard Server Component — never imported by client code.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccounts } from "@/features/ad-accounts/queries";
import { getCampaignLinkStats } from "@/features/campaign-links/queries";
import { getExpenseSummary } from "@/features/expenses/queries";
import { getSeoTotalRevenue } from "@/features/seo/queries";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DashboardSummary = {
  /** Total spent across all accounts (account cost + ad spend with commissions) */
  spent:    number;
  /** Total net revenue from conversions */
  received: number;
  /** ((received − spent) / spent) × 100; null when spent = 0 */
  roi:      number | null;
  /** received − spent (can be negative) */
  result:   number;
};

// ─── Fallback ─────────────────────────────────────────────────────────────────

const EMPTY_SUMMARY: DashboardSummary = {
  spent: 0, received: 0, roi: null, result: 0,
};

// ─── Ad spend with commissions (date-filterable) ─────────────────────────────

async function getDashboardAdSpend(
  dateFrom?: string,
  dateTo?: string,
): Promise<number> {
  const dateClause = dateFrom && dateTo
    ? Prisma.sql`WHERE t."day" >= ${dateFrom}::date AND t."day" <= ${dateTo}::date`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<{ total: Prisma.Decimal }[]>(
    Prisma.sql`
      WITH acct_mult AS (
        SELECT DISTINCT ON (a."externalId")
          a."externalId",
          (1 + COALESCE(ag."commissionPercent", 0) / 100) *
          (1 + COALESCE(ag."cryptoPaymentPercent", 0) / 100) as multiplier
        FROM "accounts" a
        LEFT JOIN "agencies" ag ON ag."id" = a."agencyId"
        WHERE a."externalId" IS NOT NULL
        ORDER BY a."externalId"
      )
      SELECT COALESCE(SUM(t."spentUsd" * COALESCE(am.multiplier, 1)), 0) as total
      FROM "taboola_csv_rows" t
      LEFT JOIN acct_mult am ON am."externalId" = t."accountExternalId"
      ${dateClause}
    `,
  );
  return Number(rows[0]?.total ?? 0);
}

// ─── Query ─────────────────────────────────────────────────────────────────────

export async function getDashboardSummary(
  dateFrom?: string,
  dateTo?: string,
): Promise<DashboardSummary> {
  try {
    const isAllTime = !dateFrom || !dateTo;

    const dateFilter = dateFrom && dateTo
      ? { date: { gte: new Date(`${dateFrom}T00:00:00.000Z`), lte: new Date(`${dateTo}T00:00:00.000Z`) } }
      : {};

    const [adSpend, revenueAgg, campaignStats, expenseSummary, seoRevenue] = await Promise.all([
      getDashboardAdSpend(dateFrom, dateTo),
      prisma.conversionStatsDaily.aggregate({
        _sum: { netRevenue: true },
        where: dateFilter,
      }),
      getCampaignLinkStats(dateFrom, dateTo),
      getExpenseSummary(dateFrom, dateTo),
      getSeoTotalRevenue(dateFrom, dateTo),
    ]);

    let spent = adSpend;

    // Account purchase costs are one-time, not daily — only include in all-time view
    if (isAllTime) {
      const accounts = await getAccounts();
      for (const a of accounts) {
        const accountCost = a.accountCostUsd ?? 0;
        const cryptoPct = a.cryptoPaymentPercent ?? 0;
        spent += accountCost * (1 + cryptoPct / 100);
      }
    }

    // Add manual expenses
    spent += expenseSummary.totalAmount;

    // Revenue from ConversionStatsDaily + campaign link mappings + SEO
    const conversionRevenue = Number(revenueAgg._sum.netRevenue ?? 0);
    const campaignRevenue = campaignStats.reduce(
      (sum, s) => sum + (s.revenue ?? 0),
      0,
    );
    const received = conversionRevenue + campaignRevenue + seoRevenue;
    const result   = received - spent;
    const roi      = spent > 0 ? ((received - spent) / spent) * 100 : null;

    return { spent, received, roi, result };
  } catch (err) {
    console.error("[getDashboardSummary] Database query failed:", err);
    return EMPTY_SUMMARY;
  }
}
