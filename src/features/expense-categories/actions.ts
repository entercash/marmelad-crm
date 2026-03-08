"use server";

/**
 * Expense Categories — server actions (create, update, delete).
 *
 * File-level "use server" makes every export a server action.
 * All exports must be async functions.
 *
 * Validation is handled by expenseCategorySchema (Zod).
 * Errors are returned as structured ActionResult objects — never thrown.
 *
 * Slug generation: auto-generated from the name (lowercase, replace spaces
 * with hyphens, strip non-alphanumeric). Uniqueness is enforced.
 */

import { revalidatePath } from "next/cache";
import { Prisma }         from "@prisma/client";

import { prisma }                from "@/lib/prisma";
import { guardWrite }            from "@/lib/auth-guard";
import { expenseCategorySchema } from "./schema";

// ─── Shared result type ────────────────────────────────────────────────────────

export type ActionResult =
  | { success: true; id?: string }
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
  return expenseCategorySchema.safeParse(raw);
}

/**
 * Generates a URL-safe slug from a category name.
 * "AI Services" → "ai-services"
 */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Ensures the slug is unique by appending a numeric suffix if needed.
 * Checks the database for existing slugs.
 */
async function uniqueSlug(slug: string, excludeId?: string): Promise<string> {
  let candidate = slug;
  let suffix = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.expenseCategory.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${slug}-${suffix}`;
    suffix++;
  }
}

function revalidate() {
  revalidatePath("/expenses/categories");
  revalidatePath("/expenses");
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createExpenseCategory(
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

  const { name, color } = parsed.data;

  // Case-insensitive duplicate check
  const duplicate = await prisma.expenseCategory.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate) {
    return {
      success:     false,
      error:       `Category "${name}" already exists.`,
      fieldErrors: { name: "A category with this name already exists" },
    };
  }

  const slug = await uniqueSlug(toSlug(name));

  try {
    const created = await prisma.expenseCategory.create({
      data: { slug, name, color, isSystem: false },
    });
    revalidate();
    return { success: true, id: created.id };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        success:     false,
        error:       `Category "${name}" already exists.`,
        fieldErrors: { name: "A category with this name already exists" },
      };
    }
    console.error("[createExpenseCategory]", err);
    return { success: false, error: "Failed to create category. Please try again." };
  }
}

export async function updateExpenseCategory(
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

  const { name, color } = parsed.data;

  // Case-insensitive duplicate check (exclude self)
  const duplicate = await prisma.expenseCategory.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      NOT:  { id },
    },
    select: { id: true },
  });
  if (duplicate) {
    return {
      success:     false,
      error:       `Category "${name}" already exists.`,
      fieldErrors: { name: "A category with this name already exists" },
    };
  }

  const slug = await uniqueSlug(toSlug(name), id);

  try {
    await prisma.expenseCategory.update({
      where: { id },
      data:  { slug, name, color },
    });
    revalidate();
    return { success: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { success: false, error: "Category not found." };
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        success:     false,
        error:       `Category "${name}" already exists.`,
        fieldErrors: { name: "A category with this name already exists" },
      };
    }
    console.error("[updateExpenseCategory]", err);
    return { success: false, error: "Failed to update category. Please try again." };
  }
}

export async function deleteExpenseCategory(id: string): Promise<ActionResult> {
  const denied = await guardWrite();
  if (denied) return denied;

  // Check if the category is used by any expenses
  const count = await prisma.expense.count({ where: { categoryId: id } });
  if (count > 0) {
    return {
      success: false,
      error:   `Cannot delete: ${count} expense${count !== 1 ? "s" : ""} use this category. Reassign them first.`,
    };
  }

  // Check if it's a system category
  const cat = await prisma.expenseCategory.findUnique({
    where: { id },
    select: { isSystem: true },
  });
  if (cat?.isSystem) {
    return {
      success: false,
      error:   "System categories cannot be deleted.",
    };
  }

  try {
    await prisma.expenseCategory.delete({ where: { id } });
    revalidate();
    return { success: true };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      return { success: false, error: "Category not found." };
    }
    console.error("[deleteExpenseCategory]", err);
    return { success: false, error: "Failed to delete category. Please try again." };
  }
}
