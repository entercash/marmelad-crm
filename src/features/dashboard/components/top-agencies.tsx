import { Building2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { AgencySpendRow } from "../queries";

type Props = {
  agencies: AgencySpendRow[];
};

const RANK_COLORS = [
  "from-yellow-500 to-amber-400",  // #1 gold
  "from-slate-300 to-slate-400",   // #2 silver
  "from-amber-600 to-amber-500",   // #3 bronze
  "from-blue-500 to-blue-400",     // #4
  "from-blue-500 to-blue-400",     // #5
];

const BAR_COLORS = [
  "from-yellow-500/80 to-amber-400/60",
  "from-slate-400/60 to-slate-300/40",
  "from-amber-600/60 to-amber-500/40",
  "from-blue-500/60 to-blue-400/40",
  "from-blue-500/50 to-blue-400/30",
];

export function TopAgencies({ agencies }: Props) {
  if (agencies.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">
        <div className="text-center">
          <Building2 className="mx-auto mb-2 h-8 w-8 text-slate-600" />
          <p>No agency spend data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {agencies.map((agency, idx) => (
        <div key={agency.agencyName} className="group">
          <div className="mb-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white ${RANK_COLORS[idx] ?? RANK_COLORS[4]}`}
              >
                {idx + 1}
              </span>
              <span className="text-sm font-medium text-slate-200 transition-colors group-hover:text-white">
                {agency.agencyName}
              </span>
            </div>
            <span className="text-sm font-semibold tabular-nums text-slate-300">
              {formatCurrency(agency.totalSpend)}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${BAR_COLORS[idx] ?? BAR_COLORS[4]}`}
              style={{ width: `${Math.max(agency.percentOfMax, 2)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
