export const dynamic = "force-dynamic";

import {
  Link2,
  Megaphone,
  Activity,
  Clock,
} from "lucide-react";

import { PageHeader }      from "@/components/shared/page-header";
import { StatCard }        from "@/components/shared/stat-card";
import { AccountsTable }   from "@/features/taboola-sync/components/accounts-table";
import { CampaignsTable }  from "@/features/taboola-sync/components/campaigns-table";
import {
  isTaboolaConfigured,
  getTaboolaOverviewStats,
  getTaboolaAccounts,
  getTaboolaCampaigns,
} from "@/features/taboola-sync/queries";

export const metadata = { title: "Taboola Integration" };

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

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function TaboolaPage() {
  const configured = await isTaboolaConfigured();

  let stats = { connectedAccounts: 0, totalCampaigns: 0, activeCampaigns: 0, lastSyncAt: null as Date | null };
  let accounts: Awaited<ReturnType<typeof getTaboolaAccounts>> = [];
  let campaigns: Awaited<ReturnType<typeof getTaboolaCampaigns>> = [];

  if (configured) {
    try {
      [stats, accounts, campaigns] = await Promise.all([
        getTaboolaOverviewStats(),
        getTaboolaAccounts(),
        getTaboolaCampaigns(),
      ]);
    } catch (err) {
      console.error("[TaboolaPage] Failed to fetch data:", err);
    }
  }

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

      {/* Accounts table */}
      {configured && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-slate-300">Accounts</h2>
          <AccountsTable accounts={accounts} />
        </section>
      )}

      {/* Campaigns table */}
      {configured && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-slate-300">Campaigns</h2>
          <CampaignsTable campaigns={campaigns} />
        </section>
      )}
    </div>
  );
}
