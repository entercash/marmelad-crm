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
      {/* Name search */}
      <input
        key={defaultSearch ?? ""}
        type="text"
        name="search"
        defaultValue={defaultSearch ?? ""}
        placeholder="Search campaigns…"
        className="h-9 w-56 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
      />

      {/* Status filter */}
      <select
        name="status"
        defaultValue={defaultStatus ?? ""}
        onChange={submitForm}
        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
      >
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Traffic source filter */}
      {trafficSources.length > 0 && (
        <select
          name="source"
          defaultValue={defaultSource ?? ""}
          onChange={submitForm}
          className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        >
          <option value="">All sources</option>
          {trafficSources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      {/* Submit */}
      <button
        type="submit"
        className="h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/50"
      >
        Search
      </button>

      {/* Clear */}
      {hasFilters && (
        <Link
          href="/campaigns"
          className="text-sm text-slate-400 hover:text-slate-700"
        >
          Clear
        </Link>
      )}
    </form>
  );
}
