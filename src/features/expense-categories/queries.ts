/**
 * Expense Categories — database queries.
 *
 * ExpenseCategoryRow — full row shape for the categories table.
 * ExpenseCategoryEditData — safe to pass as props to client components.
 */

import { prisma } from "@/lib/prisma";

// ─── Row types ────────────────────────────────────────────────────────────────

export type ExpenseCategoryRow = {
  id:           string;
  slug:         string;
  name:         string;
  color:        string | null;
  isSystem:     boolean;
  expenseCount: number;
  createdAt:    Date;
  updatedAt:    Date;
};

/**
 * Safe to pass as props to client components — no Date objects.
 */
export type ExpenseCategoryEditData = {
  id:       string;
  name:     string;
  color:    string | null;
  isSystem: boolean;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns all expense categories with the count of linked expenses.
 * Ordered by name ascending.
 */
export async function getExpenseCategories(): Promise<ExpenseCategoryRow[]> {
  const rows = await prisma.expenseCategory.findMany({
    orderBy: { name: "asc" },
    select: {
      id:        true,
      slug:      true,
      name:      true,
      color:     true,
      isSystem:  true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { expenses: true },
      },
    },
  });

  return rows.map((r) => ({
    id:           r.id,
    slug:         r.slug,
    name:         r.name,
    color:        r.color,
    isSystem:     r.isSystem,
    expenseCount: r._count.expenses,
    createdAt:    r.createdAt,
    updatedAt:    r.updatedAt,
  }));
}
