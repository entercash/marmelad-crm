"use server";

/**
 * White Pages — server actions (create, update, delete).
 *
 * File-level "use server" makes every export a server action.
 * All exports must be async functions.
 *
 * Validation is handled by whitePageSchema (Zod).
 * Errors are returned as structured ActionResult objects — never thrown.
 */

import { revalidatePath } from "next/cache";
import { Prisma }         from "@prisma/client";

import { prisma }          from "@/lib/prisma";
import { whitePageSchema } from "./schema";

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
  return whitePageSchema.safeParse(raw);
}

/**
 * Converts the validated "YYYY-MM-DD" string to a UTC midnight Date
 * so Prisma stores the correct date regardless of the server's local timezone.
 */
function toTransferDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createWhitePage(formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(formData);

  if (!parsed.success) {
    return {
      success:     false,
      error:       parsed.error.issues[0]?.message ?? "Validation failed",
      fieldErrors: extractFieldErrors(parsed.error.issues),
    };
  }

  const { transferDate, ...rest } = parsed.data;

  try {
    await prisma.whitePage.create({
      data: { ...rest, transferDate: toTransferDate(transferDate) },
    });
    revalidatePath("/white-pages");
    return { success: true };
  } catch (err) {
    console.error("[createWhitePage]", err);
    return { success: false, error: "Failed to create white page. Please try again." };
  }
}

export async function updateWhitePage(
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

  const { transferDate, ...rest } = parsed.data;

  try {
    await prisma.whitePage.update({
      where: { id },
      data:  { ...rest, transferDate: toTransferDate(transferDate) },
    });
    revalidatePath("/white-pages");
    return { success: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { success: false, error: "White page not found." };
    }
    console.error("[updateWhitePage]", err);
    return { success: false, error: "Failed to update white page. Please try again." };
  }
}

export async function deleteWhitePage(id: string): Promise<ActionResult> {
  try {
    await prisma.whitePage.delete({ where: { id } });
    revalidatePath("/white-pages");
    return { success: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { success: false, error: "White page not found." };
    }
    console.error("[deleteWhitePage]", err);
    return { success: false, error: "Failed to delete white page. Please try again." };
  }
}
