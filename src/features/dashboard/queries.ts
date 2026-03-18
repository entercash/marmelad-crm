/**
 * Dashboard data-access layer.
 *
 * Aggregates core business metrics:
 *   1. Spent     — ad spend (commission-adjusted) + account costs + expenses
 *   2. Received  — net revenue from conversions + campaign links + SEO
 *   3. ROI       — ((Received − Spent) / Spent) × 100
 *   4. Result    — Received − Spent
 *   5. Conversions / CPA — count & cost per acquisition
 *
 * Data source: campaign_stats_daily (via Taboola API sync).
 * Called only from the Dashboard Server Component — never imported by client code.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ACCT_MULT_CTE } from "@/lib/spend-queries";
import { getAccounts } from "@/features/ad-accounts/queries";
import { getCampaignLinkStats, getCampaignLinkDailyRevenue } from "@/features/campaign-links/queries";
import { getExpenseSummary } from "@/features/expenses/queries";
import { getSeoTotalRevenue } from "@/features/seo/queries";
import { getBalanceSummaries } from "@/features/balances/queries";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DashboardSummary = {
  /** Total spent across all accounts (account cost + ad spend with commissions) */
  spent:       number;
  /** Total net revenue from conversions */
  received:    number;
  /** ((received − spent) / spent) × 100; null when spent = 0 */
  roi:         number | null;
  /** received − spent (can be negative) */
  result:      number;
  /** Total conversions count */
  conversions: number;
  /** Cost per acquisition (spent / conversions); null when 0 conversions */
  cpa:         number | null;
};

export type DashboardTimePoint = {
  date:    string; // "YYYY-MM-DD"
  spend:   number;
  revenue: number;
};

export type AgencySpendRow = {
  agencyName:   string;
  totalSpend:   number;
  percentOfMax: number; // 0–100
};

export type AccountSpendRow = {
  accountName: string;
  agencyName:  string | null;
  totalSpend:  number;
};

export type DashboardAlert = {
  type:        "low_balance" | "negative_roi";
  severity:    "warning" | "critical";
  title:       string;
  description: string;
};

// ─── Fallback ─────────────────────────────────────────────────────────────────

const EMPTY_SUMMARY: DashboardSummary = {
  spent: 0, received: 0, roi: null, result: 0, conversions: 0, cpa: null,
};

// ─── Ad spend with commissions (total) ──────────────────────────────────────

async function getDashboardAdSpend(
  dateFrom?: string,
  dateTo?: string,
): Promise<number> {
  const dateClause = dateFrom && dateTo
    ? Prisma.sql`WHERE csd."date" >= ${dateFrom}::date AND csd."date" <= ${dateTo}::date`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<{ total: Prisma.Decimal }[]>(
    Prisma.sql`
      ${ACCT_MULT_CTE}
      SELECT COALESCE(SUM(csd."spend" * COALESCE(am.multiplier, 1)), 0) as total
      FROM "campaign_stats_daily" csd
      JOIN "campaigns" c ON c."id" = csd."campaignId"
      JOIN "ad_accounts" aa ON aa."id" = c."adAccountId"
      LEFT JOIN acct_mult am ON am."adAccountId" = aa."id"
      ${dateClause}
    `,
  );
  return Number(rows[0]?.total ?? 0);
}

// ─── Dashboard Summary ───────────────────────────────────────────────────────

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
        _sum: { netRevenue: true, conversions: true },
        where: dateFilter,
      }),
      getCampaignLinkStats(dateFrom, dateTo),
      getExpenseSummary(dateFrom, dateTo),
      getSeoTotalRevenue(dateFrom, dateTo),
    ]);

    let spent = adSpend;

    // Account purchase costs — attributed to createdAt date, with commissions
    {
      const accounts = await getAccounts();
      for (const a of accounts) {
        const accountCost = a.accountCostUsd ?? 0;
        if (accountCost === 0) continue;

        // Filter by createdAt date if date range is specified
        if (dateFrom && dateTo) {
          const created = a.createdAt.toISOString().slice(0, 10);
          if (created < dateFrom || created > dateTo) continue;
        }

        const commPct = a.commissionPercent ?? 0;
        const cryptoPct = a.cryptoPaymentPercent ?? 0;
        const multiplier = (1 + commPct / 100) * (1 + cryptoPct / 100);
        spent += accountCost * multiplier;
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

    // Conversions & CPA — combine ConversionStatsDaily + Keitaro API leads
    const dbConversions = Number(revenueAgg._sum.conversions ?? 0);
    const apiLeads = campaignStats.reduce(
      (sum, s) => sum + (s.leads ?? 0),
      0,
    );
    const conversions = dbConversions + apiLeads;
    const cpa = conversions > 0 ? spent / conversions : null;

    return { spent, received, roi, result, conversions, cpa };
  } catch (err) {
    console.error("[getDashboardSummary] Database query failed:", err);
    return EMPTY_SUMMARY;
  }
}

// ─── Time Series (daily spend vs revenue) ───────────────────────────────────

