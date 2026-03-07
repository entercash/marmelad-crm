/**
 * CampaignItem upsert service.
 * Normalizes Taboola campaign item (creative) API responses.
 */

import { CampaignItemStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TaboolaCampaignItem, TaboolaCampaignItemStatus } from "@/integrations/taboola";
import type { SyncCounter } from "@/services/sync/types";

// ─── Status mapping ───────────────────────────────────────────────────────────

function mapItemStatus(status: TaboolaCampaignItemStatus): CampaignItemStatus {
  switch (status) {
    case "RUNNING":   return CampaignItemStatus.ACTIVE;
    case "CRAWLING":  return CampaignItemStatus.ACTIVE; // being fetched → treat as active
    case "PAUSED":    return CampaignItemStatus.PAUSED;
    case "STOPPED":   return CampaignItemStatus.STOPPED;
    case "BLOCKED":   return CampaignItemStatus.STOPPED; // blocked by Taboola policy
    default:          return CampaignItemStatus.PAUSED;
  }
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

/**
 * Upsert a batch of Taboola campaign items (creatives).
 * The campaignExternalId is used to look up the internal Campaign.id.
 * The item is keyed on (campaignId, externalId) — Taboola item IDs are
 * unique within a campaign but may repeat across campaigns.
 */
export async function upsertCampaignItems(
  items: TaboolaCampaignItem[],
  campaignExternalId: string,
  trafficSourceId: string,
): Promise<Partial<SyncCounter>> {
  if (items.length === 0) return {};

  // Resolve the internal campaign ID
  const campaign = await prisma.campaign.findUnique({
    where: {
      trafficSourceId_externalId: {
        trafficSourceId,
        externalId: campaignExternalId,
      },
    },
    select: { id: true },
  });

  if (!campaign) {
    console.warn(
      `[upsert:campaign-items] Campaign not found for externalId=${campaignExternalId} — skipping ${items.length} items`,
    );
    return { skipped: items.length };
  }

  await prisma.$transaction(
    items.map((item) =>
      prisma.campaignItem.upsert({
        where: {
          campaignId_externalId: {
            campaignId: campaign.id,
            externalId: item.id,
          },
        },
        update: {
          title: item.title ?? null,
          url: item.url ?? null,
          thumbnailUrl: item.thumbnail_url ?? null,
          status: mapItemStatus(item.status),
          lastSyncedAt: new Date(),
        },
        create: {
          externalId: item.id,
          campaignId: campaign.id,
          title: item.title ?? null,
          url: item.url ?? null,
          thumbnailUrl: item.thumbnail_url ?? null,
          status: mapItemStatus(item.status),
          lastSyncedAt: new Date(),
        },
        select: { id: true },
      }),
    ),
    { timeout: 30_000 },
  );

  return { updated: items.length };
}
