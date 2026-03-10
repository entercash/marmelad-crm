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
  /** Raw spend in the account's native currency (from CSV). */
  rawSpentNative:  number;
  /** Raw spend converted to USD (historical FX, no commissions). */
  rawSpentUsd:     number;
  /** Total cost in native currency (with commissions applied). */
  totalCostNative: number;
  /** Total cost converted to USD (with commissions applied). */
  totalSpentUsd:   number;
  /** Account purchase cost in USD (from agency). */
  accountCostUsd:        number | null;
  commissionPercent:     number | null;
  cryptoPaymentPercent:  number | null;
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

    // Collect all externalIds to batch-fetch spend totals
    const externalIds = rows
      .map((r) => r.externalId)
      .filter((id): id is string => id !== null && id !== "");

    // Sum native spend AND pre-converted USD spend from CSV per accountExternalId
    let spendMap: Record<string, { native: number; usd: number }> = {};
    if (externalIds.length > 0) {
      const spendRows = await prisma.$queryRaw<
        { accountExternalId: string; totalNative: Prisma.Decimal; totalUsd: Prisma.Decimal }[]
      >`
        SELECT "accountExternalId",
               SUM("spent")    as "totalNative",
               SUM("spentUsd") as "totalUsd"
        FROM "taboola_csv_rows"
        WHERE "accountExternalId" IN (${Prisma.join(externalIds)})
        GROUP BY "accountExternalId"
      `;
      for (const sr of spendRows) {
        spendMap[sr.accountExternalId] = {
          native: Number(sr.totalNative),
          usd:    Number(sr.totalUsd),
        };
      }
    }

    return rows.map((r) => {
      const spend = r.externalId ? spendMap[r.externalId] : undefined;
      const rawSpentNative = spend?.native ?? 0;
      const rawSpentUsd    = spend?.usd ?? 0;
      const commPct = r.agency?.commissionPercent
        ? Number(r.agency.commissionPercent)
        : 0;
      const cryptoPct = r.agency?.cryptoPaymentPercent
        ? Number(r.agency.cryptoPaymentPercent)
        : 0;
      const commMultiplier = (1 + commPct / 100) * (1 + cryptoPct / 100);
      const totalCostNative = rawSpentNative * commMultiplier;
      const totalSpentUsd   = rawSpentUsd * commMultiplier;

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
        rawSpentNative,
        rawSpentUsd,
        totalCostNative,
        totalSpentUsd,
        accountCostUsd:        r.agency?.accountCostUsd ? Number(r.agency.accountCostUsd) : null,
        commissionPercent:     r.agency?.commissionPercent ? Number(r.agency.commissionPercent) : null,
        cryptoPaymentPercent:  r.agency?.cryptoPaymentPercent ? Number(r.agency.cryptoPaymentPercent) : null,
        createdAt:      r.createdAt,
        updatedAt:      r.updatedAt,
      };
    });
  } catch (err) {
    console.error("[getAccounts] Database query failed:", err);
    return [];
  }
}

/** Minimal agency list for the dropdown in the account form. */
export async function getAgenciesForSelect(): Promise<AgencyOption[]> {
  return prisma.agency.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
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
