"use client";

import Link from "next/link";

type PublisherSearchProps = {
  defaultSearch?: string;
};

export function PublisherSearch({ defaultSearch }: PublisherSearchProps) {
  return (
    <form method="GET" className="flex items-center gap-3">
      <input
        key={defaultSearch ?? ""}
        type="text"
        name="search"
        defaultValue={defaultSearch ?? ""}
        placeholder="Search publishers or domains…"
        className="h-9 w-72 rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50"
      />

      <button
        type="submit"
        className="h-9 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      >
        Search
      </button>

      {defaultSearch && (
        <Link
          href="/publishers"
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          Clear
        </Link>
      )}
    </form>
  );
}
