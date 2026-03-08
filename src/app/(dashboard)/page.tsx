export const dynamic = "force-dynamic";

import {
  DollarSign,
  ArrowDownLeft,
  TrendingUp,
  Activity,
} from "lucide-react";

import { PageHeader }         from "@/components/shared/page-header";
import { StatCard }           from "@/components/shared/stat-card";
import { getDashboardSummary } from "@/features/dashboard/queries";

export const metadata = { title: "Dashboard" };

// Revalidate every 60 s so stat cards stay reasonably fresh without a full reload.
export const revalidate = 60;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUsd(value: number): string {
  const sign = value < 0 ? "−" : "";
  return (
    sign +
    new Intl.NumberFormat("en-US", {
      style:                 "currency",
      currency:              "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(value))
  );
}

function formatRoi(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const { spent, received, roi, result } = await getDashboardSummary();

  const hasData = spent > 0 || received > 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Dashboard"
        description="Key business metrics at a glance"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Spent */}
        <StatCard
          label="Spent"
          value={formatUsd(spent)}
          icon={DollarSign}
          iconClassName="text-red-400"
          description={
            hasData
              ? "Ad spend + manual expenses"
              : "No spend recorded yet"
          }
        />

        {/* 2. Received */}
        <StatCard
          label="Received"
          value={formatUsd(received)}
          icon={ArrowDownLeft}
          iconClassName="text-emerald-400"
          description={
            hasData
              ? "Net conversion revenue"
              : "No revenue recorded yet"
          }
        />

        {/* 3. ROI */}
        <StatCard
          label="ROI"
          value={formatRoi(roi)}
          icon={TrendingUp}
          iconClassName="text-blue-400"
          description={
            roi !== null
              ? "Return on investment"
              : "Needs spend data to calculate"
          }
        />

        {/* 4. Final Result */}
        <StatCard
          label="Result"
          value={formatUsd(result)}
          icon={Activity}
          iconClassName={result >= 0 ? "text-emerald-400" : "text-red-400"}
          description={
            hasData
              ? "Received minus spent"
              : "No data yet"
          }
        />
      </div>
    </div>
  );
}
