export const dynamic = "force-dynamic";

import { Megaphone } from "lucide-react";

import { PageHeader }              from "@/components/shared/page-header";
import { EmptyState }              from "@/components/shared/empty-state";
import { Badge }                   from "@/components/ui/badge";
import { CampaignFilters }         from "./campaign-filters";
import {
  getCampaigns,
  getCampaignFilterOptions,
  type CampaignRow,
  type TrafficSourceOption,
} from "@/features/campaigns/queries";
import {
  campaignStatusLabel,
  campaignStatusVariant,
  formatRelativeTime,
} from "@/lib/format";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Campaigns" };

type SearchParams = {
  search?: string;
  status?: string;
  source?: string;
};

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  let campaigns: CampaignRow[] = [];
  let filterOptions: { trafficSources: TrafficSourceOption[] } = { trafficSources: [] };

  try {
    [campaigns, filterOptions] = await Promise.all([
      getCampaigns({
        search:          searchParams.search,
        status:          searchParams.status,
        trafficSourceId: searchParams.source,
      }),
      getCampaignFilterOptions(),
    ]);
  } catch (err) {
    console.error("[CampaignsPage] Failed to fetch data:", err);
  }

  const hasActiveFilter = !!(
    searchParams.search ||
    searchParams.status ||
    searchParams.source
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Campaigns"
        description="Monitor status and budget across all synced campaigns"
      />

      <CampaignFilters
        trafficSources={filterOptions.trafficSources}
        defaultSearch={searchParams.search}
        defaultStatus={searchParams.status}
        defaultSource={searchParams.source}
      />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={hasActiveFilter ? "No campaigns match your filters" : "No campaigns synced yet"}
          description={hasActiveFilter ? "Try adjusting or clearing the filters above." : "Connect Taboola in Settings to sync your campaign data."}
        />
      ) : (
        <div className="dark-table-wrap">
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <span className="text-xs text-slate-400">
              {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
              {hasActiveFilter ? " (filtered)" : ""}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left">
                  <th className="px-4 py-3 font-medium text-slate-400">Campaign</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Source</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Ad Account</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-400">Daily Budget</th>
                  <th className="px-4 py-3 font-medium text-slate-400">Last Synced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="transition-colors hover:bg-white/[0.03]">
                    <td className="max-w-[280px] truncate px-4 py-3 font-medium text-white">
                      {campaign.name}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{campaign.trafficSource.name}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {campaign.adAccount?.name ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={campaignStatusVariant(campaign.status)}>
                        {campaignStatusLabel(campaign.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {campaign.dailyBudget !== null ? (
                        formatCurrency(campaign.dailyBudget, campaign.currency)
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatRelativeTime(campaign.lastSyncedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
