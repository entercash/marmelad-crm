import { PageHeader } from "@/components/shared/page-header";
import { Megaphone } from "lucide-react";

export const metadata = { title: "Campaigns" };

export default function CampaignsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Campaigns"
        description="Monitor ROI, spend, and revenue across all active campaigns"
      />

      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
        <Megaphone className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">No campaigns synced</p>
        <p className="mt-1 text-xs text-slate-400">
          Connect Taboola in Settings to sync your campaign data.
        </p>
      </div>
    </div>
  );
}
