export const dynamic = "force-dynamic";

import {
  Link2,
  Megaphone,
  Activity,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { PageHeader }      from "@/components/shared/page-header";
import { StatCard }        from "@/components/shared/stat-card";
import { SyncButton }      from "@/features/taboola-sync/components/sync-button";
import { AccountsTable }   from "@/features/taboola-sync/components/accounts-table";
import { CampaignsTable }  from "@/features/taboola-sync/components/campaigns-table";
import {
  isTaboolaConfigured,
  getTaboolaOverviewStats,
  getTaboolaAccounts,
  getTaboolaCampaigns,
  getTaboolaCampaignCounts,
} from "@/features/taboola-sync/queries";
import Link from "next/link";

export const metadata = { title: "Taboola Integration" };

const PAGE_SIZE = 10;

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateTime(d: Date | null): string {
  if (!d) return "Never";
  return new Intl.DateTimeFormat("en-GB", {
    day:    "2-digit",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

const STATUS_TABS = [
  { key: "ALL",            label: "All" },
  { key: "ACTIVE",         label: "Active" },
  { key: "PAUSED",         label: "Paused" },
  { key: "PENDING_REVIEW", label: "Pending" },
  { key: "REJECTED",       label: "Rejected" },
  { key: "STOPPED",        label: "Stopped" },
  { key: "ARCHIVED",       label: "Archived" },
];

function buildHref(status: string, page?: number): string {
  const params = new URLSearchParams();
  if (status !== "ALL") params.set("status", status);
  if (page && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/integrations/taboola${qs ? `?${qs}` : ""}`;
}

// ─── Page ───────────────────────────────────────────────────────────────────

type SearchParams = { status?: string; page?: string };

export default async function TaboolaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const configured = await isTaboolaConfigured();
  const currentStatus = searchParams.status ?? "ALL";
  const currentPage = Math.max(1, Number(searchParams.page) || 1);

  let stats = { connectedAccounts: 0, totalCampaigns: 0, activeCampaigns: 0, lastSyncAt: null as Date | null };
  let accounts: Awaited<ReturnType<typeof getTaboolaAccounts>> = [];
  let campaigns: Awaited<ReturnType<typeof getTaboolaCampaigns>> = { rows: [], total: 0 };
  let statusCounts: Awaited<ReturnType<typeof getTaboolaCampaignCounts>> = { ALL: 0 };

  if (configured) {
    try {
      [stats, accounts, campaigns, statusCounts] = await Promise.all([
        getTaboolaOverviewStats(),
        getTaboolaAccounts(),
        getTaboolaCampaigns(currentStatus, currentPage, PAGE_SIZE),
        getTaboolaCampaignCounts(),
      ]);
    } catch (err) {
      console.error("[TaboolaPage] Failed to fetch data:", err);
    }
  }

  const totalPages = Math.ceil(campaigns.total / PAGE_SIZE);

  // Only show tabs that have campaigns (plus ALL)
  const visibleTabs = STATUS_TABS.filter(
    (t) => t.key === "ALL" || (statusCounts[t.key] ?? 0) > 0,
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Taboola Integration"
        description="Connected accounts, campaigns, and spend overview"
      />

      {/* Not configured banner */}
      {!configured && (
        <div className="rounded-lg border border-dashed border-amber-500/20 bg-amber-500/5 px-5 py-4">
          <p className="text-sm font-medium text-amber-300">
            Taboola is not configured
          </p>
          <p className="mt-1 text-xs text-amber-400/70">
            Go to Settings → Taboola to connect your accounts with API credentials before syncing campaigns.
          </p>
        </div>
      )}

      {/* Stat cards */}
      {configured && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Connected Accounts"
            value={stats.connectedAccounts}
            icon={Link2}
            iconClassName="text-blue-400"
          />
          <StatCard
            label="Total Campaigns"
            value={stats.totalCampaigns}
            icon={Megaphone}
            iconClassName="text-slate-400"
          />
          <StatCard
            label="Active"
            value={stats.activeCampaigns}
            icon={Activity}
            iconClassName="text-emerald-400"
          />
          <StatCard
            label="Last Sync"
            value={formatDateTime(stats.lastSyncAt)}
            icon={Clock}
            iconClassName="text-amber-400"
            valueClassName="text-base font-semibold"
          />
        </div>
      )}

      {/* Sync button */}
      {configured && (
        <section>
          <SyncButton />
        </section>
      )}

      {/* Accounts table */}
      {configured && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-slate-300">Accounts</h2>
          <AccountsTable accounts={accounts} />
        </section>
      )}

      {/* Campaigns table with status tabs */}
      {configured && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-slate-300">Campaigns</h2>

          {/* Status tabs */}
          {statusCounts.ALL > 0 && (
            <div className="mb-3 flex gap-1 overflow-x-auto">
              {visibleTabs.map((tab) => {
                const count = statusCounts[tab.key] ?? 0;
                const isActive = currentStatus === tab.key;
                return (
                  <Link
                    key={tab.key}
                    href={buildHref(tab.key)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                        isActive
                          ? "bg-white/10 text-white"
                          : "bg-white/[0.04] text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          <CampaignsTable campaigns={campaigns.rows} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, campaigns.total)} of {campaigns.total}
              </span>
              <div className="flex gap-1">
                {currentPage > 1 ? (
                  <Link
                    href={buildHref(currentStatus, currentPage - 1)}
                    className="inline-flex items-center rounded-md px-2 py-1.5 text-xs text-slate-400 hover:bg-white/[0.05] hover:text-white transition-colors"
                  >
                    <ChevronLeft className="mr-0.5 h-3.5 w-3.5" />
                    Prev
                  </Link>
                ) : (
                  <span className="inline-flex items-center rounded-md px-2 py-1.5 text-xs text-slate-600 cursor-not-allowed">
                    <ChevronLeft className="mr-0.5 h-3.5 w-3.5" />
                    Prev
                  </span>
                )}

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={buildHref(currentStatus, p)}
                    className={`inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-medium tabular-nums transition-colors ${
                      p === currentPage
                        ? "bg-white/10 text-white"
                        : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                    }`}
                  >
                    {p}
                  </Link>
                ))}

                {currentPage < totalPages ? (
                  <Link
                    href={buildHref(currentStatus, currentPage + 1)}
                    className="inline-flex items-center rounded-md px-2 py-1.5 text-xs text-slate-400 hover:bg-white/[0.05] hover:text-white transition-colors"
                  >
                    Next
                    <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center rounded-md px-2 py-1.5 text-xs text-slate-600 cursor-not-allowed">
                    Next
                    <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
