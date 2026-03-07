import { PageHeader } from "@/components/shared/page-header";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  MousePointerClick,
} from "lucide-react";

const stats = [
  {
    label: "Total Spend",
    value: "—",
    icon: DollarSign,
    description: "This month",
    color: "text-blue-500",
  },
  {
    label: "Total Revenue",
    value: "—",
    icon: TrendingUp,
    description: "This month",
    color: "text-emerald-500",
  },
  {
    label: "ROI",
    value: "—",
    icon: BarChart3,
    description: "This month",
    color: "text-violet-500",
  },
  {
    label: "Clicks",
    value: "—",
    icon: MousePointerClick,
    description: "This month",
    color: "text-amber-500",
  },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your media buying performance"
      />

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                {stat.label}
              </span>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-slate-900">
                {stat.value}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{stat.description}</p>
          </div>
        ))}
      </div>

      {/* Empty state */}
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
        <BarChart3 className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">No data yet</p>
        <p className="mt-1 text-xs text-slate-400">
          Connect your data sources in Settings to start seeing analytics.
        </p>
      </div>
    </div>
  );
}
