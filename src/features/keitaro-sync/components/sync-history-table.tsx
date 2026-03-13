import type { KeitaroSyncHistoryRow } from "../queries";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day:    "2-digit",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: "bg-emerald-500/20 text-emerald-400",
  PARTIAL: "bg-amber-500/20 text-amber-400",
  FAILED:  "bg-red-500/20 text-red-400",
  RUNNING: "bg-blue-500/20 text-blue-400",
  PENDING: "bg-slate-500/20 text-slate-400",
};

// ─── Component ──────────────────────────────────────────────────────────────

interface SyncHistoryTableProps {
  history: KeitaroSyncHistoryRow[];
}

export function SyncHistoryTable({ history }: SyncHistoryTableProps) {
  if (history.length === 0) {
    return null;
  }

  return (
    <div className="dark-table-wrap">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-left text-xs font-medium uppercase tracking-wider text-slate-400">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3 text-right">Fetched</th>
            <th className="px-4 py-3 text-right">Created</th>
            <th className="px-4 py-3 text-right">Updated</th>
            <th className="px-4 py-3 text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {history.map((row) => (
            <tr
              key={row.id}
              className="transition-colors hover:bg-white/[0.03]"
            >
              <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-400">
                {formatDate(row.startedAt)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-300">
                {row.recordsFetched?.toLocaleString() ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-300">
                {row.recordsInserted?.toLocaleString() ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-300">
                {row.recordsUpdated?.toLocaleString() ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-center">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    STATUS_STYLES[row.status] ?? STATUS_STYLES.PENDING
                  }`}
                >
                  {row.status}
                </span>
                {row.errorMessage && (
                  <p
                    className="mt-0.5 max-w-[200px] truncate text-[11px] text-red-400/70"
                    title={row.errorMessage}
                  >
                    {row.errorMessage}
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
