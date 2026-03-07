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
        className="h-9 w-72 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
      />

      <button
        type="submit"
        className="h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/50"
      >
        Search
      </button>

      {defaultSearch && (
        <Link
          href="/publishers"
          className="text-sm text-slate-400 hover:text-slate-700"
        >
          Clear
        </Link>
      )}
    </form>
  );
}
