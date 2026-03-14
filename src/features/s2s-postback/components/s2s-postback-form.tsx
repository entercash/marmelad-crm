"use client";

import { useState } from "react";
import { sendPostbacks, type PostbackResult } from "@/features/s2s-postback/actions";

export function S2sPostbackForm() {
  const [clickIdsText, setClickIdsText] = useState("");
  const [eventName, setEventName] = useState("lead");
  const [revenue, setRevenue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PostbackResult[] | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResults(null);

    const clickIds = Array.from(
      new Set(
        clickIdsText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
      ),
    );

    if (clickIds.length === 0) {
      setError("Enter at least one click ID");
      return;
    }

    setPending(true);
    const res = await sendPostbacks(clickIds, eventName, revenue || undefined);
    setPending(false);

    if (res.success) {
      setResults(res.results);
    } else {
      setError(res.error);
    }
  }

  const successCount = results?.filter((r) => r.status === "ok").length ?? 0;
  const totalCount = results?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Event name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-300">
              Event Name
            </label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="lead"
              className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Revenue (optional) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-300">
              Revenue <span className="text-slate-500">(optional)</span>
            </label>
            <input
              type="text"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
              placeholder="0.00"
              className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Click IDs textarea */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-300">
            Click IDs <span className="text-slate-500">(one per line)</span>
          </label>
          <textarea
            value={clickIdsText}
            onChange={(e) => setClickIdsText(e.target.value)}
            rows={8}
            placeholder={"CjA1NjQ4MjE3...\nCjA1NjQ4MjE4...\nCjA1NjQ4MjE5..."}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
          <p className="text-xs text-slate-500">
            {clickIdsText.split("\n").filter((l) => l.trim()).length} click IDs
            {" · "}duplicates will be removed
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {pending ? "Sending..." : "Send Postbacks"}
        </button>
      </form>

      {/* Results log */}
      {results && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-slate-300">Results</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                successCount === totalCount
                  ? "bg-emerald-500/10 text-emerald-400"
                  : successCount > 0
                    ? "bg-yellow-500/10 text-yellow-400"
                    : "bg-red-500/10 text-red-400"
              }`}
            >
              {successCount}/{totalCount} successful
            </span>
          </div>

          <div className="overflow-hidden rounded-md border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-3 py-2 text-left font-medium text-slate-400">
                    #
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-400">
                    Click ID
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-400">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-slate-400">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/5 last:border-0"
                  >
                    <td className="px-3 py-1.5 text-slate-500">{i + 1}</td>
                    <td className="px-3 py-1.5 font-mono text-xs text-slate-300">
                      {r.clickId.length > 40
                        ? `${r.clickId.slice(0, 20)}...${r.clickId.slice(-16)}`
                        : r.clickId}
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                          r.status === "ok"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {r.status === "ok" ? "OK" : "Error"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-xs text-slate-500">
                      {r.httpCode ? `HTTP ${r.httpCode}` : r.error ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
