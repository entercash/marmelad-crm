/**
 * CampaignStatsDaily upsert service.
 * Normalizes Taboola campaign daily stats into our schema.
 *
 * Derived metrics (cpc, cpm, ctr) are stored as returned by the API.
 * Money values are stored as Prisma.Decimal to avoid floating-point drift.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fromApiDate } from "@/lib/date";
import type { TaboolaCampaignStatRow } from "@/integrations/taboola";
import type { SyncCounter } from "@/services/sync/types";

const CHUNK_SIZE = 100;

/**
 * Upsert daily campaign stats.
 * @param rows - Raw Taboola stat rows
 * @param campaignIdMap - Map from Taboola campaign externalId → internal Campaign.id
 */
export async function upsertCampaignStats(
  rows: TaboolaCampaignStatRow[],
  campaignIdMap: Map<string, string>,
): Promise<Partial<SyncCounter>> {
  let updated = 0;
  let skipped = 0;

  // Filter to rows with known campaigns and chunk for efficiency
  const processable = rows.filter((row) => campaignIdMap.has(row.campaign_id));
  skipped = rows.length - processable.length;

  for (let i = 0; i < processable.length; i += CHUNK_SIZE) {
    const chunk = processable.slice(i, i + CHUNK_SIZE);

    await prisma.$transaction(
      chunk.map((row) => {
        const campaignId = campaignIdMap.get(row.campaign_id)!;
        const date = fromApiDate(row.date);

        return prisma.campaignStatsDaily.upsert({
          where: {
            campaignId_date: { campaignId, date },
          },
          update: {
            spend: new Prisma.Decimal(row.spent),
            clicks: row.clicks,
            impressions: row.impressions,
            cpc: row.cpc != null ? new Prisma.Decimal(row.cpc) : null,
            cpm: row.cpm != null ? new Prisma.Decimal(row.cpm) : null,
            ctr: row.ctr != null ? new Prisma.Decimal(row.ctr) : null,
            currency: row.currency || "USD",
          },
          create: {
            campaignId,
            date,
            spend: new Prisma.Decimal(row.spent),
            clicks: row.clicks,
            impressions: row.impressions,
            cpc: row.cpc != null ? new Prisma.Decimal(row.cpc) : null,
            cpm: row.cpm != null ? new Prisma.Decimal(row.cpm) : null,
            ctr: row.ctr != null ? new Prisma.Decimal(row.ctr) : null,
            currency: row.currency || "USD",
          },
          select: { id: true },
        });
      }),
      { timeout: 30_000 },
    );

    updated += chunk.length;
  }

  return { updated, skipped };
}
