/**
 * ImportHistoryTable — glass-styled table showing past CSV imports.
 *
 * Server component — receives data from the page.
 */

import type { ImportHistoryRow } from "@/features/csv-import/queries";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day:   "2-digit",
    month: "short",
    year:  "numeric",
    hour:  "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: "bg-emerald-500/20 text-emerald-400",
  PARTIAL: "bg-amber-500/20 text-amber-400",
  FAILED:  "bg-red-500/20 text-red-400",
  RUNNING: "bg-blue-500/20 text-blue-400",
  PENDING: "bg-slate-500/20 text-slate-400",
};

// ─── Component ──────────────────────────────────────────────────────────────

interface ImportHistoryTableProps {
  history: ImportHistoryRow[];
}

export function ImportHistoryTable({ history }: ImportHistoryTableProps) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02] py-12">
        <p className="text-sm font-medium text-slate-300">
          No imports yet
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Upload a Taboola CSV to get started
        </p>
      </div>
    );
  }

  return (
    <div className="glass overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] text-left text-xs font-medium uppercase tracking-wider text-slate-500">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">File</th>
            <th className="px-4 py-3 text-right">Rows</th>
            <th className="px-4 py-3 text-right">Upserted</th>
            <th className="px-4 py-3 text-right">Skipped</th>
            <th className="px-4 py-3 text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {history.map((row) => (
            <tr
              key={row.id}
              className="transition-colors hover:bg-white/[0.03]"
            >
              <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                {formatDate(row.startedAt)}
              </td>
              <td className="px-4 py-3">
                <div>
                  <p className="truncate text-white max-w-[200px]">
                    {row.fileName ?? "—"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatBytes(row.fileSize)}
                  </p>
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-slate-300">
                {row.totalRows?.toLocaleString() ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-slate-300">
                {row.recordsInserted?.toLocaleString() ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right text-slate-300">
                {(row.recordsSkipped ?? 0) + (row.recordsFailed ?? 0) > 0
                  ? ((row.recordsSkipped ?? 0) + (row.recordsFailed ?? 0)).toLocaleString()
                  : "0"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-center">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    STATUS_STYLES[row.status] ?? STATUS_STYLES.PENDING
                  }`}
                >
                  {row.status}
                </span>
                {row.errorMessage && (
                  <p className="mt-0.5 max-w-[200px] truncate text-xs text-red-400/70" title={row.errorMessage}>
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
