export const dynamic = "force-dynamic";

import {
  DollarSign,
  ArrowDownLeft,
  TrendingUp,
  Activity,
  Target,
  Crosshair,
} from "lucide-react";

import { PageHeader }      from "@/components/shared/page-header";
import { StatCard }        from "@/components/shared/stat-card";
import { DeltaBadge }      from "@/components/shared/delta-badge";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { parseDateFilter, computePreviousPeriod } from "@/lib/date";
import { formatCurrency, formatCompact } from "@/lib/utils";

import {
  getDashboardSummary,
  getDashboardTimeSeries,
  getTopAgenciesBySpend,
  getSpendByAccount,
  getDashboardAlerts,
} from "@/features/dashboard/queries";

import { SpendRevenueChart }    from "@/features/dashboard/components/spend-revenue-chart";
import { SpendByAccountChart }  from "@/features/dashboard/components/spend-by-account-chart";
import { TopAgencies }          from "@/features/dashboard/components/top-agencies";
import { AlertsPanel }          from "@/features/dashboard/components/alerts-panel";

export const metadata = { title: "Dashboard" };
export const revalidate = 60;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRoi(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatUsd(value: number): string {
  const sign = value < 0 ? "−" : "";
  return sign + formatCurrency(Math.abs(value));
}

function delta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// ─── Page ────────────────────────────────────────────────────────────────────

type SearchParams = { period?: string; from?: string; to?: string };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const dateRange = parseDateFilter(searchParams);
  const from = dateRange?.from;
  const to = dateRange?.to;
  const prevRange = computePreviousPeriod(from, to);

  // Parallel fetch all data
  const [current, previous, timeSeries, topAgencies, accountSpend, alerts] =
    await Promise.all([
      getDashboardSummary(from, to),
      prevRange
        ? getDashboardSummary(prevRange.from, prevRange.to)
        : Promise.resolve(null),
      getDashboardTimeSeries(from, to),
      getTopAgenciesBySpend(from, to),
      getSpendByAccount(from, to),
      getDashboardAlerts(),
    ]);

  // Compute deltas
  const d = {
    spent:       previous ? delta(current.spent, previous.spent) : null,
    received:    previous ? delta(current.received, previous.received) : null,
    result:      previous ? delta(current.result, previous.result) : null,
    roi:         previous && previous.roi !== null && current.roi !== null
                   ? current.roi - previous.roi
                   : null,
    conversions: previous ? delta(current.conversions, previous.conversions) : null,
    cpa:         previous && previous.cpa && current.cpa
                   ? delta(current.cpa, previous.cpa)
                   : null,
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Dashboard"
        description="Key business metrics at a glance"
      />

      <DateRangeFilter basePath="/" />

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Spend"
          value={formatUsd(current.spent)}
          icon={DollarSign}
          iconClassName="text-red-400"
          valueClassName="text-xl font-bold"
          sub={<DeltaBadge value={d.spent} invertPolarity />}
        />
        <StatCard
          label="Revenue"
          value={formatUsd(current.received)}
          icon={ArrowDownLeft}
          iconClassName="text-emerald-400"
          valueClassName="text-xl font-bold"
          sub={<DeltaBadge value={d.received} />}
        />
        <StatCard
          label="Profit"
          value={formatUsd(current.result)}
          icon={Activity}
          iconClassName={current.result >= 0 ? "text-emerald-400" : "text-red-400"}
          valueClassName="text-xl font-bold"
          sub={<DeltaBadge value={d.result} />}
        />
        <StatCard
          label="ROI"
          value={formatRoi(current.roi)}
          icon={TrendingUp}
          iconClassName="text-blue-400"
          valueClassName="text-xl font-bold"
          sub={
            d.roi !== null ? (
              <DeltaBadge value={d.roi} />
            ) : undefined
          }
        />
        <StatCard
          label="Conversions"
          value={formatCompact(current.conversions)}
          icon={Target}
          iconClassName="text-purple-400"
          valueClassName="text-xl font-bold"
          sub={<DeltaBadge value={d.conversions} />}
        />
        <StatCard
          label="CPA"
          value={current.cpa !== null ? formatCurrency(current.cpa) : "—"}
          icon={Crosshair}
          iconClassName="text-orange-400"
          valueClassName="text-xl font-bold"
          sub={<DeltaBadge value={d.cpa} invertPolarity />}
        />
      </div>

      {/* ── Spend vs Revenue Chart ─────────────────────────────────────── */}
      <div className="glass p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-400">
          Spend vs Revenue
        </h3>
        <SpendRevenueChart data={timeSeries} />
      </div>

      {/* ── Two-column: Agencies + Account Spend ──────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-400">
            Top Agencies by Spend
          </h3>
          <TopAgencies agencies={topAgencies} />
        </div>
        <div className="glass p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-400">
            Spend by Account
          </h3>
          <SpendByAccountChart data={accountSpend} />
        </div>
      </div>

      {/* ── Alerts ─────────────────────────────────────────────────────── */}
      <AlertsPanel alerts={alerts} />
    </div>
  );
}
