import { PageHeader } from "@/components/shared/page-header";
import { Globe2 } from "lucide-react";

export const metadata = { title: "Publishers" };

export default function PublishersPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Publishers"
        description="Analyze site performance by GEO and manage blacklist / whitelist decisions"
      />

      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
        <Globe2 className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">No publisher data</p>
        <p className="mt-1 text-xs text-slate-400">
          Publisher performance will appear here after Taboola sync is configured.
        </p>
      </div>
    </div>
  );
}
