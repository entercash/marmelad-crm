import { PageHeader } from "@/components/shared/page-header";
import { Receipt } from "lucide-react";

export const metadata = { title: "Expenses" };

export default function ExpensesPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Expenses"
        description="Track custom operational costs — tools, staff, services, and more"
      />

      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
        <Receipt className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">No expenses recorded</p>
        <p className="mt-1 text-xs text-slate-400">
          Add custom expenses to include them in your P&amp;L calculations.
        </p>
      </div>
    </div>
  );
}
