import type { KeitaroCampaignRow } from "../queries";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day:    "2-digit",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

const STATE_STYLES: Record<string, string> = {
  active:   "bg-emerald-500/20 text-emerald-400",
  disabled: "bg-amber-500/20 text-amber-400",
  deleted:  "bg-red-500/20 text-red-400",
};

// ─── Component ──────────────────────────────────────────────────────────────

interface CampaignsTableProps {
  campaigns: KeitaroCampaignRow[];
}

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02] py-12">
        <p className="text-sm font-medium text-slate-300">
          No campaigns synced yet
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Click &quot;Sync Campaigns&quot; to pull data from Keitaro
        </p>
      </div>
    );
  }

  return (
    <div className="dark-table-wrap">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-left text-xs font-medium uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Alias</th>
            <th className="px-4 py-3">Group</th>
            <th className="px-4 py-3 text-center">State</th>
            <th className="px-4 py-3 text-right">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {campaigns.map((c) => (
            <tr
              key={c.id}
              className="transition-colors hover:bg-white/[0.03]"
            >
              <td className="whitespace-nowrap px-4 py-3 text-xs font-mono text-slate-400">
                {c.externalId}
              </td>
              <td className="px-4 py-3 text-sm text-slate-200">
                {c.name}
              </td>
              <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                {c.alias}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                {c.groupId ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-center">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    STATE_STYLES[c.state] ?? "bg-slate-500/20 text-slate-400"
                  }`}
                >
                  {c.state}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-400">
                {formatDate(c.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
