/**
 * Publishers data-access layer.
 *
 * Exports typed query helpers used by the Publishers Server Component.
 * Never imported by client components.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ─── Types ─────────────────────────────────────────────────────────────────────

/** The active list entry for a publisher, if any. */
export type ActiveListEntry = {
  listType: string;
  listName: string;
  addedAt:  Date;
} | null;

export type PublisherRow = {
  id:             string;
  name:           string;
  domain:         string | null;
  updatedAt:      Date;
  trafficSource:  { name: string; slug: string };
  activeListEntry: ActiveListEntry;
  qualityLabel:   string | null;
};

// ─── Query ─────────────────────────────────────────────────────────────────────

/**
 * Returns up to 300 publishers, optionally filtered by a name/domain search term.
 * Results are ordered by most-recently-updated first.
 *
 * Each row includes:
 *  - The parent traffic source
 *  - The first active list entry (blacklist / whitelist), if any
 *  - The latest quality label from PublisherQualityScore, if available
 */
export async function getPublishers(search?: string): Promise<PublisherRow[]> {
  const where: Prisma.PublisherWhereInput = {};

  if (search?.trim()) {
    const term = search.trim();
    where.OR = [
      { name:   { contains: term, mode: "insensitive" } },
      { domain: { contains: term, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.publisher.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 300,
    select: {
      id:       true,
      name:     true,
      domain:   true,
      updatedAt: true,
      trafficSource: { select: { name: true, slug: true } },
      listEntries: {
        where:   { status: "ACTIVE" },
        take:    1,
        orderBy: { addedAt: "desc" },
        select: {
          addedAt: true,
          list: {
            select: { type: true, name: true },
          },
        },
      },
      qualityScores: {
        take:    1,
        orderBy: { scoreDate: "desc" },
        select:  { qualityLabel: true },
      },
    },
  });

  return rows.map((r) => {
    const entry = r.listEntries[0] ?? null;
    const score = r.qualityScores[0] ?? null;

    return {
      id:        r.id,
      name:      r.name,
      domain:    r.domain,
      updatedAt: r.updatedAt,
      trafficSource: r.trafficSource,
      activeListEntry: entry
        ? {
            listType: entry.list.type,
            listName: entry.list.name,
            addedAt:  entry.addedAt,
          }
        : null,
      qualityLabel: score?.qualityLabel ?? null,
    };
  });
}
