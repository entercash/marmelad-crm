"use server";

/**
 * Account Top-Ups — server actions (create, update, delete).
 *
 * Top-ups are purely operational — they do NOT affect P&L or spend stats.
 * They only track how much money was deposited into ad accounts.
 */

import { revalidatePath } from "next/cache";
import { Prisma }         from "@prisma/client";

import { prisma }      from "@/lib/prisma";
import { guardWrite }  from "@/lib/auth-guard";
import { topUpSchema } from "./schema";

// ─── Shared result type ────────────────────────────────────────────────────────

export type ActionResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

// ─── Internal helpers ──────────────────────────────────────────────────────────

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
  return topUpSchema.safeParse(raw);
}

function toDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createTopUp(formData: FormData): Promise<ActionResult> {
  const denied = await guardWrite();
  if (denied) return denied;

  const parsed = parseForm(formData);

  if (!parsed.success) {
    return {
      success:     false,
      error:       parsed.error.issues[0]?.message ?? "Validation failed",
      fieldErrors: extractFieldErrors(parsed.error.issues),
    };
  }

  const { date, amount, ...rest } = parsed.data;

  try {
    await prisma.accountTopUp.create({
      data: {
        ...rest,
        date:   toDate(date),
        amount: new Prisma.Decimal(amount),
      },
    });
    revalidatePath("/balances");
    revalidatePath("/ad-accounts");
    return { success: true };
  } catch (err) {
    console.error("[createTopUp]", err);
    return { success: false, error: "Failed to create top-up. Please try again." };
  }
}

export async function updateTopUp(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await guardWrite();
  if (denied) return denied;

  const parsed = parseForm(formData);

  if (!parsed.success) {
    return {
      success:     false,
      error:       parsed.error.issues[0]?.message ?? "Validation failed",
      fieldErrors: extractFieldErrors(parsed.error.issues),
    };
  }

  const { date, amount, ...rest } = parsed.data;

  try {
    await prisma.accountTopUp.update({
      where: { id },
      data: {
        ...rest,
        date:   toDate(date),
        amount: new Prisma.Decimal(amount),
      },
    });
    revalidatePath("/balances");
    revalidatePath("/ad-accounts");
    return { success: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { success: false, error: "Top-up not found." };
    }
    console.error("[updateTopUp]", err);
    return { success: false, error: "Failed to update top-up. Please try again." };
  }
}

export async function deleteTopUp(id: string): Promise<ActionResult> {
  const denied = await guardWrite();
  if (denied) return denied;

  try {
    await prisma.accountTopUp.delete({ where: { id } });
    revalidatePath("/balances");
    revalidatePath("/ad-accounts");
    return { success: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { success: false, error: "Top-up not found." };
    }
    console.error("[deleteTopUp]", err);
    return { success: false, error: "Failed to delete top-up. Please try again." };
  }
}
