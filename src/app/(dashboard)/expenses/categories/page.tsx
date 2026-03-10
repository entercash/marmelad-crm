export const dynamic = "force-dynamic";

import Link from "next/link";
import { Tags, Plus, Pencil, ArrowLeft, Lock } from "lucide-react";

import { PageHeader }            from "@/components/shared/page-header";
import { EmptyState }            from "@/components/shared/empty-state";
import { Button }                from "@/components/ui/button";
import { CategoryDialog }        from "@/features/expense-categories/components/category-dialog";
import { DeleteCategoryButton }  from "@/features/expense-categories/components/delete-category-button";
import {
  getExpenseCategories,
  type ExpenseCategoryRow,
} from "@/features/expense-categories/queries";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Expense Categories" };

export default async function ExpenseCategoriesPage() {
  let categories: ExpenseCategoryRow[] = [];
  try {
    categories = await getExpenseCategories();
  } catch (err) {
    console.error("[ExpenseCategoriesPage] Failed to fetch categories:", err);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/expenses"
          className="inline-flex w-fit items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Expenses
        </Link>

        <PageHeader
          title="Expense Categories"
          description="Manage categories used to classify expenses"
          action={
            <CategoryDialog
              trigger={
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add Category
                </Button>
              }
            />
          }
        />
      </div>

      {categories.length === 0 && (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          description="Create expense categories to organise your costs."
          action={
            <CategoryDialog
              trigger={
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add First Category
                </Button>
              }
            />
          }
        />
      )}

      {categories.length > 0 && (
        <div className="dark-table-wrap">
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <span className="text-xs text-slate-400">
              {categories.length} {categories.length === 1 ? "category" : "categories"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left">
                  <th className="px-4 py-3 font-medium text-slate-400">Name</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Slug</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-400">Expenses</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Type</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Created</th>
                  <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/[0.05]">
                {categories.map((cat) => {
                  const editData = {
                    id:       cat.id,
                    name:     cat.name,
                    color:    cat.color,
                    isSystem: cat.isSystem,
                  };

                  return (
                    <tr key={cat.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: cat.color ? `${cat.color}18` : "rgba(255,255,255,0.06)",
                            color: cat.color ?? "#94a3b8",
                          }}
                        >
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: cat.color ?? "#94a3b8" }}
                          />
                          {cat.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-slate-500">{cat.slug}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">
                        {cat.expenseCount}
                      </td>
                      <td className="px-4 py-3">
                        {cat.isSystem ? (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Lock className="h-3 w-3" />
                            System
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Custom</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {formatDate(cat.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <CategoryDialog
                            category={editData}
                            trigger={
                              <button
                                className="rounded p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
                                title="Edit category"
                                aria-label="Edit category"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            }
                          />
                          {!cat.isSystem && <DeleteCategoryButton id={cat.id} />}
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
