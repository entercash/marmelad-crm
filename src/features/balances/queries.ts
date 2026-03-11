/**
 * Account Balances — database queries.
 *
 * TopUpRow — full row shape for display in the balances table.
 * TopUpEditData — serializable subset for client component form prefill.
 * AccountBalanceSummary — balance/remaining per account.
 */

import { prisma } from "@/lib/prisma";

// ─── Row types ────────────────────────────────────────────────────────────────

export type TopUpRow = {
  id:          string;
  accountId:   string;
  accountName: string;
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
  totalTopUp:  number; // total deposited
  totalSpent:  number; // totalSpentUsd from account (with commissions)
  remaining:   number; // topUp - spent
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns all top-ups ordered by date descending, with account name.
 */
export async function getTopUps(): Promise<TopUpRow[]> {
  const rows = await prisma.accountTopUp.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      account: {
        select: { id: true, name: true },
      },
    },
  });

  return rows.map((r) => ({
    id:          r.id,
    accountId:   r.accountId,
    accountName: r.account.name,
    amount:      Number(r.amount),
    date:        r.date,
    note:        r.note,
    createdAt:   r.createdAt,
  }));
}

/**
 * Minimal account list for the dropdown in the top-up form.
 */
export async function getAccountsForSelect(): Promise<AccountOption[]> {
  return prisma.account.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/**
 * Computes balance summary per account: total top-ups vs total spent.
 */
export async function getBalanceSummaries(): Promise<AccountBalanceSummary[]> {
  // Get all accounts with their agency commission info
  const accounts = await prisma.account.findMany({
    orderBy: { name: "asc" },
    include: {
      agency: {
        select: {
          commissionPercent: true,
          cryptoPaymentPercent: true,
        },
      },
    },
  });

  // Sum top-ups per account
  const topUpAggs = await prisma.accountTopUp.groupBy({
    by: ["accountId"],
    _sum: { amount: true },
  });
  const topUpMap = new Map(
    topUpAggs.map((a) => [a.accountId, Number(a._sum.amount ?? 0)]),
  );

  return accounts.map((acct) => {
    const totalTopUp = topUpMap.get(acct.id) ?? 0;
    const totalSpent = Number(acct.totalSpentUsd);
    return {
      accountId:   acct.id,
      accountName: acct.name,
      totalTopUp,
      totalSpent,
      remaining:   totalTopUp - totalSpent,
    };
  });
}
