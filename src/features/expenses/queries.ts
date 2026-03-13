/**
 * Expenses — database queries.
 *
 * ExpenseRow — full row shape with Date fields; safe for server components.
 *
 * ExpenseEditData — subset safe for client component props:
 *   `spendDate` converted to "YYYY-MM-DD" string, `amount` to string, so they
 *   cross the server -> client boundary without serialisation errors.
 *
 * CategoryOption — minimal shape for the category <select> dropdown.
 *
 * ExpenseSummary — aggregate totals computed from real DB data.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ─── Row types ────────────────────────────────────────────────────────────────

export type ExpenseRow = {
  id:         string;
  spendDate:  Date;
  name:       string;
  amount:     number; // Prisma Decimal -> number via .toNumber()
  currency:   string;
  recurrence: string;
  vendor:     string | null;
  source:     string | null;
  campaign:   string | null;
  notes:      string | null;
  comment:    string | null;
  createdAt:  Date;
  category: {
    id:    string;
    name:  string;
    color: string | null;
  };
};

/**
 * Safe to pass as props to client components — no Date / Decimal objects.
 */
export type ExpenseEditData = {
  id:         string;
  spendDate:  string; // "YYYY-MM-DD"
  name:       string;
  amount:     string; // stringified for the input
  currency:   string;
  recurrence: string;
  vendor:     string | null;
  source:     string | null;
  campaign:   string | null;
  notes:      string | null;
  comment:    string | null;
  categoryId: string;
};

export type CategoryOption = {
  id:    string;
  name:  string;
  slug:  string;
  color: string | null;
};

export type CategoryBreakdown = {
  name:  string;
  color: string | null;
  count: number;
  total: number;
};

export type ExpenseSummary = {
  totalCount:  number;
  totalAmount: number;
  byCategory:  CategoryBreakdown[];
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns all expenses ordered by spendDate descending, with category included.
 * Converts Prisma Decimal to JS number for easy rendering.
 */
export async function getExpenses(): Promise<ExpenseRow[]> {
  const rows = await prisma.expense.findMany({
    orderBy: [{ spendDate: "desc" }, { createdAt: "desc" }],
    select: {
      id:         true,
      spendDate:  true,
      name:       true,
      amount:     true,
      currency:   true,
      recurrence: true,
      vendor:     true,
      source:     true,
      campaign:   true,
      notes:      true,
      comment:    true,
      createdAt:  true,
      category: {
        select: {
          id:    true,
          name:  true,
          color: true,
        },
      },
    },
  });

  return rows.map((r) => ({
    ...r,
    amount: Number(r.amount),
  }));
}

/**
 * Returns all expense categories, ordered by name, for the category dropdown.
 */
export async function getCategories(): Promise<CategoryOption[]> {
  return prisma.expenseCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, color: true },
  });
}

/**
 * Computes real aggregate totals from the database.
 */
export async function getExpenseSummary(
  dateFrom?: string,
  dateTo?: string,
): Promise<ExpenseSummary> {
  const where: Prisma.ExpenseWhereInput = {};
  if (dateFrom && dateTo) {
    where.spendDate = {
      gte: new Date(`${dateFrom}T00:00:00.000Z`),
      lte: new Date(`${dateTo}T00:00:00.000Z`),
    };
  }

  const [agg, byCategory] = await Promise.all([
    prisma.expense.aggregate({
      where,
      _count: { id: true },
      _sum:   { amount: true },
    }),
    prisma.expense.groupBy({
      by: ["categoryId"],
      where,
      _count: { id: true },
      _sum:   { amount: true },
    }),
  ]);

  // Fetch category names for the breakdown
  let categoryBreakdown: CategoryBreakdown[] = [];
  if (byCategory.length > 0) {
    const categoryIds = byCategory.map((b) => b.categoryId);
    const categories = await prisma.expenseCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, color: true },
    });
    const catMap = new Map(categories.map((c) => [c.id, c]));

    categoryBreakdown = byCategory
      .map((b) => {
        const cat = catMap.get(b.categoryId);
        return {
          name:  cat?.name  ?? "Unknown",
          color: cat?.color ?? null,
          count: b._count.id,
          total: Number(b._sum.amount ?? 0),
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  return {
    totalCount:  agg._count.id,
    totalAmount: Number(agg._sum.amount ?? 0),
    byCategory:  categoryBreakdown,
  };
}
