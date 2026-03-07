/**
 * Agencies — read-only data access layer.
 *
 * Converts Prisma Decimal fields to plain numbers so the result is
 * fully serializable (safe to pass from Server Components to Client Components).
 */

import { prisma } from "@/lib/prisma";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AgencyRow = {
  id:                  string;
  name:                string;
  website:             string | null;
  contact:             string | null;
  accountCostUsd:      number | null;
  commissionPercent:   number | null;
  cryptoPaymentPercent: number | null;
  notes:               string | null;
  updatedAt:           Date;
  adAccountCount:      number;
};

/**
 * Subset safe to pass across the server→client boundary.
 * Excludes `updatedAt` (Date serializes as string in RSC) and
 * `adAccountCount` (not needed in forms).
 */
export type AgencyEditData = Omit<AgencyRow, "updatedAt" | "adAccountCount">;

// ─── Query ─────────────────────────────────────────────────────────────────────

/**
 * Returns all agencies ordered by name, with ad-account count for each.
 * Decimal fields are converted to `number | null` for serializable output.
 */
export async function getAgencies(): Promise<AgencyRow[]> {
  const rows = await prisma.agency.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { adAccounts: true } },
    },
  });

  return rows.map((r) => ({
    id:                  r.id,
    name:                r.name,
    website:             r.website,
    contact:             r.contact,
    accountCostUsd:      r.accountCostUsd      !== null ? Number(r.accountCostUsd)      : null,
    commissionPercent:   r.commissionPercent   !== null ? Number(r.commissionPercent)   : null,
    cryptoPaymentPercent: r.cryptoPaymentPercent !== null ? Number(r.cryptoPaymentPercent) : null,
    notes:               r.notes,
    updatedAt:           r.updatedAt,
    adAccountCount:      r._count.adAccounts,
  }));
}
