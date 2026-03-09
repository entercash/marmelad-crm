/**
 * Accounts — read-only data access layer.
 *
 * Includes agency name via JOIN so the UI can display it directly.
 * Results are fully serializable (no Decimal or complex Prisma types).
 */

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
  agencyId:       string | null;
  agencyName:     string | null;
  platform:       AccountPlatform;
  accountType:    AccountType;
  status:         AccountStatus;
  accountCountry: string | null;
  trafficCountry: string | null;
  currency:       string;
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

/** All accounts ordered by name, with agency name resolved. */
export async function getAccounts(): Promise<AccountRow[]> {
  try {
    const rows = await prisma.account.findMany({
      orderBy: { name: "asc" },
      include: {
        agency: { select: { id: true, name: true } },
      },
    });

    return rows.map((r) => ({
      id:             r.id,
      name:           r.name,
      agencyId:       r.agencyId,
      agencyName:     r.agency?.name ?? null,
      platform:       r.platform,
      accountType:    r.accountType,
      status:         r.status,
      accountCountry: r.accountCountry,
      trafficCountry: r.trafficCountry,
      currency:       r.currency,
      createdAt:      r.createdAt,
      updatedAt:      r.updatedAt,
    }));
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
