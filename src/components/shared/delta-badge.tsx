import { TrendingUp, TrendingDown } from "lucide-react";

type DeltaBadgeProps = {
  /** Percentage change vs previous period. null = no data. */
  value: number | null;
  /**
   * Invert polarity: when true, a *decrease* is good (green) — use for Spend, CPA.
   * When false (default), an *increase* is good — use for Revenue, Profit, ROI, Conversions.
   */
  invertPolarity?: boolean;
};

export function DeltaBadge({ value, invertPolarity = false }: DeltaBadgeProps) {
  if (value === null || !isFinite(value)) {
    return <span className="text-xs text-slate-500">—</span>;
  }

  const isPositive = invertPolarity ? value < 0 : value > 0;
  const isNeutral = value === 0;

  if (isNeutral) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-400/10 px-2 py-0.5 text-xs font-medium text-slate-400">
        0%
      </span>
    );
  }

  const Icon = value > 0 ? TrendingUp : TrendingDown;
  const color = isPositive ? "text-emerald-400" : "text-red-400";
  const bgColor = isPositive ? "bg-emerald-400/10" : "bg-red-400/10";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color} ${bgColor}`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}
