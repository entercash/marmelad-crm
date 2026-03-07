"use server";

/**
 * Agencies — server actions (create, update, delete).
 *
 * File-level "use server" makes every export a server action.
 * All exports must be async functions.
 *
 * Validation is handled by agencySchema (Zod).
 * Errors are returned as structured ActionResult objects — never thrown.
 */

import { revalidatePath } from "next/cache";
import { Prisma }         from "@prisma/client";

import { prisma }       from "@/lib/prisma";
import { agencySchema } from "./schema";

// ─── Shared result type ────────────────────────────────────────────────────────

export type ActionResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

// ─── Internal helpers ──────────────────────────────────────────────────────────

// Zod v4 uses PropertyKey[] (string | number | symbol) for issue paths.
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

function parseForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return agencySchema.safeParse(raw);
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createAgency(formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(formData);

  if (!parsed.success) {
    return {
      success:     false,
      error:       parsed.error.issues[0]?.message ?? "Validation failed",
      fieldErrors: extractFieldErrors(parsed.error.issues),
    };
  }

  try {
    await prisma.agency.create({ data: parsed.data });
    revalidatePath("/agencies");
    return { success: true };
  } catch (err) {
    console.error("[createAgency]", err);
    return { success: false, error: "Failed to create agency. Please try again." };
  }
}

export async function updateAgency(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseForm(formData);

  if (!parsed.success) {
    return {
      success:     false,
      error:       parsed.error.issues[0]?.message ?? "Validation failed",
      fieldErrors: extractFieldErrors(parsed.error.issues),
    };
  }

  try {
    await prisma.agency.update({ where: { id }, data: parsed.data });
    revalidatePath("/agencies");
    return { success: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { success: false, error: "Agency not found." };
    }
    console.error("[updateAgency]", err);
    return { success: false, error: "Failed to update agency. Please try again." };
  }
}

export async function deleteAgency(id: string): Promise<ActionResult> {
  try {
    // Guard: prevent deletion if ad accounts are still linked
    const adAccountCount = await prisma.adAccount.count({
      where: { agencyId: id },
    });

    if (adAccountCount > 0) {
      return {
        success: false,
        error: `Cannot delete: ${adAccountCount} ad account${
          adAccountCount !== 1 ? "s are" : " is"
        } linked to this agency. Unlink them first.`,
      };
    }

    await prisma.agency.delete({ where: { id } });
    revalidatePath("/agencies");
    return { success: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { success: false, error: "Agency not found." };
    }
    console.error("[deleteAgency]", err);
    return { success: false, error: "Failed to delete agency. Please try again." };
  }
}
