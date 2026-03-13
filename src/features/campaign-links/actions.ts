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
