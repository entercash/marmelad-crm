"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";

type KeitaroCampaign = {
  id: string;
  externalId: number;
  alias: string;
  name: string;
  state: string;
};

type Props = {
  campaigns: KeitaroCampaign[];
  trackerDomain: string;
};

const SUB_MAPPING = [
  { sub: "camp",         macro: "{campaign_id}", desc: "Campaign ID" },
  { sub: "cont",         macro: "{campaign_item_id}", desc: "Creative / Ad Item ID" },
  { sub: "utm_source",   macro: "{site}", desc: "Publisher site name" },
  { sub: "src_id",       macro: "{site_id}", desc: "Publisher site ID" },
  { sub: "utm_medium",   macro: "{platform}", desc: "Device (Desktop/Mobile/Tablet)" },
  { sub: "geo",          macro: "{country}", desc: "Country code (ISO)" },
  { sub: "click_id",     macro: "{click_id}", desc: "Unique click ID (for S2S postback)" },
  { sub: "network_id",   macro: "{account_id}", desc: "Account ID" },
  { sub: "headline",     macro: "{title}", desc: "Ad title text" },
  { sub: "utm_term",     macro: "{campaign_name}", desc: "Campaign name" },
] as const;

const PARAMS_STRING = SUB_MAPPING.map((m) => `${m.sub}=${m.macro}`).join("&");

const S2S_POSTBACK = "http://trc.taboola.com/actions-handler/log/3/s2s-action?click-id={click_id}&name=lead&revenue={payout}";

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          {label ?? "Copy"}
        </>
      )}
    </button>
  );
}

export function UtmBuilderForm({ campaigns, trackerDomain }: Props) {
  const [campaignAlias, setCampaignAlias] = useState("");
  const [protocol, setProtocol] = useState("https");
  const [inputMode, setInputMode] = useState<"select" | "manual">("select");

  const baseUrl = trackerDomain && campaignAlias
    ? `${protocol}://${trackerDomain}/${campaignAlias}`
    : "";

  const fullUrl = baseUrl ? `${baseUrl}?${PARAMS_STRING}` : "";

  function handleCampaignSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    setCampaignAlias(e.target.value);
  }

  return (
    <div className="space-y-6">
      {/* ── Configuration ──────────────────────────────────────────── */}
      <div className="glass p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-400">Configuration</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Protocol */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Protocol</label>
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
              className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="https">HTTPS</option>
              <option value="http">HTTP</option>
            </select>
          </div>

          {/* Campaign */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-400">Keitaro Campaign</label>
              <button
                type="button"
                onClick={() => {
                  setInputMode(inputMode === "select" ? "manual" : "select");
                  setCampaignAlias("");
                }}
                className="text-[10px] text-blue-400 hover:text-blue-300"
              >
                {inputMode === "select" ? "Manual ID" : "Select campaign"}
              </button>
            </div>
            {inputMode === "select" ? (
              <select
                value={campaignAlias}
                onChange={handleCampaignSelect}
                className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select campaign...</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.alias}>
                    {c.name} ({c.alias}) {c.state !== "active" ? `[${c.state}]` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={campaignAlias}
                onChange={(e) => setCampaignAlias(e.target.value.trim())}
                placeholder="Campaign alias or ID"
                className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-slate-500 focus:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            )}
          </div>
        </div>

        {trackerDomain && (
          <p className="mt-3 text-[11px] text-slate-500">
            Tracker domain: <code className="text-slate-400">{trackerDomain}</code>
          </p>
        )}
        {!trackerDomain && (
          <p className="mt-3 text-[11px] text-amber-400">
            Keitaro not configured. Set API URL in Settings → Keitaro.
          </p>
        )}
      </div>

      {/* ── Generated URLs ─────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Base URL */}
        <div className="glass p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-400">
              <ExternalLink className="mr-1.5 inline h-3.5 w-3.5" />
              Campaign URL
            </h3>
            {baseUrl && <CopyButton text={baseUrl} />}
          </div>
          {baseUrl ? (
            <div className="overflow-x-auto rounded-md bg-black/30 p-3">
              <code className="whitespace-pre-wrap break-all text-xs text-emerald-400">
                {baseUrl}
              </code>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Select a campaign to generate the URL
            </p>
          )}
        </div>

        {/* Parameters (always visible, static) */}
        <div className="glass p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-400">
              <ExternalLink className="mr-1.5 inline h-3.5 w-3.5" />
              Parameters
            </h3>
            <div className="flex gap-2">
              <CopyButton text={PARAMS_STRING} label="Copy params" />
              {fullUrl && <CopyButton text={fullUrl} label="Copy full URL" />}
            </div>
          </div>
          <div className="overflow-x-auto rounded-md bg-black/30 p-3">
            <code className="whitespace-pre-wrap break-all text-xs text-sky-400">
              {PARAMS_STRING}
            </code>
          </div>
        </div>

        {/* S2S Postback */}
        <div className="glass p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-400">
              <ExternalLink className="mr-1.5 inline h-3.5 w-3.5" />
              S2S Postback (Keitaro → Taboola)
            </h3>
            <CopyButton text={S2S_POSTBACK} />
          </div>
          <div className="overflow-x-auto rounded-md bg-black/30 p-3">
            <code className="whitespace-pre-wrap break-all text-xs text-amber-400">
              {S2S_POSTBACK}
            </code>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Add this as a postback URL in Keitaro. <code className="text-slate-400">{"{click_id}"}</code> = Taboola click ID, <code className="text-slate-400">{"{payout}"}</code> = conversion payout.
          </p>
        </div>
      </div>

      {/* ── Sub Parameter Mapping ──────────────────────────────────── */}
      <div className="glass p-5">
        <h3 className="mb-4 text-sm font-semibold text-slate-400">Parameter Mapping Reference</h3>
        <div className="overflow-hidden rounded-lg border border-white/[0.06]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-400">Parameter</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-400">Taboola Macro</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-slate-400">Description</th>
              </tr>
            </thead>
            <tbody>
              {SUB_MAPPING.map((m, idx) => (
                <tr
                  key={m.sub}
                  className={idx < SUB_MAPPING.length - 1 ? "border-b border-white/[0.04]" : ""}
                >
                  <td className="px-4 py-2 font-mono text-xs text-blue-400">{m.sub}</td>
                  <td className="px-4 py-2 font-mono text-xs text-emerald-400">{m.macro}</td>
                  <td className="px-4 py-2 text-xs text-slate-300">{m.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
