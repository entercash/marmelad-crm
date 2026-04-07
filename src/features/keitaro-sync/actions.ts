"use server";

import { revalidatePath } from "next/cache";

import { prisma }     from "@/lib/prisma";
import { guardWrite } from "@/lib/auth-guard";
import { KeitaroClient } from "@/integrations/keitaro/client";
import { getKeitaroInstances } from "@/features/integration-settings/queries";

// ─── Result type ────────────────────────────────────────────────────────────

export type SyncCampaignsResult =
  | { success: true; total: number; created: number; updated: number; deleted: number }
  | { success: false; error: string };

// ─── Main action ────────────────────────────────────────────────────────────

export async function syncKeitaroCampaigns(): Promise<SyncCampaignsResult> {
  const denied = await guardWrite();
  if (denied) return { success: false, error: !denied.success ? denied.error : "Access denied" };

  // Load all configured Keitaro instances
  const instances = (await getKeitaroInstances()).filter(
    (inst) => inst.apiUrl && inst.apiKey,
  );
  if (instances.length === 0) {
    return { success: false, error: "Keitaro is not configured. Go to Settings to add API credentials." };
  }

  // Create a single SyncLog for the whole operation
  const syncLog = await prisma.syncLog.create({
    data: {
      source:     "keitaro",
      entityType: "campaigns",
      status:     "RUNNING",
      startedAt:  new Date(),
    },
  });

  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalDeleted = 0;
  const errors: string[] = [];

  try {
    for (const instance of instances) {
      try {
        const client = new KeitaroClient({
          apiUrl: instance.apiUrl!,
          apiKey: instance.apiKey!,
        });
        const campaigns = await client.getCampaigns();
        totalFetched += campaigns.length;

        // Upsert each campaign scoped to this instance
        for (const c of campaigns) {
          const existing = await prisma.keitaroCampaign.findUnique({
            where: {
              instanceId_externalId: {
                instanceId: instance.id,
                externalId: c.id,
              },
            },
          });

          if (existing) {
            await prisma.keitaroCampaign.update({
              where: { id: existing.id },
              data: {
                name:      c.name,
                alias:     c.alias,
                state:     c.state,
                groupId:   c.group_id ?? null,
                syncLogId: syncLog.id,
              },
            });
            totalUpdated++;
          } else {
            await prisma.keitaroCampaign.create({
              data: {
                instanceId: instance.id,
                externalId: c.id,
                name:       c.name,
                alias:      c.alias,
                state:      c.state,
                groupId:    c.group_id ?? null,
                syncLogId:  syncLog.id,
              },
            });
            totalCreated++;
          }
        }

        // Delete only this instance's campaigns that no longer exist
        const remoteIds = new Set(campaigns.map((c) => c.id));
        const localCampaigns = await prisma.keitaroCampaign.findMany({
          where: { instanceId: instance.id },
          select: { id: true, externalId: true },
        });
        const toDelete = localCampaigns
          .filter((lc) => !remoteIds.has(lc.externalId))
          .map((lc) => lc.id);

        if (toDelete.length > 0) {
          const result = await prisma.keitaroCampaign.deleteMany({
            where: { id: { in: toDelete } },
          });
          totalDeleted += result.count;
        }
      } catch (instanceErr) {
        const msg = instanceErr instanceof Error ? instanceErr.message : "Unknown error";
        errors.push(`${instance.name}: ${msg}`);
        console.error(`[syncKeitaroCampaigns] Instance ${instance.id} failed:`, instanceErr);
      }
    }

    // Complete SyncLog
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status:          errors.length === instances.length ? "FAILED" : "SUCCESS",
        finishedAt:      new Date(),
        recordsFetched:  totalFetched,
        recordsInserted: totalCreated,
        recordsUpdated:  totalUpdated,
        errorMessage:    errors.length > 0 ? errors.join("; ") : null,
      },
    });

    revalidatePath("/integrations/keitaro");

    if (errors.length === instances.length) {
      return { success: false, error: errors.join("; ") };
    }

    return {
      success: true,
      total: totalFetched,
      created: totalCreated,
      updated: totalUpdated,
      deleted: totalDeleted,
    };
  } catch (err) {
    console.error("[syncKeitaroCampaigns] Failed:", err);

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status:       "FAILED",
        finishedAt:   new Date(),
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      },
    });

    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to sync campaigns",
    };
  }
}
