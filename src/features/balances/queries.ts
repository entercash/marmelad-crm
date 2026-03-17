/**
 * Account Balances — database queries.
 *
 * TopUpRow — full row shape for display in the balances table.
 * TopUpEditData — serializable subset for client component form prefill.
 * AccountBalanceSummary — balance/remaining per account.
 * AgencyBalanceSummary — aggregated balance per agency.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ─── Row types ────────────────────────────────────────────────────────────────

export type TopUpRow = {
  id:          string;
  accountId:   string;
  accountName: string;
  agencyName:  string | null;
  amount:      number;
  date:        Date;
  note:        string | null;
  createdAt:   Date;
};

/**
 * Safe to pass as props to client components — no Date / Decimal objects.
 */
export type TopUpEditData = {
  id:        string;
  accountId: string;
  date:      string; // "YYYY-MM-DD"
  amount:    string; // stringified for the input
  note:      string | null;
};

export type AccountOption = {
  id:   string;
  name: string;
};

export type AccountBalanceSummary = {
  accountId:   string;
  accountName: string;
  agencyName:  string | null;
  totalTopUp:  number; // total deposited
  totalSpent:  number; // raw spend in USD from CSV (no commissions)
  remaining:   number; // topUp - spent
};

export type AgencyBalanceSummary = {
  agencyName:  string;
  accountCount: number;
  totalTopUp:  number;
  totalSpent:  number;
  remaining:   number;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns all top-ups ordered by date descending, with account name and agency.
 */
export async function getTopUps(): Promise<TopUpRow[]> {
  try {
    const rows = await prisma.accountTopUp.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        account: {
          select: {
            id: true,
            name: true,
            agency: { select: { name: true } },
          },
        },
      },
    });

    return rows.map((r) => ({
      id:          r.id,
      accountId:   r.accountId,
      accountName: r.account.name,
      agencyName:  r.account.agency?.name ?? null,
      amount:      Number(r.amount),
      date:        r.date,
      note:        r.note,
      createdAt:   r.createdAt,
    }));
  } catch (err) {
    console.error("[getTopUps] Query failed:", err);
    return [];
  }
}

/**
 * Minimal account list for the dropdown in the top-up form.
 */
export async function getAccountsForSelect(): Promise<AccountOption[]> {
  try {
    return await prisma.account.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  } catch (err) {
    console.error("[getAccountsForSelect] Query failed:", err);
    return [];
  }
}

/**
 * Computes balance summary per account: total top-ups vs total spent.
 */
export async function getBalanceSummaries(): Promise<AccountBalanceSummary[]> {
  try {
    const accounts = await prisma.account.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        externalId: true,
        agency: { select: { name: true } },
      },
    });

    // Sum top-ups per account (resilient)
    let topUpMap = new Map<string, number>();
    try {
      const topUpAggs = await prisma.accountTopUp.groupBy({
        by: ["accountId"],
        _sum: { amount: true },
      });
      topUpMap = new Map(
        topUpAggs.map((a) => [a.accountId, Number(a._sum.amount ?? 0)]),
      );
    } catch {
      // table may not exist yet
    }

    // Fetch raw USD spend from campaign_stats_daily via AdAccount bridge (no commissions)
    const externalIds = accounts
      .map((a) => a.externalId)
      .filter((id): id is string => id !== null && id !== "");

    let spendMap: Record<string, number> = {};
    if (externalIds.length > 0) {
      const spendRows = await prisma.$queryRaw<
        { externalId: string; totalUsd: Prisma.Decimal }[]
      >`
        SELECT aa."externalId",
               SUM(csd."spend") as "totalUsd"
        FROM "campaign_stats_daily" csd
        JOIN "campaigns" c ON c."id" = csd."campaignId"
        JOIN "ad_accounts" aa ON aa."id" = c."adAccountId"
        WHERE aa."externalId" IN (${Prisma.join(externalIds)})
        GROUP BY aa."externalId"
      `;
      for (const sr of spendRows) {
        spendMap[sr.externalId] = Number(sr.totalUsd);
      }
    }

    return accounts.map((acct) => {
      const totalTopUp = topUpMap.get(acct.id) ?? 0;
      const totalSpent = acct.externalId ? (spendMap[acct.externalId] ?? 0) : 0;
      return {
        accountId:   acct.id,
        accountName: acct.name,
        agencyName:  acct.agency?.name ?? null,
        totalTopUp,
        totalSpent,
        remaining:   totalTopUp - totalSpent,
      };
    });
  } catch (err) {
    console.error("[getBalanceSummaries] Query failed:", err);
    return [];
  }
}

/**
 * Aggregates balance summaries by agency.
 */
export function aggregateByAgency(summaries: AccountBalanceSummary[]): AgencyBalanceSummary[] {
  const map = new Map<string, AgencyBalanceSummary>();

  for (const s of summaries) {
    const name = s.agencyName ?? "No Agency";
    const existing = map.get(name);
    if (existing) {
      existing.accountCount += 1;
      existing.totalTopUp += s.totalTopUp;
      existing.totalSpent += s.totalSpent;
      existing.remaining += s.remaining;
    } else {
      map.set(name, {
        agencyName:   name,
        accountCount: 1,
        totalTopUp:   s.totalTopUp,
        totalSpent:   s.totalSpent,
        remaining:    s.remaining,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalTopUp - a.totalTopUp);
}
