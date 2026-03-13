import { AlertTriangle, TrendingDown } from "lucide-react";
import type { DashboardAlert } from "../queries";

type Props = {
  alerts: DashboardAlert[];
};

const ICON_MAP = {
  low_balance: AlertTriangle,
  negative_roi: TrendingDown,
};

const SEVERITY_STYLES = {
  warning: {
    bg: "bg-amber-500/[0.06]",
    border: "border-amber-500/20",
    icon: "text-amber-400",
    title: "text-amber-300",
  },
  critical: {
    bg: "bg-red-500/[0.06]",
    border: "border-red-500/20",
    icon: "text-red-400",
    title: "text-red-300",
  },
};

export function AlertsPanel({ alerts }: Props) {
  if (alerts.length === 0) return null;

  const warnings = alerts.filter((a) => a.severity === "warning");
  const criticals = alerts.filter((a) => a.severity === "critical");
  const sorted = [...criticals, ...warnings];

  return (
    <div className="glass p-5">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-slate-400">
          Alerts
          <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-400">
            {alerts.length}
          </span>
        </h3>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((alert, idx) => {
          const Icon = ICON_MAP[alert.type];
          const styles = SEVERITY_STYLES[alert.severity];

          return (
            <div
              key={`${alert.type}-${idx}`}
              className={`flex items-start gap-3 rounded-lg border p-3 ${styles.bg} ${styles.border}`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${styles.icon}`} />
              <div className="min-w-0">
                <p className={`text-sm font-medium ${styles.title}`}>
                  {alert.title}
                </p>
                <p className="text-xs text-slate-400">{alert.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
