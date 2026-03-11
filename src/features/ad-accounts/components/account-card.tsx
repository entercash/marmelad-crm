"use client";

/**
 * AccountCard — renders a single ad-account card (dark theme).
 */

import { Pencil, Calendar } from "lucide-react";

import { AccountDialog }       from "./account-dialog";
import { DeleteAccountButton } from "./delete-account-button";
import { formatDate }          from "@/lib/format";
import type { AccountRow, AccountEditData, AgencyOption } from "@/features/ad-accounts/queries";
import {
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_PLATFORM_LABELS,
  ACCOUNT_TYPE_LABELS,
  CURRENCY_LABELS,
  type AccountStatusValue,
  type AccountPlatformValue,
  type CurrencyValue,
} from "@/features/ad-accounts/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { dot: string; bg: string; text: string }> = {
  ACTIVE:           { dot: "bg-emerald-400", bg: "bg-emerald-500/15", text: "text-emerald-400" },
  UNDER_MODERATION: { dot: "bg-amber-400",   bg: "bg-amber-500/15",   text: "text-amber-400" },
  BANNED:           { dot: "bg-red-400",      bg: "bg-red-500/15",     text: "text-red-400" },
  EMPTY:            { dot: "bg-slate-400",    bg: "bg-slate-500/15",   text: "text-slate-400" },
};

const PLATFORM_COLORS: Record<string, string> = {
  TABOOLA:  "border-blue-500/20 bg-blue-500/10 text-blue-400",
  FACEBOOK: "border-indigo-500/20 bg-indigo-500/10 text-indigo-400",
  GOOGLE:   "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  TIKTOK:   "border-pink-500/20 bg-pink-500/10 text-pink-400",
  OTHER:    "border-white/10 bg-white/5 text-slate-400",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface AccountCardProps {
  account:  AccountRow;
  agencies: AgencyOption[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AccountCard({ account, agencies }: AccountCardProps) {
  const editData: AccountEditData = {
    id:             account.id,
    name:           account.name,
    externalId:     account.externalId,
    agencyId:       account.agencyId,
    platform:       account.platform,
    accountType:    account.accountType,
    status:         account.status,
    accountCountry: account.accountCountry,
    trafficCountry: account.trafficCountry,
    currency:       account.currency,
  };

  const statusLabel   = ACCOUNT_STATUS_LABELS[account.status as AccountStatusValue] ?? account.status;
  const platformLabel = ACCOUNT_PLATFORM_LABELS[account.platform as AccountPlatformValue] ?? account.platform;
  const typeLabel     = ACCOUNT_TYPE_LABELS[account.accountType as keyof typeof ACCOUNT_TYPE_LABELS] ?? account.accountType;
  const currencyLabel = CURRENCY_LABELS[account.currency as CurrencyValue] ?? account.currency;

  const fmtCurrency = (v: number, cur: string) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
    }).format(v);

  const fmtUsd = (v: number) => fmtCurrency(v, "USD");
  const fmtNative = (v: number) => fmtCurrency(v, account.currency);
  const isNonUsd = account.currency !== "USD";
  const hasSpend = account.rawSpentUsd > 0;
  const hasCommissions = (account.commissionPercent ?? 0) > 0 || (account.cryptoPaymentPercent ?? 0) > 0;

  // USD breakdown
  const commissionUsd = account.rawSpentUsd * ((account.commissionPercent ?? 0) / 100);
  const afterCommission = account.rawSpentUsd + commissionUsd;
  const cryptoFeeUsd = afterCommission * ((account.cryptoPaymentPercent ?? 0) / 100);

  const statusStyle = STATUS_STYLES[account.status] ?? STATUS_STYLES.EMPTY;

  return (
    <div className="group flex flex-col rounded-2xl border border-white/[0.08] bg-[hsl(217,33%,13%)] shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(59,130,246,0.12)]">
      {/* ── Header: Status + Actions ──────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 pt-5">
        <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
          {statusLabel}
        </span>

        <div className="flex items-center gap-1">
          <AccountDialog
            account={editData}
            agencies={agencies}
            trigger={
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-200"
                title={`Edit ${account.name}`}
                aria-label={`Edit ${account.name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            }
          />
          <DeleteAccountButton id={account.id} name={account.name} />
        </div>
      </div>

      {/* ── Name + Total Spent ──────────────────────────────────────── */}
      <div className="px-6 pt-3">
        <h3 className="truncate text-xl font-bold tracking-tight text-white" title={account.name}>
          {account.name}
        </h3>
        {account.externalId && (
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">
            ID: {account.externalId}
          </p>
        )}
        <p className="mt-2 text-[32px] font-extrabold leading-none tracking-tight text-white">
          {fmtUsd(account.totalSpentUsd)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          total cost
          {isNonUsd && hasSpend && (
            <span className="ml-2 text-slate-400">{fmtNative(account.totalCostNative)}</span>
          )}
        </p>
      </div>

      {/* ── Spend breakdown (USD) ─────────────────────────────────────── */}
      {hasSpend && hasCommissions && (
        <div className="mx-6 mt-3 rounded-xl border border-white/[0.06] bg-[hsl(222,47%,11%)] px-4 py-3 text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span>Raw spend</span>
            <span className="font-medium text-slate-300">{fmtUsd(account.rawSpentUsd)}</span>
          </div>
          {(account.commissionPercent ?? 0) > 0 && (
            <div className="mt-1.5 flex items-center justify-between text-slate-400">
              <span>Commission ({account.commissionPercent}%)</span>
              <span className="font-medium text-violet-400">+{fmtUsd(commissionUsd)}</span>
            </div>
          )}
          {(account.cryptoPaymentPercent ?? 0) > 0 && (
            <div className="mt-1.5 flex items-center justify-between text-slate-400">
              <span>Crypto fee ({account.cryptoPaymentPercent}%)</span>
              <span className="font-medium text-violet-400">+{fmtUsd(cryptoFeeUsd)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Platform + Type chips ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-6 pt-3">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
            PLATFORM_COLORS[account.platform] ?? PLATFORM_COLORS.OTHER
          }`}
        >
          {platformLabel}
        </span>
        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-slate-400">
          {typeLabel}
        </span>
      </div>

      {/* ── Info rows ─────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-col px-6 text-xs">
        <InfoRow label="Agency" value={account.agencyName} />
        <InfoRow label="Account GEO" value={account.accountCountry} />
        <InfoRow label="Traffic GEO" value={account.trafficCountry} />
        <InfoRow label="Currency" value={currencyLabel} last />
      </div>

      {/* ── Footer: created date ──────────────────────────────────────── */}
      <div className="mt-auto border-t border-white/[0.06] px-6 py-3 mt-4">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <Calendar className="h-3 w-3" />
          Created {formatDate(account.createdAt)}
        </span>
      </div>
    </div>
  );
}

// ─── Small helper ────────────────────────────────────────────────────────────

function InfoRow({ label, value, last }: { label: string; value: string | null; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${last ? "" : "border-b border-white/[0.06]"}`}>
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-200">
        {value ?? <span className="text-slate-600">&mdash;</span>}
      </span>
    </div>
  );
}
