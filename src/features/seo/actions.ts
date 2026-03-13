"use server";

import { revalidatePath } from "next/cache";
import { Prisma }         from "@prisma/client";

import { prisma }     from "@/lib/prisma";
import { guardWrite } from "@/lib/auth-guard";
import { seoBrandSchema, seoLeadSchema } from "./schema";

// ─── Result type ─────────────────────────────────────────────────────────────

export type ActionResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function toDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

const SEO_PATH = "/integrations/seo";

// ─── Brand CRUD ──────────────────────────────────────────────────────────────

export async function createSeoBrand(formData: FormData): Promise<ActionResult> {
  const denied = await guardWrite();
  if (denied) return denied;

  const parsed = seoBrandSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Validation failed",
      fieldErrors: extractFieldErrors(parsed.error.issues),
    };
  }

  try {
    await prisma.seoBrand.create({ data: parsed.data });
    revalidatePath(SEO_PATH);
    return { success: true };
  } catch (err) {
    console.error("[createSeoBrand]", err);
    return { success: false, error: "Failed to create SEO brand." };
  }
}

export async function deleteSeoBrand(id: string): Promise<ActionResult> {
  const denied = await guardWrite();
  if (denied) return denied;

  try {
    await prisma.seoBrand.delete({ where: { id } });
    revalidatePath(SEO_PATH);
    return { success: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { success: false, error: "Brand not found." };
    }
    console.error("[deleteSeoBrand]", err);
    return { success: false, error: "Failed to delete brand." };
  }
}

// ─── Lead CRUD ───────────────────────────────────────────────────────────────

export async function upsertSeoLead(formData: FormData): Promise<ActionResult> {
  const denied = await guardWrite();
  if (denied) return denied;

  const parsed = seoLeadSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Validation failed",
      fieldErrors: extractFieldErrors(parsed.error.issues),
    };
  }

  const { date, quantity, rate, seoBrandId, country, paymentModel } = parsed.data;

  const data = {
    quantity,
    paymentModel,
    rate: new Prisma.Decimal(rate),
    date: toDate(date),
    country,
    seoBrandId,
  };

  try {
    await prisma.seoLead.upsert({
      where: {
        seoBrandId_date_country: {
          seoBrandId,
          date: toDate(date),
          country,
        },
      },
      create: data,
      update: {
        quantity,
        paymentModel,
        rate: new Prisma.Decimal(rate),
      },
    });
    revalidatePath(SEO_PATH);
    return { success: true };
  } catch (err) {
    console.error("[upsertSeoLead]", err);
    return { success: false, error: "Failed to save lead entry." };
  }
}

export async function deleteSeoLead(id: string): Promise<ActionResult> {
  const denied = await guardWrite();
  if (denied) return denied;

  try {
    await prisma.seoLead.delete({ where: { id } });
    revalidatePath(SEO_PATH);
    return { success: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { success: false, error: "Lead not found." };
    }
    console.error("[deleteSeoLead]", err);
    return { success: false, error: "Failed to delete lead." };
  }
}