export async function getDashboardTimeSeries(
  dateFrom?: string,
  dateTo?: string,
): Promise<DashboardTimePoint[]> {
  try {
    const dateClause = dateFrom && dateTo
      ? Prisma.sql`WHERE csd."date" >= ${dateFrom}::date AND csd."date" <= ${dateTo}::date`
      : Prisma.empty;

    const dateFilter = dateFrom && dateTo
      ? { date: { gte: new Date(`${dateFrom}T00:00:00.000Z`), lte: new Date(`${dateTo}T00:00:00.000Z`) } }
      : {};

    // 1. Daily ad spend (with commissions)
    const spendRows = await prisma.$queryRaw<
      { date: string; spend: Prisma.Decimal }[]
    >(
      Prisma.sql`
        ${ACCT_MULT_CTE}
        SELECT csd."date"::text as date,
               SUM(csd."spend" * COALESCE(am.multiplier, 1)) as spend
        FROM "campaign_stats_daily" csd
        JOIN "campaigns" c ON c."id" = csd."campaignId"
        JOIN "ad_accounts" aa ON aa."id" = c."adAccountId"
        LEFT JOIN acct_mult am ON am."adAccountId" = aa."id"
        ${dateClause}
        GROUP BY csd."date"
        ORDER BY csd."date"
      `,
    );

    // 2. Daily conversion revenue
    const revenueGroups = await prisma.conversionStatsDaily.groupBy({
      by: ["date"],
      where: dateFilter,
      _sum: { netRevenue: true },
      orderBy: { date: "asc" },
    });

    // 3. Daily SEO revenue
    const seoDateFilter = dateFrom && dateTo
      ? Prisma.sql`WHERE date >= ${dateFrom}::date AND date <= ${dateTo}::date`
      : Prisma.empty;
    const seoRows = await prisma.$queryRaw<
      { date: string; revenue: Prisma.Decimal }[]
    >(
      Prisma.sql`
        SELECT date::text as date, SUM(quantity * rate) as revenue
        FROM "seo_leads"
        ${seoDateFilter}
        GROUP BY date
        ORDER BY date
      `,
    );

    // 4. Daily campaign link revenue (Keitaro API)
    const campaignLinkRevenue = await getCampaignLinkDailyRevenue(dateFrom, dateTo);

    // Merge all sources by date
    const map = new Map<string, { spend: number; revenue: number }>();

    for (const r of spendRows) {
      const d = r.date;
      const entry = map.get(d) ?? { spend: 0, revenue: 0 };
      entry.spend += Number(r.spend);
      map.set(d, entry);
    }

    for (const r of revenueGroups) {
      const d = r.date.toISOString().slice(0, 10);
      const entry = map.get(d) ?? { spend: 0, revenue: 0 };
      entry.revenue += Number(r._sum.netRevenue ?? 0);
      map.set(d, entry);
    }

    for (const r of seoRows) {
      const d = r.date;
      const entry = map.get(d) ?? { spend: 0, revenue: 0 };
      entry.revenue += Number(r.revenue);
      map.set(d, entry);
    }

    // Campaign link revenue from Keitaro
    campaignLinkRevenue.forEach((rev, d) => {
      const entry = map.get(d) ?? { spend: 0, revenue: 0 };
      entry.revenue += rev;
      map.set(d, entry);
    });

    // Sort by date
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        spend: Math.round(data.spend * 100) / 100,
        revenue: Math.round(data.revenue * 100) / 100,
      }));
  } catch (err) {
    console.error("[getDashboardTimeSeries] Query failed:", err);
    return [];
  }
}

// ─── Top Agencies by Spend ──────────────────────────────────────────────────

export async function getTopAgenciesBySpend(
  dateFrom?: string,
  dateTo?: string,
  limit = 5,
): Promise<AgencySpendRow[]> {
  try {
    const dateClause = dateFrom && dateTo
      ? Prisma.sql`AND csd."date" >= ${dateFrom}::date AND csd."date" <= ${dateTo}::date`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<
      { agencyName: string; totalSpend: Prisma.Decimal }[]
    >(
      Prisma.sql`
        ${ACCT_MULT_CTE}
        SELECT ag."name" as "agencyName",
               SUM(csd."spend" * COALESCE(am.multiplier, 1)) as "totalSpend"
        FROM "campaign_stats_daily" csd
        JOIN "campaigns" c ON c."id" = csd."campaignId"
        JOIN "ad_accounts" aa ON aa."id" = c."adAccountId"
        LEFT JOIN acct_mult am ON am."adAccountId" = aa."id"
        LEFT JOIN "integration_settings" iset2
          ON iset2."value" = aa."externalId"
          AND iset2."key" LIKE 'taboola.%.taboolaAccountId'
        JOIN "accounts" a
          ON a."id" = SUBSTRING(iset2."key" FROM 'taboola\\.(.+)\\.taboolaAccountId')
        JOIN "agencies" ag ON ag."id" = a."agencyId"
        WHERE a."agencyId" IS NOT NULL ${dateClause}
        GROUP BY ag."id", ag."name"
        ORDER BY "totalSpend" DESC
        LIMIT ${limit}
      `,
    );

    if (rows.length === 0) return [];

    const maxSpend = Number(rows[0].totalSpend);
    return rows.map((r) => ({
      agencyName: r.agencyName,
      totalSpend: Math.round(Number(r.totalSpend) * 100) / 100,
      percentOfMax: maxSpend > 0 ? (Number(r.totalSpend) / maxSpend) * 100 : 0,
    }));
  } catch (err) {
    console.error("[getTopAgenciesBySpend] Query failed:", err);
    return [];
  }
}

