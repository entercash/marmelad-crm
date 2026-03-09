/**
 * Dashboard data-access layer.
 *
 * Aggregates the 4 core business metrics:
 *   1. Spent     — ad spend (CampaignStatsDaily) + manual expenses (Expense)
 *   2. Received  — net revenue from conversions (ConversionStatsDaily)
 *   3. ROI       — ((Received − Spent) / Spent) × 100
 *   4. Result    — Received − Spent
 *
 * All queries run in parallel via Promise.all.
 * Called only from the Dashboard Server Component — never imported by client code.
 */

import { prisma } from "@/lib/prisma";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DashboardSummary = {
  /** Total ad spend (platforms) + manual expenses */
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
    const [adSpendAgg, expenseAgg, revenueAgg] = await Promise.all([
      // Sum of all campaign ad spend (Taboola etc.)
      prisma.campaignStatsDaily.aggregate({
        _sum: { spend: true },
      }),

      // Sum of all manual expenses
      prisma.expense.aggregate({
        _sum: { amount: true },
      }),

      // Sum of all net revenue from conversion stats
      prisma.conversionStatsDaily.aggregate({
        _sum: { netRevenue: true },
      }),
    ]);

    const adSpend  = Number(adSpendAgg._sum.spend      ?? 0);
    const expenses = Number(expenseAgg._sum.amount      ?? 0);
    const received = Number(revenueAgg._sum.netRevenue  ?? 0);

    const spent  = adSpend + expenses;
    const result = received - spent;
    const roi    = spent > 0 ? ((received - spent) / spent) * 100 : null;

    return { spent, received, roi, result };
  } catch (err) {
    console.error("[getDashboardSummary] Database query failed:", err);
    return EMPTY_SUMMARY;
  }
}
