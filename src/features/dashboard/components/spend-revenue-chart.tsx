"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { DashboardTimePoint } from "../queries";

// TODO: Hourly granularity
// - Taboola API only provides daily data (no hourly endpoint)
// - Keitaro buildReport() may support grouping by "hour"
// - When single-day is selected, we could fetch hourly from Keitaro live API
// - For now, single-day shows a single data point on the chart

type Props = {
  data: DashboardTimePoint[];
};

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function formatUsd(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function formatUsdFull(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/[0.06] bg-[hsl(217,33%,13%)] px-3 py-2 shadow-lg">
      <p className="mb-1.5 text-xs font-medium text-slate-400">{formatDate(label)}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} className="text-xs font-semibold" style={{ color: entry.color }}>
          {entry.name}: {formatUsdFull(entry.value)}
        </p>
      ))}
      {payload.length === 2 && (
        <p className="mt-1.5 border-t border-white/[0.06] pt-1.5 text-xs font-semibold text-slate-300">
          Profit: {formatUsdFull(payload[1].value - payload[0].value)}
        </p>
      )}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function SpendRevenueChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-slate-500">
        No data for the selected period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="gradSpend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f87171" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 25%, 18%)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke="#64748b"
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatUsd}
          stroke="#64748b"
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={55}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
        />
        <Area
          type="monotone"
          dataKey="spend"
          name="Spend"
          stroke="#f87171"
          strokeWidth={2}
          fill="url(#gradSpend)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: "#f87171" }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="#34d399"
          strokeWidth={2}
          fill="url(#gradRevenue)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0, fill: "#34d399" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
