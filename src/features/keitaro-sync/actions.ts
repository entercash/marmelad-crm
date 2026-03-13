"use server";

import { revalidatePath } from "next/cache";

import { prisma }     from "@/lib/prisma";
import { guardWrite } from "@/lib/auth-guard";
import { KeitaroClient } from "@/integrations/keitaro/client";
import type { KeitaroConfig } from "@/integrations/keitaro/client";
import { getKeitaroSettings } from "@/features/integration-settings/queries";

// ─── Result type ────────────────────────────────────────────────────────────

export type SyncCampaignsResult =
  | { success: true; total: number; created: number; updated: number }
  | { success: false; error: string };

// ─── Main action ────────────────────────────────────────────────────────────

export async function syncKeitaroCampaigns(): Promise<SyncCampaignsResult> {
  const denied = await guardWrite();
  if (denied) return { success: false, error: !denied.success ? denied.error : "Access denied" };

  // Load config
  const settings = await getKeitaroSettings();
  if (!settings.apiUrl || !settings.apiKey) {
    return { success: false, error: "Keitaro is not configured. Go to Settings to add API credentials." };
  }

  const config: KeitaroConfig = {
    apiUrl: settings.apiUrl,
    apiKey: settings.apiKey,
  };

  // Create SyncLog
  const syncLog = await prisma.syncLog.create({
    data: {
      source:     "keitaro",
      entityType: "campaigns",
      status:     "RUNNING",
      startedAt:  new Date(),
    },
  });

  try {
    // Fetch campaigns from Keitaro API
    const client = new KeitaroClient(config);
    const campaigns = await client.getCampaigns();

    // Upsert each campaign
    let created = 0;
    let updated = 0;

    for (const c of campaigns) {
      const existing = await prisma.keitaroCampaign.findUnique({
        where: { externalId: c.id },
      });

      if (existing) {
        await prisma.keitaroCampaign.update({
          where: { externalId: c.id },
          data: {
            name:      c.name,
            alias:     c.alias,
            state:     c.state,
            groupId:   c.group_id ?? null,
            syncLogId: syncLog.id,
          },
        });
        updated++;
      } else {
        await prisma.keitaroCampaign.create({
          data: {
            externalId: c.id,
            name:       c.name,
            alias:      c.alias,
            state:      c.state,
            groupId:    c.group_id ?? null,
            syncLogId:  syncLog.id,
          },
        });
        created++;
      }
    }

    // Complete SyncLog
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status:          "SUCCESS",
        finishedAt:      new Date(),
        recordsFetched:  campaigns.length,
        recordsInserted: created,
        recordsUpdated:  updated,
      },
    });

    revalidatePath("/integrations/keitaro");

    return { success: true, total: campaigns.length, created, updated };
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
