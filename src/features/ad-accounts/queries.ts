/**
 * Accounts — read-only data access layer.
 *
 * Includes agency name via JOIN so the UI can display it directly.
 * Calculates total spent from Taboola CSV imports with agency commissions:
 *   totalCostNative = rawSpend × (1 + commissionPercent/100) × (1 + cryptoPaymentPercent/100)
 *   totalSpentUsd   = pre-converted spentUsd (historical FX rates applied at import time)
 * Results are fully serializable (no Decimal or complex Prisma types).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AccountStatus, AccountPlatform, AccountType } from "@prisma/client";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AgencyOption = {
  id:   string;
  name: string;
  accountCostUsd:       number | null;
  commissionPercent:    number | null;
  cryptoPaymentPercent: number | null;
};

export type AccountRow = {
  id:             string;
  name:           string;
  externalId:     string | null;
  agencyId:       string | null;
  agencyName:     string | null;
  platform:       AccountPlatform;
  accountType:    AccountType;
  status:         AccountStatus;
  accountCountry: string | null;
  trafficCountry: string | null;
  currency:       string;
  timezone:       string | null;
  /** Raw spend in the account's native currency (from CSV). */
  rawSpentNative:  number;
  /** Raw spend converted to USD (historical FX, no commissions). */
  rawSpentUsd:     number;
  /** Total cost in native currency (with commissions applied). */
  totalCostNative: number;
  /** Total cost converted to USD (with commissions applied). */
  totalSpentUsd:   number;
  /** Account purchase cost in USD (effective: account override ?? agency). */
  accountCostUsd:        number | null;
  /** Effective commission percent (account override ?? agency). */
  commissionPercent:     number | null;
  /** Effective crypto payment percent (account override ?? agency). */
  cryptoPaymentPercent:  number | null;
  /** Account-level overrides (null = inherited from agency). */
  ownAccountCostUsd:        number | null;
  ownCommissionPercent:     number | null;
  ownCryptoPaymentPercent:  number | null;
  /** Total deposited via top-ups (USD). */
  totalTopUp:     number;
  /** Remaining balance = totalTopUp - rawSpentUsd (without commissions). */
  remaining:      number;
  createdAt:      Date;
  updatedAt:      Date;
};

/**
 * Subset safe to pass across the server→client boundary for form prefill.
 * Excludes agencyName (derived) and Date fields.
 */
export type AccountEditData = {
  id:             string;
  name:           string;
  externalId:     string | null;
  agencyId:       string | null;
  platform:       AccountPlatform;
  accountType:    AccountType;
  status:         AccountStatus;
  accountCountry: string | null;
  trafficCountry: string | null;
  currency:       string;
  timezone:       string | null;
  accountCostUsd:       number | null;
  commissionPercent:    number | null;
  cryptoPaymentPercent: number | null;
};

// ─── Stats type ─────────────────────────────────────────────────────────────

export type AccountStats = {
  total:           number;
  active:          number;
  underModeration: number;
  banned:          number;
  empty:           number;
};

// ─── Queries ───────────────────────────────────────────────────────────────────