// ─── Spend by Account ───────────────────────────────────────────────────────

export async function getSpendByAccount(
  dateFrom?: string,
  dateTo?: string,
  limit = 10,
): Promise<AccountSpendRow[]> {
  try {
    const dateClause = dateFrom && dateTo
      ? Prisma.sql`WHERE csd."date" >= ${dateFrom}::date AND csd."date" <= ${dateTo}::date`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<
      { accountName: string; agencyName: string | null; totalSpend: Prisma.Decimal }[]
    >(
      Prisma.sql`
        ${ACCT_MULT_CTE}
        SELECT a."name" as "accountName",
               ag."name" as "agencyName",
               SUM(csd."spend" * COALESCE(am.multiplier, 1)) as "totalSpend"
        FROM "campaign_stats_daily" csd
        JOIN "campaigns" c ON c."id" = csd."campaignId"
        JOIN "ad_accounts" aa ON aa."id" = c."adAccountId"
        LEFT JOIN acct_mult am ON am."adAccountId" = aa."id"
        LEFT JOIN "integration_settings" iset2
          ON iset2."value" = aa."externalId"
          AND iset2."key" LIKE 'taboola.%.taboolaAccountId'
        JOIN "accounts" a
          ON a."id" = SUBSTRING(iset2."key" FROM 'taboola\\.(.+)\\.taboolaAccountId')
        LEFT JOIN "agencies" ag ON ag."id" = a."agencyId"
        ${dateClause}
        GROUP BY a."id", a."name", ag."name"
        ORDER BY "totalSpend" DESC
        LIMIT ${limit}
      `,
    );

    return rows.map((r) => ({
      accountName: r.accountName,
      agencyName: r.agencyName,
      totalSpend: Math.round(Number(r.totalSpend) * 100) / 100,
    }));
  } catch (err) {
    console.error("[getSpendByAccount] Query failed:", err);
    return [];
  }
}

// ─── Dashboard Alerts ───────────────────────────────────────────────────────

export async function getDashboardAlerts(): Promise<DashboardAlert[]> {
  const alerts: DashboardAlert[] = [];

  try {
    // 1. Low balance accounts (< $1000)
    const balances = await getBalanceSummaries();
    for (const b of balances) {
      // Only alert for accounts that have had activity
      if ((b.totalTopUp > 0 || b.totalSpent > 0) && b.remaining < 1000) {
        const severity = b.remaining < 200 ? "critical" : "warning";
        alerts.push({
          type: "low_balance",
          severity,
          title: `${b.accountName}: $${Math.round(b.remaining).toLocaleString()}`,
          description: b.remaining < 0
            ? `Overdraft — spent $${Math.round(b.totalSpent).toLocaleString()} of $${Math.round(b.totalTopUp).toLocaleString()}`
            : `Balance low — refill needed`,
        });
      }
    }
  } catch (err) {
    console.error("[getDashboardAlerts] Balance query failed:", err);
  }

  try {
    // 2. Negative ROI campaigns (last 3 days)
    const negRoiRows = await prisma.$queryRaw<
      { campaignName: string; avgRoi: Prisma.Decimal; daysNegative: bigint }[]
    >(
      Prisma.sql`
        SELECT c."name" as "campaignName",
               AVG(p."roi") as "avgRoi",
               COUNT(*) as "daysNegative"
        FROM "pnl_daily" p
        JOIN "campaign_mappings" cm ON cm."id" = p."campaignMappingId"
        JOIN "campaigns" c ON c."id" = cm."spendCampaignId"
        WHERE p."date" >= CURRENT_DATE - INTERVAL '3 days'
          AND p."grossProfit" < 0
          AND p."spend" > 0
        GROUP BY c."name"
        HAVING COUNT(*) >= 3
        ORDER BY AVG(p."roi") ASC
        LIMIT 5
      `,
    );

    for (const r of negRoiRows) {
      alerts.push({
        type: "negative_roi",
        severity: "critical",
        title: r.campaignName,
        description: `ROI ${Number(r.avgRoi).toFixed(1)}% — negative for ${Number(r.daysNegative)} days straight`,
      });
    }
  } catch (err) {
    // PnlDaily may not be populated — gracefully skip
    console.error("[getDashboardAlerts] Negative ROI query failed:", err);
  }

  return alerts;
}
