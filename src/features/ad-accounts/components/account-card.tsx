"use client";

/**
 * AccountCard — renders a single ad-account as a glassmorphism card.
 */

import { Pencil } from "lucide-react";

import { Badge }               from "@/components/ui/badge";
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

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  ACTIVE:           "success",
  UNDER_MODERATION: "warning",
  BANNED:           "destructive",
  EMPTY:            "secondary",
};

const PLATFORM_COLORS: Record<string, string> = {
  TABOOLA:  "bg-blue-500/15 text-blue-400",
  FACEBOOK: "bg-indigo-500/15 text-indigo-400",
  GOOGLE:   "bg-emerald-500/15 text-emerald-400",
  TIKTOK:   "bg-pink-500/15 text-pink-400",
  OTHER:    "bg-white/10 text-slate-400",
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
  const spentFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(account.totalSpentUsd);

  return (
    <div className="glass flex flex-col transition-shadow hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]">
      {/* ── Header: Status + Actions ──────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-4">
        <Badge variant={STATUS_VARIANT[account.status] ?? "secondary"}>
          {statusLabel}
        </Badge>

        <div className="flex items-center gap-1">
          <AccountDialog
            account={editData}
            agencies={agencies}
            trigger={
              <button
                className="rounded p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
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

      {/* ── Name + Spent ────────────────────────────────────────────── */}
      <div className="px-4 pt-2">
        <h3 className="truncate text-sm font-semibold text-white" title={account.name}>
          {account.name}
        </h3>
        <p className="mt-1 text-lg font-bold text-white">
          {spentFormatted}
          <span className="ml-1 text-xs font-normal text-slate-500">spent</span>
        </p>
      </div>

      {/* ── Platform + Type chips ─────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-4 pt-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
            PLATFORM_COLORS[account.platform] ?? PLATFORM_COLORS.OTHER
          }`}
        >
          {platformLabel}
        </span>
        <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-400">
          {typeLabel}
        </span>
      </div>

      {/* ── Info rows ─────────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-col gap-1.5 px-4 text-xs">
        <InfoRow label="Agency" value={account.agencyName} />
        <InfoRow label="Account GEO" value={account.accountCountry} />
        <InfoRow label="Traffic GEO" value={account.trafficCountry} />
        <InfoRow label="Currency" value={currencyLabel} />
      </div>

      {/* ── Footer: created date ──────────────────────────────────────── */}
      <div className="mt-auto border-t border-white/[0.06] px-4 py-2.5 mt-3">
        <span className="text-[11px] text-slate-500">
          Created {formatDate(account.createdAt)}
        </span>
      </div>
    </div>
  );
}

// ─── Small helper ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-200">
        {value ?? <span className="text-slate-600">—</span>}
      </span>
    </div>
  );
}
