/**
 * Accounts — read-only data access layer.
 *
 * Includes agency name via JOIN so the table can display it directly.
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
  email:          string;
  password:       string;
  agencyId:       string | null;
  agencyName:     string | null;
  platform:       AccountPlatform;
  accountType:    AccountType;
  status:         AccountStatus;
  accountCountry: string | null;
  trafficCountry: string | null;
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
  email:          string;
  password:       string;
  agencyId:       string | null;
  platform:       AccountPlatform;
  accountType:    AccountType;
  status:         AccountStatus;
  accountCountry: string | null;
  trafficCountry: string | null;
};

// ─── Queries ───────────────────────────────────────────────────────────────────

/** All accounts ordered by name, with agency name resolved. */
export async function getAccounts(): Promise<AccountRow[]> {
  const rows = await prisma.account.findMany({
    orderBy: { name: "asc" },
    include: {
      agency: { select: { id: true, name: true } },
    },
  });

  return rows.map((r) => ({
    id:             r.id,
    name:           r.name,
    email:          r.email,
    password:       r.password,
    agencyId:       r.agencyId,
    agencyName:     r.agency?.name ?? null,
    platform:       r.platform,
    accountType:    r.accountType,
    status:         r.status,
    accountCountry: r.accountCountry,
    trafficCountry: r.trafficCountry,
    createdAt:      r.createdAt,
    updatedAt:      r.updatedAt,
  }));
}

/** Minimal agency list for the dropdown in the account form. */
export async function getAgenciesForSelect(): Promise<AgencyOption[]> {
  return prisma.agency.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