/** All accounts ordered by name, with agency name + real spend from CSV (spentUsd pre-converted at import). */
export async function getAccounts(): Promise<AccountRow[]> {
  try {
    const rows = await prisma.account.findMany({
      orderBy: { name: "asc" },
      include: {
        agency: {
          select: {
            id: true,
            name: true,
            accountCostUsd: true,
            commissionPercent: true,
            cryptoPaymentPercent: true,
          },
        },
      },
    });

    // Batch-fetch top-up totals per account (resilient — empty map on error)
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
      // table may not exist yet if migration hasn't been applied
    }

    // Collect all externalIds to batch-fetch spend totals
    const externalIds = rows
      .map((r) => r.externalId)
      .filter((id): id is string => id !== null && id !== "");

    // Sum spend from campaign_stats_daily via AdAccount bridge (already in USD)
    let spendMap: Record<string, { native: number; usd: number }> = {};
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
        spendMap[sr.externalId] = {
          native: Number(sr.totalUsd), // Already converted to USD during sync
          usd:    Number(sr.totalUsd),
        };
      }
    }

    return rows.map((r) => {
      const spend = r.externalId ? spendMap[r.externalId] : undefined;
      const rawSpentNative = spend?.native ?? 0;
      const rawSpentUsd    = spend?.usd ?? 0;

      // Override pattern: account field ?? agency field
      const ownComm   = r.commissionPercent !== null ? Number(r.commissionPercent) : null;
      const ownCrypto = r.cryptoPaymentPercent !== null ? Number(r.cryptoPaymentPercent) : null;
      const ownCost   = r.accountCostUsd !== null ? Number(r.accountCostUsd) : null;

      const commPct   = ownComm ?? (r.agency?.commissionPercent ? Number(r.agency.commissionPercent) : 0);
      const cryptoPct = ownCrypto ?? (r.agency?.cryptoPaymentPercent ? Number(r.agency.cryptoPaymentPercent) : 0);

      const commMultiplier = (1 + commPct / 100) * (1 + cryptoPct / 100);
      const totalCostNative = rawSpentNative * commMultiplier;
      const totalSpentUsd   = rawSpentUsd * commMultiplier;
      const totalTopUp      = topUpMap.get(r.id) ?? 0;

      return {
        id:             r.id,
        name:           r.name,
        externalId:     r.externalId,
        agencyId:       r.agencyId,
        agencyName:     r.agency?.name ?? null,
        platform:       r.platform,
        accountType:    r.accountType,
        status:         r.status,
        accountCountry: r.accountCountry,
        trafficCountry: r.trafficCountry,
        currency:       r.currency,
        timezone:       r.timezone,
        rawSpentNative,
        rawSpentUsd,
        totalCostNative,
        totalSpentUsd,
        accountCostUsd:        ownCost ?? (r.agency?.accountCostUsd ? Number(r.agency.accountCostUsd) : null),
        commissionPercent:     commPct > 0 ? commPct : null,
        cryptoPaymentPercent:  cryptoPct > 0 ? cryptoPct : null,
        ownAccountCostUsd:     ownCost,
        ownCommissionPercent:  ownComm,
        ownCryptoPaymentPercent: ownCrypto,
        totalTopUp,
        remaining:      totalTopUp - rawSpentUsd,
        createdAt:      r.createdAt,
        updatedAt:      r.updatedAt,
      };
    });
  } catch (err) {
    console.error("[getAccounts] Database query failed:", err);
    return [];
  }
}

/** Agency list for the dropdown in the account form (includes commission defaults). */
export async function getAgenciesForSelect(): Promise<AgencyOption[]> {
  const rows = await prisma.agency.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      accountCostUsd: true,
      commissionPercent: true,
      cryptoPaymentPercent: true,
    },
  });
  return rows.map((r) => ({
    id:   r.id,
    name: r.name,
    accountCostUsd:       r.accountCostUsd !== null ? Number(r.accountCostUsd) : null,
    commissionPercent:    r.commissionPercent !== null ? Number(r.commissionPercent) : null,
    cryptoPaymentPercent: r.cryptoPaymentPercent !== null ? Number(r.cryptoPaymentPercent) : null,
  }));
}

/** Aggregate status counts for summary stat cards. */
export async function getAccountStats(): Promise<AccountStats> {
  try {
    const counts = await prisma.account.groupBy({
      by: ["status"],
      _count: { status: true },
    });

    const map: Record<string, number> = {};
    for (const row of counts) {
      map[row.status] = row._count.status;
    }

    return {
      total:           Object.values(map).reduce((a, b) => a + b, 0),
      active:          map.ACTIVE ?? 0,
      underModeration: map.UNDER_MODERATION ?? 0,
      banned:          map.BANNED ?? 0,
      empty:           map.EMPTY ?? 0,
    };
  } catch (err) {
    console.error("[getAccountStats] Database query failed:", err);
    return { total: 0, active: 0, underModeration: 0, banned: 0, empty: 0 };
  }
}
