import type { TaboolaCampaignRow } from "../queries";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: Date | null): string {
  if (!d) return "Never";
  return new Intl.DateTimeFormat("en-GB", {
    day:    "2-digit",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:         "bg-emerald-500/20 text-emerald-400",
  PENDING_REVIEW: "bg-blue-500/20 text-blue-400",
  REJECTED:       "bg-red-500/20 text-red-400",
  PAUSED:         "bg-amber-500/20 text-amber-400",
  STOPPED:        "bg-red-500/20 text-red-400",
  ARCHIVED:       "bg-slate-500/20 text-slate-400",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE:         "Active",
  PENDING_REVIEW: "Pending Review",
  REJECTED:       "Rejected",
  PAUSED:         "Paused",
  STOPPED:        "Stopped",
  ARCHIVED:       "Archived",
};

// ─── Component ──────────────────────────────────────────────────────────────

interface CampaignsTableProps {
  campaigns: TaboolaCampaignRow[];
}

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02] py-12">
        <p className="text-sm font-medium text-slate-300">
          No campaigns synced yet
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Connect a Taboola account and run a sync to pull campaigns
        </p>
      </div>
    );
  }

  return (
    <div className="dark-table-wrap">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-left text-xs font-medium uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Account</th>
            <th className="px-4 py-3 text-center">Status</th>
            <th className="px-4 py-3 text-right">Daily Budget</th>
            <th className="px-4 py-3 text-right">Total Spend</th>
            <th className="px-4 py-3 text-right">Last Synced</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {campaigns.map((c) => (
            <tr
              key={c.id}
              className="transition-colors hover:bg-white/[0.03]"
            >
              <td className="px-4 py-3 text-sm text-slate-200">
                {c.name}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                {c.adAccountName ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-center">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    STATUS_STYLES[c.status] ?? "bg-slate-500/20 text-slate-400"
                  }`}
                >
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-300">
                {c.dailyBudget !== null ? formatCurrency(c.dailyBudget, c.currency) : "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-200">
                {formatCurrency(c.totalSpend, c.currency)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-400">
                {formatDate(c.lastSyncedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
