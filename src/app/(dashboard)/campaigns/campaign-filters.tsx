"use client";

import { useRef } from "react";
import Link from "next/link";
import type { TrafficSourceOption } from "@/features/campaigns/queries";

type CampaignFiltersProps = {
  trafficSources:   TrafficSourceOption[];
  defaultSearch?:   string;
  defaultStatus?:   string;
  defaultSource?:   string;
};

const STATUS_OPTIONS = [
  { value: "ACTIVE",   label: "Active"   },
  { value: "PAUSED",   label: "Paused"   },
  { value: "STOPPED",  label: "Stopped"  },
  { value: "ARCHIVED", label: "Archived" },
];

const inputClass =
  "h-9 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50";

export function CampaignFilters({
  trafficSources,
  defaultSearch,
  defaultStatus,
  defaultSource,
}: CampaignFiltersProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const hasFilters = !!(defaultSearch || defaultStatus || defaultSource);

  function submitForm() {
    formRef.current?.submit();
  }

  return (
    <form
      ref={formRef}
      method="GET"
      className="flex flex-wrap items-center gap-3"
    >
      <input
        key={defaultSearch ?? ""}
        type="text"
        name="search"
        defaultValue={defaultSearch ?? ""}
        placeholder="Search campaigns…"
        className={`w-56 ${inputClass}`}
      />

      <select
        name="status"
        defaultValue={defaultStatus ?? ""}
        onChange={submitForm}
        className={inputClass}
      >
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {trafficSources.length > 0 && (
        <select
          name="source"
          defaultValue={defaultSource ?? ""}
          onChange={submitForm}
          className={inputClass}
        >
          <option value="">All sources</option>
          {trafficSources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      <button
        type="submit"
        className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      >
        Search
      </button>

      {hasFilters && (
        <Link
          href="/campaigns"
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          Clear
        </Link>
      )}
    </form>
  );
}
