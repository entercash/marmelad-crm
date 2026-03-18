"use client";

/**
 * DomainFilters — search input + status filter + card grid.
 */

import { useState } from "react";
import { Search } from "lucide-react";

import { DomainCard } from "./domain-card";
import type { DomainRow } from "@/features/domains/queries";
import {
  DOMAIN_STATUSES,
  DOMAIN_STATUS_LABELS,
  type DomainStatusValue,
} from "@/features/domains/schema";

interface DomainFiltersProps {
  domains: DomainRow[];
}

export function DomainFilters({ domains }: DomainFiltersProps) {
  const [query, setQuery]   = useState("");
  const [status, setStatus] = useState<DomainStatusValue | "ALL">("ALL");

  const filtered = domains.filter((d) => {
    // Status filter
    if (status !== "ALL" && d.status !== status) return false;

    // Search filter
    if (query) {
      const q = query.toLowerCase();
      const match =
        d.url.toLowerCase().includes(q) ||
        (d.name ?? "").toLowerCase().includes(q) ||
        (d.notes ?? "").toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search domains…"
            className="h-9 w-full rounded-lg border border-white/10 bg-slate-800 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          />
        </div>

        {/* Status filter */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as DomainStatusValue | "ALL")}
          className="h-9 rounded-lg border border-white/10 bg-slate-800 px-3 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
        >
          <option value="ALL">All Statuses</option>
          {DOMAIN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {DOMAIN_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-12 text-center text-sm text-slate-500">
          {domains.length === 0
            ? "No domains yet. Add your first domain to start monitoring."
            : "No domains match your filters."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <DomainCard key={d.id} domain={d} />
          ))}
        </div>
      )}
    </div>
  );
}
