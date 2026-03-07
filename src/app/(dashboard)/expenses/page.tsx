export const dynamic = "force-dynamic";

import { Receipt, Plus, Pencil, DollarSign, LayoutList } from "lucide-react";

import { PageHeader }          from "@/components/shared/page-header";
import { EmptyState }          from "@/components/shared/empty-state";
import { Button }              from "@/components/ui/button";
import { ExpenseDialog }       from "@/features/expenses/components/expense-dialog";
import { DeleteExpenseButton } from "@/features/expenses/components/delete-expense-button";
import {
  getExpenses,
  getCategories,
  getExpenseSummary,
  type ExpenseRow,
  type CategoryOption,
  type ExpenseSummary,
} from "@/features/expenses/queries";
import { EXPENSE_RECURRENCE_LABELS, type ExpenseRecurrenceValue } from "@/features/expenses/schema";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Expenses" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style:                 "currency",
    currency:              "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ExpensesPage() {
  let expenses:   ExpenseRow[]    = [];
  let categories: CategoryOption[] = [];
  let summary:    ExpenseSummary   = { totalCount: 0, totalAmount: 0, byCategory: [] };

  try {
    [expenses, categories, summary] = await Promise.all([
      getExpenses(),
      getCategories(),
      getExpenseSummary(),
    ]);
  } catch (err) {
    console.error("[ExpensesPage] Failed to fetch expenses:", err);
    // Graceful fallback — page renders with empty state
    try { categories = await getCategories(); } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Expenses"
        description="Track operational costs — accounts, AI services, domains, tools, and more"
        action={
          <ExpenseDialog
            categories={categories}
            trigger={
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                Add Expense
              </Button>
            }
          />
        }
      />

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      {summary.totalCount > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Total count */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
              <LayoutList className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Expenses</p>
              <p className="text-lg font-semibold text-slate-900">{summary.totalCount}</p>
            </div>
          </div>

          {/* Total amount */}
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Spent</p>
              <p className="text-lg font-semibold text-slate-900">{formatUsd(summary.totalAmount)}</p>
            </div>
          </div>

          {/* Category breakdown */}
          {summary.byCategory.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm sm:col-span-2 lg:col-span-1">
              <p className="text-xs text-slate-500">By Category</p>
              <div className="flex flex-col gap-1">
                {summary.byCategory.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: cat.color ?? "#94a3b8" }}
                      />
                      <span className="text-slate-600">{cat.name}</span>
                      <span className="text-slate-400">({cat.count})</span>
                    </span>
                    <span className="font-medium tabular-nums text-slate-700">
                      {formatUsd(cat.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {expenses.length === 0 && (
        <EmptyState
          icon={Receipt}
          title="No expenses recorded"
          description="Add operational expenses to track what was spent, on what, and when."
          action={
            <ExpenseDialog
              categories={categories}
              trigger={
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add First Expense
                </Button>
              }
            />
          }
        />
      )}

      {/* ── Expenses table ──────────────────────────────────────────────────── */}
      {expenses.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {/* Row count */}
          <div className="border-b border-slate-100 px-4 py-2.5">
            <span className="text-xs text-slate-400">
              {expenses.length}{" "}
              {expenses.length === 1 ? "expense" : "expenses"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-500">Date</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Category</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Title / Description</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Vendor</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Amount</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Recurrence</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Notes</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {expenses.map((exp) => {
                  // Build the serialisable edit-data object (no Date / Decimal objects).
                  const editData = {
                    id:         exp.id,
                    date:       exp.date.toISOString().slice(0, 10),
                    name:       exp.name,
                    amount:     String(exp.amount),
                    currency:   exp.currency,
                    recurrence: exp.recurrence,
                    vendor:     exp.vendor,
                    notes:      exp.notes,
                    categoryId: exp.category.id,
                  };

                  return (
                    <tr
                      key={exp.id}
                      className="transition-colors hover:bg-slate-50/60"
                    >
                      {/* Date */}
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(exp.date)}
                      </td>

                      {/* Category badge */}
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: exp.category.color
                              ? `${exp.category.color}18`
                              : "#f1f5f9",
                            color: exp.category.color ?? "#475569",
                          }}
                        >
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: exp.category.color ?? "#94a3b8" }}
                          />
                          {exp.category.name}
                        </span>
                      </td>

                      {/* Title */}
                      <td className="px-4 py-3">
                        <span
                          className="block max-w-[220px] truncate text-slate-700"
                          title={exp.name}
                        >
                          {exp.name}
                        </span>
                      </td>

                      {/* Vendor */}
                      <td className="px-4 py-3">
                        {exp.vendor ? (
                          <span
                            className="block max-w-[140px] truncate text-slate-600"
                            title={exp.vendor}
                          >
                            {exp.vendor}
                          </span>
                        ) : (
                          <span className="text-slate-300">&mdash;</span>
                        )}
                      </td>

                      {/* Amount — right-aligned, monospace */}
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm font-medium text-slate-900">
                        {formatUsd(exp.amount)}
                      </td>

                      {/* Recurrence */}
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {EXPENSE_RECURRENCE_LABELS[exp.recurrence as ExpenseRecurrenceValue] ?? exp.recurrence}
                      </td>

                      {/* Notes — truncated */}
                      <td className="px-4 py-3">
                        {exp.notes ? (
                          <span
                            className="block max-w-[160px] truncate text-xs text-slate-500"
                            title={exp.notes}
                          >
                            {exp.notes}
                          </span>
                        ) : (
                          <span className="text-slate-300">&mdash;</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit */}
                          <ExpenseDialog
                            expense={editData}
                            categories={categories}
                            trigger={
                              <button
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                title="Edit expense"
                                aria-label="Edit expense"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            }
                          />

                          {/* Delete */}
                          <DeleteExpenseButton id={exp.id} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
