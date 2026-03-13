export const dynamic = "force-dynamic";

import Link from "next/link";
import { Globe2 } from "lucide-react";

import { PageHeader }  from "@/components/shared/page-header";
import { EmptyState }  from "@/components/shared/empty-state";
import { formatCurrency, formatPercent } from "@/lib/utils";

import { PublisherFilters } from "./publisher-filters";
import {
  getPublisherStats,
  getDistinctCountries,
  type PublisherStatsRow,
} from "@/features/publishers/queries";

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

type SearchParams = { country?: string; page?: string };

export default async function PublishersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const country = searchParams.country;
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const perPage = 50;

  let stats: { rows: PublisherStatsRow[]; total: number } = {
    rows: [],
    total: 0,
  };
  let countries: { code: string; name: string }[] = [];

  try {
    [stats, countries] = await Promise.all([
      getPublisherStats({ country, page, perPage }),
      getDistinctCountries(),
    ]);
  } catch (err) {
    console.error("[PublishersPage] Failed to fetch data:", err);
  }

  const totalPages = Math.ceil(stats.total / perPage);
  const hasData = stats.rows.length > 0;

  // Build URL helper for pagination links
  function buildPageUrl(p: number): string {
    const params = new URLSearchParams();
    if (country) params.set("country", country);
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

      <PublisherFilters countries={countries} />

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
                  <th className="px-4 py-3 text-right">Impressions</th>
                  <th className="px-4 py-3 text-right">Spend</th>
                  <th className="px-4 py-3 text-right">CPC</th>
                  <th className="px-4 py-3 text-right">CTR</th>
                  <th className="px-4 py-3 text-right">Leads</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Profit</th>
                  <th className="px-4 py-3 text-right">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {stats.rows.map((row) => (
                  <tr
                    key={row.siteExternalId}
                    className="transition-colors hover:bg-white/[0.03]"
                  >
                    <td className="max-w-[260px] truncate px-4 py-3 font-medium text-white">
                      {row.siteName}
                      {row.siteUrl && (
                        <p className="truncate text-[11px] font-normal text-slate-500">
                          {row.siteUrl}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-300">
                      {fmtNum(row.clicks)}
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
