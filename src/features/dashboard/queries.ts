/**
 * Dashboard data-access layer.
 *
 * Aggregates the 4 core business metrics:
 *   1. Spent     — per-account: accountCostUsd×(1+cryptoPct/100) + totalSpentUsd
 *   2. Received  — net revenue from conversions (ConversionStatsDaily)
 *   3. ROI       — ((Received − Spent) / Spent) × 100
 *   4. Result    — Received − Spent
 *
 * Called only from the Dashboard Server Component — never imported by client code.
 */

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

// ─── Query ─────────────────────────────────────────────────────────────────────

export async function getDashboardSummary(): Promise<DashboardSummary> {
  try {
    const [accounts, revenueAgg, campaignStats, expenseSummary, seoRevenue] = await Promise.all([
      getAccounts(),
      prisma.conversionStatsDaily.aggregate({
        _sum: { netRevenue: true },
      }),
      getCampaignLinkStats(),
      getExpenseSummary(),
      getSeoTotalRevenue(),
    ]);

    // Per account: accountCost × (1 + cryptoPct/100) + totalSpentUsd
    let spent = 0;
    for (const a of accounts) {
      const accountCost = a.accountCostUsd ?? 0;
      const cryptoPct = a.cryptoPaymentPercent ?? 0;
      const accountCostWithCrypto = accountCost * (1 + cryptoPct / 100);
      spent += accountCostWithCrypto + a.totalSpentUsd;
    }

    // Add manual expenses
    spent += expenseSummary.totalAmount;

    // Revenue from ConversionStatsDaily + campaign link mappings
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
