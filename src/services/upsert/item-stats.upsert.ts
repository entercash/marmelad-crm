/**
 * CampaignItemStatsDaily upsert service.
 * Normalizes Taboola item (creative) daily stats into our schema.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fromApiDate } from "@/lib/date";
import type { TaboolaItemStatRow } from "@/integrations/taboola";
import type { SyncCounter } from "@/services/sync/types";

const CHUNK_SIZE = 100;

/**
 * Upsert daily item stats.
 * @param rows - Raw Taboola item stat rows
 * @param itemIdMap - Map from Taboola item externalId → internal CampaignItem.id
 */
export async function upsertItemStats(
  rows: TaboolaItemStatRow[],
  itemIdMap: Map<string, string>,
): Promise<Partial<SyncCounter>> {
  let updated = 0;
  let skipped = 0;

  const processable = rows.filter((row) => itemIdMap.has(row.item_id));
  skipped = rows.length - processable.length;

  for (let i = 0; i < processable.length; i += CHUNK_SIZE) {
    const chunk = processable.slice(i, i + CHUNK_SIZE);

    await prisma.$transaction(
      chunk.map((row) => {
        const campaignItemId = itemIdMap.get(row.item_id)!;
        const date = fromApiDate(row.date);

        return prisma.campaignItemStatsDaily.upsert({
          where: {
            campaignItemId_date: { campaignItemId, date },
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
            date,
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
