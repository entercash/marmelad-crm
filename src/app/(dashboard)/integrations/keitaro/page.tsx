export const dynamic = "force-dynamic";

import {
  Megaphone,
  Activity,
  Clock,
  Hash,
} from "lucide-react";

import { PageHeader }    from "@/components/shared/page-header";
import { StatCard }      from "@/components/shared/stat-card";
import { SyncButton }    from "@/features/keitaro-sync/components/sync-button";
import { CampaignsTable }    from "@/features/keitaro-sync/components/campaigns-table";
import { SyncHistoryTable }  from "@/features/keitaro-sync/components/sync-history-table";
import { isKeitaroConfigured } from "@/features/integration-settings/queries";
import {
  getKeitaroCampaigns,
  getKeitaroSyncStats,
  getKeitaroSyncHistory,
} from "@/features/keitaro-sync/queries";

export const metadata = { title: "Keitaro Integration" };

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

export default async function KeitaroPage() {
  const configured = await isKeitaroConfigured();

  let stats = { totalCampaigns: 0, activeCampaigns: 0, lastSyncAt: null as Date | null, totalSyncs: 0 };
  let campaigns: Awaited<ReturnType<typeof getKeitaroCampaigns>> = [];
  let history: Awaited<ReturnType<typeof getKeitaroSyncHistory>> = [];

  if (configured) {
    try {
      [stats, campaigns, history] = await Promise.all([
        getKeitaroSyncStats(),
        getKeitaroCampaigns(),
        getKeitaroSyncHistory(),
      ]);
    } catch (err) {
      console.error("[KeitaroPage] Failed to fetch data:", err);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Keitaro Integration"
        description="Sync campaigns from Keitaro tracker via Admin API"
      />

      {/* Not configured banner */}
      {!configured && (
        <div className="rounded-lg border border-dashed border-amber-500/20 bg-amber-500/5 px-5 py-4">
          <p className="text-sm font-medium text-amber-300">
            Keitaro is not configured
          </p>
          <p className="mt-1 text-xs text-amber-400/70">
            Go to Settings to add your Keitaro API URL and API Key before syncing campaigns.
          </p>
        </div>
      )}

      {/* Stat cards */}
      {configured && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Campaigns"
            value={stats.totalCampaigns}
            icon={Megaphone}
            iconClassName="text-blue-400"
          />
          <StatCard
            label="Active"
            value={stats.activeCampaigns}
            icon={Activity}
            iconClassName="text-emerald-400"
          />
          <StatCard
            label="Total Syncs"
            value={stats.totalSyncs}
            icon={Hash}
            iconClassName="text-slate-400"
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

      {/* Campaigns table */}
      {configured && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-slate-300">Campaigns</h2>
          <CampaignsTable campaigns={campaigns} />
        </section>
      )}

      {/* Sync history */}
      {configured && history.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-slate-300">Sync History</h2>
          <SyncHistoryTable history={history} />
        </section>
      )}
    </div>
  );
}
