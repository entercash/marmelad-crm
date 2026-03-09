/**
 * Campaigns data-access layer.
 *
 * Exports typed query helpers used by the Campaigns Server Component.
 * Never imported by client components.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CampaignFilters = {
  status?:          string;
  trafficSourceId?: string;
  search?:          string;
};

export type CampaignRow = {
  id:           string;
  name:         string;
  status:       string;
  currency:     string;
  dailyBudget:  number | null;
  lastSyncedAt: Date   | null;
  updatedAt:    Date;
  trafficSource: { name: string; slug: string };
  adAccount:     { name: string } | null;
};

export type TrafficSourceOption = {
  id:   string;
  name: string;
  slug: string;
};

// ─── Valid filter values ───────────────────────────────────────────────────────

const VALID_STATUSES = new Set(["ACTIVE", "PAUSED", "STOPPED", "ARCHIVED"]);

// ─── Queries ───────────────────────────────────────────────────────────────────

/**
 * Returns up to 200 campaigns matching the given filters.
 * Results are ordered by most-recently-updated first.
 */
export async function getCampaigns(
  filters: CampaignFilters = {},
): Promise<CampaignRow[]> {
  try {
    const where: Prisma.CampaignWhereInput = {};

    if (filters.status && VALID_STATUSES.has(filters.status)) {
      where.status = filters.status as never;
    }

    if (filters.trafficSourceId) {
      where.trafficSourceId = filters.trafficSourceId;
    }

    if (filters.search?.trim()) {
      where.name = { contains: filters.search.trim(), mode: "insensitive" };
    }

    const rows = await prisma.campaign.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: {
        id:           true,
        name:         true,
        status:       true,
        currency:     true,
        dailyBudget:  true,
        lastSyncedAt: true,
        updatedAt:    true,
        trafficSource: { select: { name: true, slug: true } },
        adAccount:     { select: { name: true } },
      },
    });

    // Prisma returns Decimal for dailyBudget; convert to primitive number for the UI.
    return rows.map((r) => ({
      ...r,
      dailyBudget: r.dailyBudget !== null ? Number(r.dailyBudget) : null,
    }));
  } catch (err) {
    console.error("[getCampaigns] Database query failed:", err);
    return [];
  }
}

/**
 * Returns the distinct traffic sources that have at least one campaign.
 * Used to populate the source filter dropdown on the Campaigns page.
 */
export async function getCampaignFilterOptions(): Promise<{
  trafficSources: TrafficSourceOption[];
}> {
  try {
    // Fetch all active traffic sources that have at least one campaign.
    const sources = await prisma.trafficSource.findMany({
      where: {
        campaigns: { some: {} },
      },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });

    return { trafficSources: sources };
  } catch (err) {
    console.error("[getCampaignFilterOptions] Database query failed:", err);
    return { trafficSources: [] };
  }
}
