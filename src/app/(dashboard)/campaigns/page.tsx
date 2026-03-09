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

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <CampaignFilters
        trafficSources={filterOptions.trafficSources}
        defaultSearch={searchParams.search}
        defaultStatus={searchParams.status}
        defaultSource={searchParams.source}
      />

      {/* ── Table or empty state ─────────────────────────────────────────────── */}
      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={
            hasActiveFilter
              ? "No campaigns match your filters"
              : "No campaigns synced yet"
          }
          description={
            hasActiveFilter
              ? "Try adjusting or clearing the filters above."
              : "Connect Taboola in Settings to sync your campaign data."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {/* Row count */}
          <div className="border-b border-slate-100 px-4 py-2.5">
            <span className="text-xs text-slate-400">
              {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}
              {hasActiveFilter ? " (filtered)" : ""}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-500">
                    Campaign
                  </th>
                  <th className="px-4 py-3 font-medium text-slate-500">
                    Source
                  </th>
                  <th className="px-4 py-3 font-medium text-slate-500">
                    Ad Account
                  </th>
                  <th className="px-4 py-3 font-medium text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">
                    Daily Budget
                  </th>
                  <th className="px-4 py-3 font-medium text-slate-500">
                    Last Synced
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((campaign) => (
                  <tr
                    key={campaign.id}
                    className="transition-colors hover:bg-slate-50/60"
                  >
                    {/* Campaign name */}
                    <td className="max-w-[280px] truncate px-4 py-3 font-medium text-slate-900">
                      {campaign.name}
                    </td>

                    {/* Traffic source */}
                    <td className="px-4 py-3 text-slate-500">
                      {campaign.trafficSource.name}
                    </td>

                    {/* Ad account */}
                    <td className="px-4 py-3 text-slate-500">
                      {campaign.adAccount?.name ?? (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-3">
                      <Badge variant={campaignStatusVariant(campaign.status)}>
                        {campaignStatusLabel(campaign.status)}
                      </Badge>
                    </td>

                    {/* Daily budget */}
                    <td className="px-4 py-3 text-right text-slate-700">
                      {campaign.dailyBudget !== null ? (
                        formatCurrency(campaign.dailyBudget, campaign.currency)
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Last synced */}
                    <td className="px-4 py-3 text-slate-400">
                      {formatRelativeTime(campaign.lastSyncedAt)}
                    </td>
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
