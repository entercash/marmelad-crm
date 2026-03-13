"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  countries: { code: string; name: string }[];
};

export function PublisherFilters({ countries }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentCountry = searchParams.get("country") ?? "";

  function handleCountryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams();
    if (e.target.value) {
      params.set("country", e.target.value);
    }
    // Reset to page 1 when changing filter
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

      {currentCountry && (
        <button
          type="button"
          onClick={() => router.push("/publishers")}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          Clear
        </button>
      )}
    </div>
  );
}
