/**
 * Campaign upsert service.
 * Normalizes Taboola campaign API responses into our Campaign schema.
 */

import { CampaignStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { TaboolaCampaign, TaboolaCampaignStatus } from "@/integrations/taboola";
import type { SyncCounter } from "@/services/sync/types";

// ─── Status mapping ───────────────────────────────────────────────────────────

function mapCampaignStatus(status: TaboolaCampaignStatus): CampaignStatus {
  switch (status) {
    case "RUNNING":           return CampaignStatus.ACTIVE;
    case "PAUSED":            return CampaignStatus.PAUSED;
    case "STOPPED":           return CampaignStatus.STOPPED;
    case "DISABLED":          return CampaignStatus.STOPPED;
    case "PENDING_APPROVAL":  return CampaignStatus.PAUSED;
    case "ARCHIVED":          return CampaignStatus.ARCHIVED;
    default:                  return CampaignStatus.PAUSED; // safe fallback
  }
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

/**
 * Upsert a batch of Taboola campaigns.
 * Uses the (trafficSourceId, externalId) unique constraint for conflict resolution.
 */
export async function upsertCampaigns(
  campaigns: TaboolaCampaign[],
  trafficSourceId: string,
  adAccountId: string,
): Promise<Partial<SyncCounter>> {
  let inserted = 0;
  let updated = 0;

  // Process in a transaction for atomicity
  await prisma.$transaction(
    campaigns.map((campaign) =>
      prisma.campaign.upsert({
        where: {
          trafficSourceId_externalId: {
            trafficSourceId,
            externalId: campaign.id,
          },
        },
        update: {
          name: campaign.name,
          status: mapCampaignStatus(campaign.status),
          dailyBudget: campaign.daily_budget ?? null,
          cpcBid: campaign.cpc ?? null,
          lastSyncedAt: new Date(),
        },
        create: {
          externalId: campaign.id,
          trafficSourceId,
          adAccountId,
          name: campaign.name,
          status: mapCampaignStatus(campaign.status),
          dailyBudget: campaign.daily_budget ?? null,
          cpcBid: campaign.cpc ?? null,
          lastSyncedAt: new Date(),
        },
        select: { id: true },
      }),
    ),
  );

  // We can't easily distinguish insert vs update from Prisma upsert,
  // so report total as updated (conservative — avoids inflated insert counts)
  updated = campaigns.length;

  return { inserted, updated };
}
