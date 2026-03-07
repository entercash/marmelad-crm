import { PageHeader } from "@/components/shared/page-header";
import { Building2 } from "lucide-react";

export const metadata = { title: "Agencies" };

export default function AgenciesPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Agencies"
        description="Manage agency relationships and link them to ad accounts"
      />

      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
        <Building2 className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">No agencies added</p>
        <p className="mt-1 text-xs text-slate-400">
          Add agencies to organize your ad accounts and track spend by agency.
        </p>
      </div>
    </div>
  );
}
