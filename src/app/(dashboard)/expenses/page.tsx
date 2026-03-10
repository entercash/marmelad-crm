export const dynamic = "force-dynamic";

import Link from "next/link";
import { Receipt, Plus, Pencil, DollarSign, LayoutList, Tags } from "lucide-react";

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
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata = { title: "Expenses" };

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style:                 "currency",
    currency:              "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

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
    try { categories = await getCategories(); } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Expenses"
        description="Track operational costs — accounts, AI services, domains, tools, and more"
        action={
          <div className="flex items-center gap-2">
            <Link href="/expenses/categories">
              <Button variant="outline" size="sm">
                <Tags className="mr-1.5 h-4 w-4" />
                Manage Categories
              </Button>
            </Link>
            <ExpenseDialog
              categories={categories}
              trigger={
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add Expense
                </Button>
              }
            />
          </div>
        }
      />

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      {summary.totalCount > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="glass flex items-center gap-3 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06]">
              <LayoutList className="h-4 w-4 text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Expenses</p>
              <p className="text-lg font-semibold text-white">{summary.totalCount}</p>
            </div>
          </div>

          <div className="glass flex items-center gap-3 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Spent</p>
              <p className="text-lg font-semibold text-white">{formatUsd(summary.totalAmount)}</p>
            </div>
          </div>

          {summary.byCategory.length > 0 && (
            <div className="glass flex flex-col gap-2 px-4 py-3 sm:col-span-2 lg:col-span-1">
              <p className="text-xs text-slate-400">By Category</p>
              <div className="flex flex-col gap-1">
                {summary.byCategory.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: cat.color ?? "#94a3b8" }}
                      />
                      <span className="text-slate-300">{cat.name}</span>
                      <span className="text-slate-500">({cat.count})</span>
                    </span>
                    <span className="font-medium tabular-nums text-slate-300">
                      {formatUsd(cat.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
        <div className="dark-table-wrap">
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <span className="text-xs text-slate-400">
              {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left">
                  <th className="px-4 py-3 font-medium text-slate-400">Spend Date</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Category</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Title / Description</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-400">Amount</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Source</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Campaign</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Vendor</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Recurrence</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Comment</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Created At</th>
                  <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/[0.05]">
                {expenses.map((exp) => {
                  const editData = {
                    id:         exp.id,
                    spendDate:  exp.spendDate.toISOString().slice(0, 10),
                    name:       exp.name,
                    amount:     String(exp.amount),
                    currency:   exp.currency,
                    recurrence: exp.recurrence,
                    vendor:     exp.vendor,
                    source:     exp.source,
                    campaign:   exp.campaign,
                    notes:      exp.notes,
                    comment:    exp.comment,
                    categoryId: exp.category.id,
                  };

                  return (
                    <tr key={exp.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-300">{formatDate(exp.spendDate)}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: exp.category.color ? `${exp.category.color}18` : "rgba(255,255,255,0.06)",
                            color: exp.category.color ?? "#94a3b8",
                          }}
                        >
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: exp.category.color ?? "#94a3b8" }}
                          />
                          {exp.category.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block max-w-[220px] truncate text-slate-300" title={exp.name}>{exp.name}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm font-medium text-white">
                        {formatUsd(exp.amount)}
                      </td>
                      <td className="px-4 py-3">
                        {exp.source ? (
                          <span className="block max-w-[140px] truncate text-slate-400" title={exp.source}>{exp.source}</span>
                        ) : (
                          <span className="text-slate-600">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {exp.campaign ? (
                          <span className="block max-w-[140px] truncate text-slate-400" title={exp.campaign}>{exp.campaign}</span>
                        ) : (
                          <span className="text-slate-600">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {exp.vendor ? (
                          <span className="block max-w-[140px] truncate text-slate-400" title={exp.vendor}>{exp.vendor}</span>
                        ) : (
                          <span className="text-slate-600">&mdash;</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                        {EXPENSE_RECURRENCE_LABELS[exp.recurrence as ExpenseRecurrenceValue] ?? exp.recurrence}
                      </td>
                      <td className="px-4 py-3">
                        {exp.comment ? (
                          <span className="block max-w-[160px] truncate text-xs text-slate-500" title={exp.comment}>{exp.comment}</span>
                        ) : (
                          <span className="text-slate-600">&mdash;</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDateTime(exp.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <ExpenseDialog
                            expense={editData}
                            categories={categories}
                            trigger={
                              <button
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
                                title="Edit expense"
                                aria-label="Edit expense"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            }
                          />
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
