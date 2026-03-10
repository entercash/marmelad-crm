export const dynamic = "force-dynamic";

import {
  Database,
  Calendar,
  FileUp,
  Hash,
} from "lucide-react";

import { PageHeader }         from "@/components/shared/page-header";
import { StatCard }           from "@/components/shared/stat-card";
import { CsvUploadZone }      from "@/features/csv-import/components/csv-upload-zone";
import { ImportHistoryTable } from "@/features/csv-import/components/import-history-table";
import { getImportHistory, getImportStats } from "@/features/csv-import/queries";

export const metadata = { title: "Taboola CSV Import" };

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day:   "2-digit",
    month: "short",
    year:  "numeric",
  }).format(new Date(d));
}

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

export default async function TaboolaCsvPage() {
  let stats   = { totalRows: 0, totalImports: 0, lastImportAt: null as Date | null, dateRangeMin: null as Date | null, dateRangeMax: null as Date | null };
  let history: Awaited<ReturnType<typeof getImportHistory>> = [];

  try {
    [stats, history] = await Promise.all([
      getImportStats(),
      getImportHistory(),
    ]);
  } catch (err) {
    console.error("[TaboolaCsvPage] Failed to fetch data:", err);
  }

  const dateRange =
    stats.dateRangeMin && stats.dateRangeMax
      ? `${formatDate(stats.dateRangeMin)} – ${formatDate(stats.dateRangeMax)}`
      : "No data";

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Taboola CSV Import"
        description="Upload Dartmatics CSV exports to import Taboola performance data"
      />

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Rows"
          value={stats.totalRows.toLocaleString()}
          icon={Database}
          iconClassName="text-blue-400"
        />
        <StatCard
          label="Total Imports"
          value={stats.totalImports}
          icon={Hash}
          iconClassName="text-slate-400"
        />
        <StatCard
          label="Date Range"
          value={dateRange}
          icon={Calendar}
          iconClassName="text-emerald-400"
        />
        <StatCard
          label="Last Import"
          value={formatDateTime(stats.lastImportAt)}
          icon={FileUp}
          iconClassName="text-amber-400"
        />
      </div>

      {/* ── Upload zone ────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-300">Upload CSV</h2>
        <CsvUploadZone />
      </section>

      {/* ── Import history ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-slate-300">Import History</h2>
        <ImportHistoryTable history={history} />
      </section>
    </div>
  );
}
