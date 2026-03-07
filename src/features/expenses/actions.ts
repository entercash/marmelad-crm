"use server";

/**
 * Expenses — server actions (create, update, delete).
 *
 * File-level "use server" makes every export a server action.
 * All exports must be async functions.
 *
 * Validation is handled by expenseSchema (Zod).
 * Errors are returned as structured ActionResult objects — never thrown.
 */

import { revalidatePath } from "next/cache";
import { Prisma }         from "@prisma/client";

import { prisma }        from "@/lib/prisma";
import { expenseSchema } from "./schema";

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
  return expenseSchema.safeParse(raw);
}

/**
 * Converts the validated "YYYY-MM-DD" string to a UTC midnight Date
 * so Prisma stores the correct date regardless of the server's local timezone.
 */
function toExpenseDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createExpense(formData: FormData): Promise<ActionResult> {
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
    await prisma.expense.create({
      data: {
        ...rest,
        date:   toExpenseDate(date),
        amount: new Prisma.Decimal(amount),
      },
    });
    revalidatePath("/expenses");
    return { success: true };
  } catch (err) {
    console.error("[createExpense]", err);
    return { success: false, error: "Failed to create expense. Please try again." };
  }
}

export async function updateExpense(
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

  const { date, amount, ...rest } = parsed.data;

  try {
    await prisma.expense.update({
      where: { id },
      data: {
        ...rest,
        date:   toExpenseDate(date),
        amount: new Prisma.Decimal(amount),
      },
    });
    revalidatePath("/expenses");
    return { success: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { success: false, error: "Expense not found." };
    }
    console.error("[updateExpense]", err);
    return { success: false, error: "Failed to update expense. Please try again." };
  }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  try {
    await prisma.expense.delete({ where: { id } });
    revalidatePath("/expenses");
    return { success: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { success: false, error: "Expense not found." };
    }
    console.error("[deleteExpense]", err);
    return { success: false, error: "Failed to delete expense. Please try again." };
  }
}
