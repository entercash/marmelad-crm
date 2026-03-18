export const dynamic = "force-dynamic";

import Link from "next/link";
import { Globe2 } from "lucide-react";

import { PageHeader }  from "@/components/shared/page-header";
import { EmptyState }  from "@/components/shared/empty-state";
import { formatCurrency, formatPercent } from "@/lib/utils";

import { DateRangeFilter }  from "@/components/shared/date-range-filter";
import { PublisherFilters } from "./publisher-filters";
import {
  getPublisherStats,
  getPublisherDailyTrends,
  getDistinctCountries,
  type PublisherStatsRow,
  type SiteTrends,
} from "@/features/publishers/queries";
import { parseDateFilter } from "@/lib/date";
import { Sparkline, roiTrendColor, botTrendColor } from "@/components/ui/sparkline";

export const metadata = { title: "Publishers" };

// ─── Formatters ─────────────────────────────────────────────────────────────

function fmtNum(val: number | null): string {
  if (val === null) return "—";
  return new Intl.NumberFormat("en-US").format(val);
}

function fmtUsd(val: number | null): string {
  if (val === null) return "—";
  return formatCurrency(val, "USD");
}

function fmtPct(val: number | null): string {
  if (val === null) return "—";
  return formatPercent(val, 1);
}

// ─── Page ───────────────────────────────────────────────────────────────────

type SearchParams = { country?: string; page?: string; period?: string; from?: string; to?: string; linked?: string };

export default async function PublishersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const dateRange = parseDateFilter(searchParams);
  const country = searchParams.country;
  const linkedOnly = searchParams.linked === "1";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const perPage = 50;

  let stats: { rows: PublisherStatsRow[]; total: number } = {
    rows: [],
    total: 0,
  };
  let countries: { code: string; name: string }[] = [];
  let trends = new Map<string, SiteTrends>();

  try {
    [stats, countries] = await Promise.all([
      getPublisherStats({ country, page, perPage, dateFrom: dateRange?.from, dateTo: dateRange?.to, linkedOnly }),
      getDistinctCountries(),
    ]);

    // Fetch sparkline trends for sites on this page (7-day window, independent of date filter)
    if (stats.rows.length > 0) {
      const siteIds = stats.rows.map((r) => r.siteExternalId);
      trends = await getPublisherDailyTrends(siteIds);
    }
  } catch (err) {
    console.error("[PublishersPage] Failed to fetch data:", err);
  }

  const totalPages = Math.ceil(stats.total / perPage);
  const hasData = stats.rows.length > 0;

  // Build URL helper for pagination links
  function buildPageUrl(p: number): string {
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    if (searchParams.period) params.set("period", searchParams.period);
    if (searchParams.from) params.set("from", searchParams.from);
    if (searchParams.to) params.set("to", searchParams.to);
    if (linkedOnly) params.set("linked", "1");
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/publishers${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Publishers"
        description="Analyze site performance from Taboola CSV imports"
      />

      <div className="flex flex-wrap items-center gap-4">
        <DateRangeFilter basePath="/publishers" preserveParams={["country"]} />
        <PublisherFilters countries={countries} />
      </div>

      {!hasData ? (
        <EmptyState
          icon={Globe2}
          title={
            country
              ? "No publishers for this country"
              : "No publisher data yet"
          }
          description={
            country
              ? "Try selecting a different country or clear the filter."
              : "Publisher stats will appear here after importing Taboola CSV data."
          }
        />
      ) : (
        <div className="dark-table-wrap">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
            <span className="text-xs text-slate-400">
              {stats.total} site{stats.total !== 1 ? "s" : ""}
              {country ? ` in ${country}` : ""}
            </span>
            {totalPages > 1 && (
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Site</th>
                  <th className="px-4 py-3 text-right">Clicks</th>
                  <th className="px-4 py-3 text-right">Bot%</th>
                  <th className="px-4 py-3 text-right">ΔClicks</th>
                  <th className="px-4 py-3 text-right">Impressions</th>
                  <th className="px-4 py-3 text-right">Spend</th>
                  <th className="px-4 py-3 text-right">CPC</th>
                  <th className="px-4 py-3 text-right">CTR</th>
                  <th className="px-4 py-3 text-right">Leads</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Profit</th>
                  <th className="px-4 py-3 text-right">ROI</th>
                  <th className="px-4 py-3 text-center">ROI Trend</th>
                  <th className="px-4 py-3 text-center">Bot% Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {stats.rows.map((row) => (
                  <tr
                    key={row.siteExternalId}
                    className="transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="max-w-[300px] px-4 py-3">
                      <div className="truncate font-medium text-white">
                        {row.siteName}
                      </div>
                      <div className="truncate text-[11px] tabular-nums text-slate-500">
                        ID: {row.siteExternalId}
                      </div>
                      {row.siteUrl && (
                        <div className="truncate text-[11px] text-slate-500">
                          {row.siteUrl}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">
                      {fmtNum(row.clicks)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                      <span
                        className={
                          row.botPercent === null
                            ? "text-slate-500"
                            : row.botPercent <= 20
                              ? "text-emerald-400"
                              : row.botPercent <= 50
                                ? "text-amber-400"
                                : "text-red-400"
                        }
                      >
                        {row.botPercent !== null ? `${row.botPercent.toFixed(1)}%` : "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">
                      {row.clickDiscrepancy !== null ? fmtNum(row.clickDiscrepancy) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">
                      {fmtNum(row.impressions)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">
                      {fmtUsd(row.spend)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">
                      {fmtUsd(row.cpc)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">
                      {fmtPct(row.ctr)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">
                      {fmtNum(row.leads)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">
                      {fmtUsd(row.revenue)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                      <span
                        className={
                          row.profit !== null
                            ? row.profit >= 0
                              ? "text-emerald-400"
                              : "text-red-400"
                            : "text-slate-500"
                        }
                      >
                        {fmtUsd(row.profit)}
                      </span>
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
                        {fmtPct(row.roi)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(() => {
                        const t = trends.get(row.siteExternalId);
                        if (!t || t.roiTrend.length < 2) return <span className="text-slate-500">—</span>;
                        const color = roiTrendColor(t.roiTrend);
                        const last = t.roiTrend[t.roiTrend.length - 1];
                        return <Sparkline data={t.roiTrend} color={color} label={`${last > 0 ? "+" : ""}${last.toFixed(0)}%`} />;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(() => {
                        const t = trends.get(row.siteExternalId);
                        if (!t || t.botTrend.length < 2) return <span className="text-slate-500">—</span>;
                        const last = t.botTrend[t.botTrend.length - 1];
                        const color = botTrendColor(last);
                        return <Sparkline data={t.botTrend} color={color} label={`${last.toFixed(0)}%`} />;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3">
              <span className="text-xs text-slate-500">
                Showing {(page - 1) * perPage + 1}–
                {Math.min(page * perPage, stats.total)} of {stats.total}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={buildPageUrl(page - 1)}
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10"
                  >
                    ← Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={buildPageUrl(page + 1)}
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10"
                  >
                    Next →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
