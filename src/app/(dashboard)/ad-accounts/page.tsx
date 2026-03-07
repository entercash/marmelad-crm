import { PageHeader } from "@/components/shared/page-header";
import { CreditCard } from "lucide-react";

export const metadata = { title: "Ad Accounts" };

export default function AdAccountsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Ad Accounts"
        description="Manage platform ad accounts across all connected traffic sources"
      />

      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
        <CreditCard className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">No ad accounts connected</p>
        <p className="mt-1 text-xs text-slate-400">
          Add your Taboola ad accounts to start tracking spend and performance.
        </p>
      </div>
    </div>
  );
}
