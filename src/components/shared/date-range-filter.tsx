"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { DATE_PERIOD_LABELS, type DatePeriod, todayCrm } from "@/lib/date";

type Props = {
  basePath: string;
  preserveParams?: string[];
};

const PRESETS = Object.entries(DATE_PERIOD_LABELS) as [DatePeriod, string][];

export function DateRangeFilter({ basePath, preserveParams = [] }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentPeriod = searchParams.get("period") ?? "";
  const currentFrom = searchParams.get("from") ?? "";
  const currentTo = searchParams.get("to") ?? "";
  const isCustom = !currentPeriod && (!!currentFrom || !!currentTo);

  const [customFrom, setCustomFrom] = useState(currentFrom);
  const [customTo, setCustomTo] = useState(currentTo || todayCrm());
  const [showCustom, setShowCustom] = useState(isCustom);

  function buildUrl(dateParams: Record<string, string>) {
    const params = new URLSearchParams();
    for (const key of preserveParams) {
      const val = searchParams.get(key);
      if (val) params.set(key, val);
    }
    for (const [k, v] of Object.entries(dateParams)) {
      if (v) params.set(k, v);
    }
    params.delete("page");
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  }

  function handlePresetChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    if (value === "" || value === "all") {
      router.push(buildUrl({}));
    } else {
      router.push(buildUrl({ period: value }));
    }
  }

  function handleCustomApply() {
    if (!customFrom) return;
    router.push(buildUrl({ from: customFrom, to: customTo || todayCrm() }));
  }

  const selectValue = showCustom || isCustom ? "custom" : currentPeriod || "all";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={selectValue}
        onChange={handlePresetChange}
        className="h-9 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
      >
        {PRESETS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
        <option value="custom">Custom Range</option>
      </select>

      {(showCustom || isCustom) && (
        <>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-9 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <span className="text-sm text-slate-400">—</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-9 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            type="button"
            onClick={handleCustomApply}
            className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
          >
            Apply
          </button>
        </>
      )}
    </div>
  );
}
