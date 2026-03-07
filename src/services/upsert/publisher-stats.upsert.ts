/**
 * PublisherStatsDaily upsert service.
 * Normalizes Taboola publisher/site daily stats into our schema.
 *
 * This is the highest-volume table — may contain thousands of rows per sync.
 * Processed in chunks of 50 to keep transaction size manageable.
 *
 * GEO normalization: Taboola may return "" for unknown country.
 * We normalize to "XX" (our sentinel value) as defined in the schema.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fromApiDate } from "@/lib/date";
import type { TaboolaPublisherStatRow } from "@/integrations/taboola";
import type { SyncCounter } from "@/services/sync/types";

const CHUNK_SIZE = 50;

/** Normalize a Taboola country code to our GEO sentinel convention */
function normalizeGeo(country: string): string {
  const trimmed = country.trim().toUpperCase();
  return trimmed.length === 2 ? trimmed : "XX";
}

/**
 * Upsert daily publisher stats.
 * @param rows - Raw Taboola publisher stat rows
 * @param publisherIdMap - Map from Taboola site externalId → internal Publisher.id
 * @param campaignIdMap - Map from Taboola campaign externalId → internal Campaign.id
 */
export async function upsertPublisherStats(
  rows: TaboolaPublisherStatRow[],
  publisherIdMap: Map<string, string>,
  campaignIdMap: Map<string, string>,
): Promise<Partial<SyncCounter>> {
  let updated = 0;
  let skipped = 0;

  const processable = rows.filter(
    (row) => publisherIdMap.has(row.site) && campaignIdMap.has(row.campaign_id),
  );
  skipped = rows.length - processable.length;

  for (let i = 0; i < processable.length; i += CHUNK_SIZE) {
    const chunk = processable.slice(i, i + CHUNK_SIZE);

    await prisma.$transaction(
      chunk.map((row) => {
        const publisherId = publisherIdMap.get(row.site)!;
        const campaignId = campaignIdMap.get(row.campaign_id)!;
        const date = fromApiDate(row.date);
        const geo = normalizeGeo(row.country);

        return prisma.publisherStatsDaily.upsert({
          where: {
            publisherId_campaignId_date_geo: {
              publisherId,
              campaignId,
              date,
              geo,
            },
          },
          update: {
            spend: new Prisma.Decimal(row.spent),
            clicks: row.clicks,
            impressions: row.impressions,
            cpc: row.cpc != null ? new Prisma.Decimal(row.cpc) : null,
            ctr: row.ctr != null ? new Prisma.Decimal(row.ctr) : null,
            currency: row.currency || "USD",
          },
          create: {
            publisherId,
            campaignId,
            date,
            geo,
            spend: new Prisma.Decimal(row.spent),
            clicks: row.clicks,
            impressions: row.impressions,
            cpc: row.cpc != null ? new Prisma.Decimal(row.cpc) : null,
            ctr: row.ctr != null ? new Prisma.Decimal(row.ctr) : null,
            currency: row.currency || "USD",
          },
          select: { id: true },
        });
      }),
    );

    updated += chunk.length;
  }

  return { updated, skipped };
}
