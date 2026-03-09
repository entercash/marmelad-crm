"use client";

/**
 * AccountFilters — client-side search + status filter + card grid.
 *
 * All accounts are passed from the server and filtered in-memory so
 * there are no extra round-trips on keystroke/filter change.
 */

import { useState, useMemo } from "react";
import { Search } from "lucide-react";

import { Input }       from "@/components/ui/input";
import { AccountCard } from "./account-card";
import type { AccountRow, AgencyOption } from "@/features/ad-accounts/queries";
import {
  ACCOUNT_STATUSES,
  ACCOUNT_STATUS_LABELS,
} from "@/features/ad-accounts/schema";

// ─── Props ────────────────────────────────────────────────────────────────────

interface AccountFiltersProps {
  accounts: AccountRow[];
  agencies: AgencyOption[];
}

// ─── Shared select class (matches account-form) ─────────────────────────────

const selectClass =
  "h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm " +
  "transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0";

// ─── Component ────────────────────────────────────────────────────────────────

export function AccountFilters({ accounts, agencies }: AccountFiltersProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");

  const filtered = useMemo(() => {
    let result = accounts;

    // Status filter
    if (status !== "ALL") {
      result = result.filter((a) => a.status === status);
    }

    // Text search (name, agency, country)
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.agencyName && a.agencyName.toLowerCase().includes(q)) ||
          (a.accountCountry && a.accountCountry.toLowerCase().includes(q)) ||
          (a.trafficCountry && a.trafficCountry.toLowerCase().includes(q)) ||
          (a.currency && a.currency.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [accounts, search, status]);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Filter controls ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search accounts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status filter */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={selectClass}
        >
          <option value="ALL">All statuses</option>
          {ACCOUNT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ACCOUNT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        {/* Result count */}
        <span className="text-xs text-slate-400 whitespace-nowrap">
          {filtered.length} of {accounts.length}
        </span>
      </div>

      {/* ── Card grid ────────────────────────────────────────────────── */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              agencies={agencies}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-12">
          <p className="text-sm font-medium text-slate-500">
            No accounts match your filters
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Try adjusting the search or status filter
          </p>
        </div>
      )}
    </div>
  );
}
