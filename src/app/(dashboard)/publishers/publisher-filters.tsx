"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";

type Props = {
  countries: { code: string; name: string }[];
  campaigns: { externalId: string; name: string }[];
};

export function PublisherFilters({ countries, campaigns }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentCountry = searchParams.get("country") ?? "";
  const currentCampaign = searchParams.get("campaign") ?? "";
  const currentSite = searchParams.get("site") ?? "";
  const linkedOnly = searchParams.get("linked") === "1";

  const [siteInput, setSiteInput] = useState(currentSite);

  const navigate = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      const qs = params.toString();
      router.push(`/publishers${qs ? `?${qs}` : ""}`);
    },
    [router, searchParams],
  );

  function handleSiteSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate({ site: siteInput.trim() || null });
  }

  const hasFilters = currentCountry || currentCampaign || currentSite || linkedOnly;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Site search */}
      <form onSubmit={handleSiteSubmit} className="flex items-center gap-1.5">
        <input
          type="text"
          value={siteInput}
          onChange={(e) => setSiteInput(e.target.value)}
          placeholder="Search site ID or name…"
          className="h-9 w-48 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
        />
        {siteInput !== currentSite && (
          <button
            type="submit"
            className="h-9 rounded-md border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-300 hover:bg-white/10"
          >
            Go
          </button>
        )}
      </form>

      {/* Campaign filter */}
      <select
        value={currentCampaign}
        onChange={(e) => navigate({ campaign: e.target.value || null })}
        className="h-9 max-w-[240px] truncate rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
      >
        <option value="">All Campaigns</option>
        {campaigns.map((c) => (
          <option key={c.externalId} value={c.externalId}>
            {c.name}
          </option>
        ))}
      </select>

      {/* Country filter */}
      <select
        value={currentCountry}
        onChange={(e) => navigate({ country: e.target.value || null })}
        className="h-9 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
      >
        <option value="">All Countries</option>
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name} ({c.code})
          </option>
        ))}
      </select>

      {/* Linked only toggle */}
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
        <input
          type="checkbox"
          checked={linkedOnly}
          onChange={(e) => navigate({ linked: e.target.checked ? "1" : null })}
          className="h-4 w-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/20"
        />
        Linked only
      </label>

      {/* Clear all */}
      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setSiteInput("");
            navigate({ country: null, campaign: null, site: null, linked: null });
          }}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
