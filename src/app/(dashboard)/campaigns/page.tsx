export const dynamic = "force-dynamic";

import { Link2, Plus } from "lucide-react";

import { PageHeader }  from "@/components/shared/page-header";
import { EmptyState }  from "@/components/shared/empty-state";
import { Badge }       from "@/components/ui/badge";
import { Button }      from "@/components/ui/button";
import { formatCurrency, formatPercent } from "@/lib/utils";

import { CampaignLinkDialog } from "@/features/campaign-links/components/campaign-link-dialog";
import { DeleteLinkButton }   from "@/features/campaign-links/components/delete-link-button";
import {
  getCampaignLinkStats,
  getDistinctTaboolaCampaigns,
  getKeitaroCampaignOptions,
  type CampaignStatsRow,
} from "@/features/campaign-links/queries";

export const metadata = { title: "Campaigns" };

// ─── Formatters ─────────────────────────────────────────────────────────────

function fmtNum(val: number | null): string {
  if (val === null) return "—";
  return new Intl.NumberFormat("en-US").format(val);
}

function fmtUsd(val: number | null): string {
  if (val === null) return "—";
  return formatCurrency(val, "USD");
}

function fmtRoi(val: number | null): string {
  if (val === null) return "—";
  return formatPercent(val, 1);
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function CampaignsPage() {
  let stats: CampaignStatsRow[] = [];
  let taboolaCampaigns: Awaited<ReturnType<typeof getDistinctTaboolaCampaigns>> = [];
  let keitaroCampaigns: Awaited<ReturnType<typeof getKeitaroCampaignOptions>> = [];

  try {
    [stats, taboolaCampaigns, keitaroCampaigns] = await Promise.all([
      getCampaignLinkStats(),
      getDistinctTaboolaCampaigns(),
      getKeitaroCampaignOptions(),
    ]);
  } catch (err) {
    console.error("[CampaignsPage] Failed to fetch data:", err);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Campaigns"
        description="Map Taboola campaigns to Keitaro and track performance"
        action={
          <CampaignLinkDialog
            taboolaCampaigns={taboolaCampaigns}
            keitaroCampaigns={keitaroCampaigns}
            trigger={
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                Add Mapping
              </Button>
            }
          />
        }
      />

      {stats.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="No campaign mappings yet"
          description="Map a Taboola campaign to a Keitaro campaign to start tracking P&L."
          action={
            <CampaignLinkDialog
              taboolaCampaigns={taboolaCampaigns}
              keitaroCampaigns={keitaroCampaigns}
              trigger={
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add First Mapping
                </Button>
              }
            />
          }
        />
      ) : (
        <div className="dark-table-wrap">
          <div className="border-b border-white/[0.06] px-4 py-2.5">
            <span className="text-xs text-slate-400">
              {stats.length} mapping{stats.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Keitaro Campaign</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3 text-right">Clicks</th>
                  <th className="px-4 py-3 text-right">Leads</th>
                  <th className="px-4 py-3 text-right">Spend</th>
                  <th className="px-4 py-3 text-right">CPL</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">ROI</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {stats.map((row) => (
                  <tr
                    key={row.linkId}
                    className="transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="max-w-[240px] truncate px-4 py-3 font-medium text-white">
                      {row.keitaroCampaignName}
                      <p className="truncate text-[11px] font-normal text-slate-500">
                        {row.taboolaCampaignName}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          row.paymentModel === "CPL" ? "secondary" : "outline"
                        }
                      >
                        {row.paymentModel}
                        {row.paymentModel === "CPL" && row.cplRate !== null
                          ? ` $${row.cplRate}`
                          : ""}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">
                      {fmtNum(row.clicks)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">
                      {fmtNum(row.leads)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">
                      {fmtUsd(row.spend)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">
                      {fmtUsd(row.cpl)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">
                      {fmtUsd(row.revenue)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                      <span
                        className={
                          row.roi !== null
                            ? row.roi >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                            : "text-slate-500"
                        }
                      >
                        {fmtRoi(row.roi)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteLinkButton id={row.linkId} />
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
