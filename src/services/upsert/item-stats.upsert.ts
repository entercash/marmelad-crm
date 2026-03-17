/**
 * CampaignItemStatsDaily upsert service.
 * Normalizes Taboola item (creative) stats into our schema.
 * Note: Taboola item_breakdown returns aggregated data (not daily),
 * so we store it with a snapshot date (endDate of the sync range).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fromApiDate, todayCrm } from "@/lib/date";
import type { TaboolaItemStatRow } from "@/integrations/taboola";
import type { SyncCounter } from "@/services/sync/types";

const CHUNK_SIZE = 100;

/**
 * Upsert item stats (aggregated per item for the sync range).
 * @param rows - Raw Taboola item stat rows
 * @param itemIdMap - Map from Taboola item externalId → internal CampaignItem.id
 */
export async function upsertItemStats(
  rows: TaboolaItemStatRow[],
  itemIdMap: Map<string, string>,
): Promise<Partial<SyncCounter>> {
  let updated = 0;
  let skipped = 0;

  const processable = rows.filter((row) => itemIdMap.has(row.item));
  skipped = rows.length - processable.length;

  // Use today as snapshot date since item_breakdown is aggregated
  const snapshotDate = fromApiDate(todayCrm());

  for (let i = 0; i < processable.length; i += CHUNK_SIZE) {
    const chunk = processable.slice(i, i + CHUNK_SIZE);

    await prisma.$transaction(
      chunk.map((row) => {
        const campaignItemId = itemIdMap.get(row.item)!;

        return prisma.campaignItemStatsDaily.upsert({
          where: {
            campaignItemId_date: { campaignItemId, date: snapshotDate },
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
            campaignItemId,
            date: snapshotDate,
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
