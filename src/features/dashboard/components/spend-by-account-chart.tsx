"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { AccountSpendRow } from "../queries";

type Props = {
  data: AccountSpendRow[];
};

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

function truncate(str: string, max = 18): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

// Blue gradient palette for bars
const BAR_COLORS = [
  "#3b82f6", "#60a5fa", "#93c5fd", "#2563eb", "#1d4ed8",
  "#818cf8", "#6366f1", "#a78bfa", "#4f46e5", "#7c3aed",
];

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as AccountSpendRow;
  return (
    <div className="rounded-lg border border-white/[0.06] bg-[hsl(217,33%,13%)] px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-white">{row.accountName}</p>
      {row.agencyName && (
        <p className="text-xs text-slate-400">{row.agencyName}</p>
      )}
      <p className="mt-1 text-xs font-semibold text-blue-400">
        {formatUsdFull(row.totalSpend)}
      </p>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function SpendByAccountChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">
        No account spend data
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    name: truncate(d.accountName),
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(280, data.length * 40)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(215, 25%, 18%)"
          horizontal={false}
        />
        <XAxis
          type="number"
          tickFormatter={formatUsd}
          stroke="#64748b"
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          stroke="#64748b"
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={120}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="totalSpend" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {chartData.map((_, idx) => (
            <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
