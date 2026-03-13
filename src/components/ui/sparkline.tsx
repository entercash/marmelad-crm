"use client";

/**
 * Sparkline — lightweight inline chart for table cells.
 *
 * Pure SVG, no library dependencies. Renders a polyline with an end-dot
 * and an optional label below. Color-coded by trend direction.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

type SparklineColor = "green" | "yellow" | "red";

interface SparklineProps {
  /** Y-axis values (one per day). At least 2 points needed. */
  data: number[];
  /** Line + dot color */
  color: SparklineColor;
  /** Label shown below the sparkline (e.g. "+34%", "8%") */
  label?: string;
  /** SVG width in px (default 80) */
  width?: number;
  /** SVG height in px (default 24) */
  height?: number;
}

// ─── Color map ──────────────────────────────────────────────────────────────

const COLORS: Record<SparklineColor, string> = {
  green:  "#4ade80",
  yellow: "#facc15",
  red:    "#f87171",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Determine sparkline color for ROI trend (higher = better). */
export function roiTrendColor(data: number[]): SparklineColor {
  if (data.length < 2) return "yellow";
  const first = data[0];
  const last = data[data.length - 1];
  if (last > first + 5) return "green";     // improving
  if (last < first - 20) return "red";       // degrading significantly
  return "yellow";                            // flat / minor change
}

/** Determine sparkline color for Bot% trend (lower = better). */
export function botTrendColor(lastValue: number): SparklineColor {
  if (lastValue <= 20) return "green";
  if (lastValue <= 50) return "yellow";
  return "red";
}

// ─── Component ──────────────────────────────────────────────────────────────

export function Sparkline({
  data,
  color,
  label,
  width = 80,
  height = 24,
}: SparklineProps) {
  if (data.length < 2) return null;

  const pad = 3; // padding for dot radius
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // avoid division by zero

  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * plotW;
      const y = pad + plotH - ((v - min) / range) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  // Last point for the dot
  const lastX = pad + plotW;
  const lastY = pad + plotH - ((data[data.length - 1] - min) / range) * plotH;

  const stroke = COLORS[color];

  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        <circle cx={lastX} cy={lastY} r={2} fill={stroke} />
      </svg>
      {label && (
        <span
          className="text-[10px] font-semibold leading-none"
          style={{ color: stroke }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
