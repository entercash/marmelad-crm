"use client";

/**
 * DomainCard — renders a single domain card (dark theme).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  RefreshCw,
  Clock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Globe2,
  Server,
  Loader2,
} from "lucide-react";

import { DomainDialog } from "./domain-dialog";
import { DeleteDomainButton } from "./delete-domain-button";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { checkDomainNow } from "@/features/domains/actions";
import type { DomainRow } from "@/features/domains/queries";
import {
  DOMAIN_STATUS_LABELS,
  DOMAIN_STATUS_COLORS,
  type DomainStatusValue,
} from "@/features/domains/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DomainCardProps {
  domain: DomainRow;
}

export function DomainCard({ domain }: DomainCardProps) {
  const [checking, setChecking] = useState(false);
  const router = useRouter();

  const statusLabel = DOMAIN_STATUS_LABELS[domain.status as DomainStatusValue] ?? domain.status;
  const statusStyle = DOMAIN_STATUS_COLORS[domain.status as DomainStatusValue] ?? DOMAIN_STATUS_COLORS.UNKNOWN;

  const sslDays = daysUntil(domain.sslExpiry);
  const domainDays = daysUntil(domain.domainExpiry);

  async function handleCheck() {
    setChecking(true);
    await checkDomainNow(domain.id);
    router.refresh();
    setChecking(false);
  }

  return (
    <div className="group flex flex-col rounded-2xl border border-white/[0.08] bg-[hsl(217,33%,13%)] shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(59,130,246,0.12)]">
      {/* ── Header: Status + Actions ──────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 pt-5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${statusStyle.dot}`}
          />
          {statusLabel}
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={handleCheck}
            disabled={checking}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-200 disabled:opacity-50"
            title="Check now"
            aria-label="Check now"
          >
            {checking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>
          <DomainDialog
            domain={domain}
            trigger={
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-200"
                title={`Edit ${domain.name || displayUrl(domain.url)}`}
                aria-label="Edit domain"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            }
          />
          <DeleteDomainButton
            id={domain.id}
            name={domain.name || displayUrl(domain.url)}
          />
        </div>
      </div>

      {/* ── URL + Name ────────────────────────────────────────────────── */}
      <div className="px-6 pt-3">
        <h3
          className="truncate text-lg font-bold tracking-tight text-white"
          title={domain.url}
        >
          {displayUrl(domain.url)}
        </h3>
        {domain.name && (
          <p className="mt-0.5 text-xs text-slate-500">{domain.name}</p>
        )}
      </div>

      {/* ── HTTP Status + Response ─────────────────────────────────────── */}
      {domain.httpStatus !== null && (
        <div className="mx-6 mt-3 flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <Server className="h-3 w-3" />
            HTTP {domain.httpStatus}
          </span>
          {domain.responseMs !== null && (
            <span className="text-slate-500">{domain.responseMs}ms</span>
          )}
        </div>
      )}

      {/* ── Info rows ─────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-col px-6 text-xs">
        <InfoRow
          icon={Shield}
          label="SSL Expires"
          value={
            domain.sslExpiry
              ? `${formatDate(domain.sslExpiry)}${sslDays !== null ? ` (${sslDays}d)` : ""}`
              : null
          }
          warn={sslDays !== null && sslDays <= 14}
        />
        <InfoRow
          icon={Globe2}
          label="Domain Expires"
          value={
            domain.domainExpiry
              ? `${formatDate(domain.domainExpiry)}${domainDays !== null ? ` (${domainDays}d)` : ""}`
              : null
          }
          warn={domainDays !== null && domainDays <= 30}
        />
        {domain.safeBrowsing && (
          <InfoRow
            icon={domain.safeBrowsing === "SAFE" ? ShieldCheck : ShieldAlert}
            label="Safe Browsing"
            value={
              domain.safeBrowsing === "SAFE"
                ? "Safe"
                : domain.safeBrowsing.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
            }
            warn={domain.safeBrowsing !== "SAFE"}
          />
        )}
        {domain.registrar && (
          <InfoRow icon={Server} label="Registrar" value={domain.registrar} />
        )}
        <InfoRow
          icon={Clock}
          label="Last Checked"
          value={formatRelativeTime(domain.lastCheckedAt)}
          last
        />
      </div>

      {/* ── Notes ─────────────────────────────────────────────────────── */}
      {domain.notes && (
        <div className="mx-6 mt-3 rounded-xl border border-white/[0.06] bg-[hsl(222,47%,11%)] px-4 py-3 text-xs text-slate-400">
          {domain.notes}
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div className="mt-auto border-t border-white/[0.06] px-6 py-3 mt-4">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          Added {formatDate(domain.createdAt)}
        </span>
      </div>
    </div>
  );
}

// ─── Small helper ────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
  last,
  warn,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null;
  last?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2 ${last ? "" : "border-b border-white/[0.06]"}`}
    >
      <span className="inline-flex items-center gap-1.5 text-slate-500">
        <Icon className="h-3 w-3" />
        {label}
      </span>
      <span
        className={`font-medium ${warn ? "text-amber-400" : "text-slate-200"}`}
      >
        {value ?? <span className="text-slate-600">&mdash;</span>}
      </span>
    </div>
  );
}
