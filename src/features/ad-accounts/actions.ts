"use server";

/**
 * Accounts — server actions (create, update, delete).
 *
 * Validation is handled by accountSchema (Zod).
 * Errors are returned as structured ActionResult objects — never thrown.
 */

import { revalidatePath } from "next/cache";
import { Prisma }         from "@prisma/client";

import { prisma }         from "@/lib/prisma";
import { guardWrite }     from "@/lib/auth-guard";
import { accountSchema }  from "./schema";

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
  return accountSchema.safeParse(raw);
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createAccount(formData: FormData): Promise<ActionResult> {
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

  try {
    await prisma.account.create({ data: parsed.data });
    revalidatePath("/ad-accounts");
    return { success: true };
  } catch (err) {
    console.error("[createAccount]", err);
    return { success: false, error: "Failed to create account. Please try again." };
  }
}

export async function updateAccount(
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

  try {
    await prisma.account.update({ where: { id }, data: parsed.data });
    revalidatePath("/ad-accounts");
    return { success: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { success: false, error: "Account not found." };
    }
    console.error("[updateAccount]", err);
    return { success: false, error: "Failed to update account. Please try again." };
  }
}

export async function deleteAccount(id: string): Promise<ActionResult> {
  const denied = await guardWrite();
  if (denied) return denied;

  try {
    await prisma.account.delete({ where: { id } });
    revalidatePath("/ad-accounts");
    return { success: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { success: false, error: "Account not found." };
    }
    console.error("[deleteAccount]", err);
    return { success: false, error: "Failed to delete account. Please try again." };
  }
}
