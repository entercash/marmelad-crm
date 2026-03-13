"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  countries: { code: string; name: string }[];
};

export function PublisherFilters({ countries }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentCountry = searchParams.get("country") ?? "";
  const linkedOnly = searchParams.get("linked") === "1";

  function handleCountryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (e.target.value) {
      params.set("country", e.target.value);
    } else {
      params.delete("country");
    }
    const qs = params.toString();
    router.push(`/publishers${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={currentCountry}
        onChange={handleCountryChange}
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
          onChange={(e) => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("page");
            if (e.target.checked) {
              params.set("linked", "1");
            } else {
              params.delete("linked");
            }
            const qs = params.toString();
            router.push(`/publishers${qs ? `?${qs}` : ""}`);
          }}
          className="h-4 w-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/20"
        />
        Linked only
      </label>

      {currentCountry && (
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete("country");
            params.delete("page");
            const qs = params.toString();
            router.push(`/publishers${qs ? `?${qs}` : ""}`);
          }}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          Clear
        </button>
      )}
    </div>
  );
}
