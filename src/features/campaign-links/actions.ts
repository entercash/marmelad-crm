"use server";

import { revalidatePath } from "next/cache";
import { Prisma }         from "@prisma/client";

import { prisma }     from "@/lib/prisma";
import { guardWrite } from "@/lib/auth-guard";
import type { ActionResult } from "@/lib/auth-guard";
import { campaignLinkSchema } from "./schema";

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractFieldErrors(
  issues: { path: readonly PropertyKey[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

// ─── Create ─────────────────────────────────────────────────────────────────

export async function createCampaignLink(
  formData: FormData,
): Promise<ActionResult> {
  const denied = await guardWrite();
  if (denied) return denied;

  const raw = Object.fromEntries(formData.entries());
  const parsed = campaignLinkSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Validation failed",
      fieldErrors: extractFieldErrors(parsed.error.issues),
    };
  }

  const {
    taboolaCampaignExternalId,
    taboolaCampaignName,
    keitaroCampaignId,
    paymentModel,
    cplRate,
    country,
    adspectStreamId,
  } = parsed.data;

  try {
    await prisma.campaignLink.create({
      data: {
        taboolaCampaignExternalId,
        taboolaCampaignName,
        keitaroCampaignId,
        paymentModel,
        cplRate:
          paymentModel === "CPL" && cplRate
            ? new Prisma.Decimal(cplRate)
            : null,
        country: country ?? null,
        adspectStreamId: adspectStreamId ?? null,
      },
    });

    revalidatePath("/campaigns");
    return { success: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { success: false, error: "This mapping already exists." };
    }
    console.error("[createCampaignLink]", err);
    return { success: false, error: "Failed to create mapping." };
  }
}

// ─── Create (batch — multiple Taboola → 1 Keitaro) ────────────────────────

export async function createCampaignLinks(
  formData: FormData,
): Promise<ActionResult> {
  const denied = await guardWrite();
  if (denied) return denied;

  const campaignsJson = formData.get("taboolaCampaigns");
  if (!campaignsJson || typeof campaignsJson !== "string") {
    return { success: false, error: "No Taboola campaigns selected." };
  }

  let campaigns: { externalId: string; name: string }[];
  try {
    campaigns = JSON.parse(campaignsJson);
  } catch {
    return { success: false, error: "Invalid campaign data." };
  }

  if (campaigns.length === 0) {
    return { success: false, error: "Select at least one Taboola campaign." };
  }

  const keitaroCampaignId = formData.get("keitaroCampaignId") as string;
  const paymentModel = formData.get("paymentModel") as string;
  const cplRateRaw = (formData.get("cplRate") as string)?.trim() ?? "";
  const country = (formData.get("country") as string)?.trim() || null;
  const adspectStreamId = (formData.get("adspectStreamId") as string)?.trim() || null;

  if (!keitaroCampaignId) {
    return { success: false, error: "Keitaro campaign is required." };
  }
  if (!paymentModel || !["CPL", "CPA"].includes(paymentModel)) {
    return { success: false, error: "Payment model is required." };
  }
  if (paymentModel === "CPL") {
    const num = Number(cplRateRaw);
    if (!cplRateRaw || Number.isNaN(num) || num <= 0) {
      return { success: false, error: "CPL rate is required and must be > 0.", fieldErrors: { cplRate: "Required for CPL" } };
    }
  }

  const cplRate = paymentModel === "CPL" && cplRateRaw
    ? new Prisma.Decimal(cplRateRaw)
    : null;

  try {
    let created = 0;
    let skipped = 0;

    for (const camp of campaigns) {
      try {
        await prisma.campaignLink.create({
          data: {
            taboolaCampaignExternalId: camp.externalId,
            taboolaCampaignName: camp.name,
            keitaroCampaignId,
            paymentModel: paymentModel as "CPL" | "CPA",
            cplRate,
            country,
            adspectStreamId,
          },
        });
        created++;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          skipped++; // Already exists — skip
        } else {
          throw err;
        }
      }
    }

    revalidatePath("/campaigns");

    if (skipped > 0 && created === 0) {
      return { success: false, error: `All ${skipped} mappings already exist.` };
    }

    return { success: true };
  } catch (err) {
    console.error("[createCampaignLinks]", err);
    return { success: false, error: "Failed to create mappings." };
  }
}

// ─── Delete ─────────────────────────────────────────────────────────────────

export async function deleteCampaignLink(id: string): Promise<ActionResult> {
  const denied = await guardWrite();
  if (denied) return denied;

  try {
    await prisma.campaignLink.delete({ where: { id } });
    revalidatePath("/campaigns");
    return { success: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { success: false, error: "Mapping not found." };
    }
    console.error("[deleteCampaignLink]", err);
    return { success: false, error: "Failed to delete mapping." };
  }
}
