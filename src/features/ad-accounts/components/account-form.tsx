"use client";

/**
 * AccountForm — handles both create and edit in a single component.
 *
 * Props:
 *  - account:  pre-fill data for edit mode (undefined = create mode)
 *  - agencies: dropdown options loaded from the Agencies table
 *  - onSuccess: called after successful save
 *  - onCancel:  called when the user cancels
 */

import { useState } from "react";

import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { createAccount, updateAccount } from "@/features/ad-accounts/actions";
import type { AccountEditData, AgencyOption } from "@/features/ad-accounts/queries";
import {
  ACCOUNT_PLATFORMS, ACCOUNT_PLATFORM_LABELS,
  ACCOUNT_TYPES,     ACCOUNT_TYPE_LABELS,
  ACCOUNT_STATUSES,  ACCOUNT_STATUS_LABELS,
  CURRENCIES,        CURRENCY_LABELS,
} from "@/features/ad-accounts/schema";

// ─── Types ─────────────────────────────────────────────────────────────────────

type FieldErrors = Record<string, string>;

interface AccountFormProps {
  account?:  AccountEditData; // undefined → create mode
  agencies:  AgencyOption[];
  onSuccess: () => void;
  onCancel:  () => void;
}

// ─── Shared select class ──────────────────────────────────────────────────────

const selectClass =
  "h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-white shadow-sm " +
  "transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-0 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

// ─── Component ─────────────────────────────────────────────────────────────────

export function AccountForm({ account, agencies, onSuccess, onCancel }: AccountFormProps) {
  const [pending,     setPending]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const isEdit = !!account;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const result = isEdit
      ? await updateAccount(account.id, formData)
      : await createAccount(formData);

    setPending(false);

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error);
      if ("fieldErrors" in result && result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      }
    }
  }

  function err(field: string) {
    return fieldErrors[field] ?? null;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Global error banner */}
      {error && Object.keys(fieldErrors).length === 0 && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* ── Row 1: Name ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-name">
          Account name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="account-name"
          name="name"
          defaultValue={account?.name ?? ""}
          placeholder="e.g. My Taboola Account"
          autoFocus
          disabled={pending}
          aria-invalid={!!err("name")}
        />
        {err("name") && <p className="text-xs text-red-500">{err("name")}</p>}
      </div>

      {/* ── Row 2: Agency + Status + Currency ───────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-agency">Agency</Label>
          <select
            id="account-agency"
            name="agencyId"
            defaultValue={account?.agencyId ?? ""}
            disabled={pending}
            aria-invalid={!!err("agencyId")}
            className={selectClass}
          >
            <option value="">No agency</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {err("agencyId") && <p className="text-xs text-red-500">{err("agencyId")}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-status">
            Status <span className="text-red-500">*</span>
          </Label>
          <select
            id="account-status"
            name="status"
            defaultValue={account?.status ?? "EMPTY"}
            disabled={pending}
            aria-invalid={!!err("status")}
            className={selectClass}
          >
            {ACCOUNT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ACCOUNT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          {err("status") && <p className="text-xs text-red-500">{err("status")}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-currency">
            Currency <span className="text-red-500">*</span>
          </Label>
          <select
            id="account-currency"
            name="currency"
            defaultValue={account?.currency ?? "USD"}
            disabled={pending}
            aria-invalid={!!err("currency")}
            className={selectClass}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_LABELS[c]}
              </option>
            ))}
          </select>
          {err("currency") && <p className="text-xs text-red-500">{err("currency")}</p>}
        </div>
      </div>

      {/* ── Row 3: Platform + Account Type ───────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-platform">
            Platform <span className="text-red-500">*</span>
          </Label>
          <select
            id="account-platform"
            name="platform"
            defaultValue={account?.platform ?? "OTHER"}
            disabled={pending}
            aria-invalid={!!err("platform")}
            className={selectClass}
          >
            {ACCOUNT_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {ACCOUNT_PLATFORM_LABELS[p]}
              </option>
            ))}
          </select>
          {err("platform") && <p className="text-xs text-red-500">{err("platform")}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-type">
            Account Type <span className="text-red-500">*</span>
          </Label>
          <select
            id="account-type"
            name="accountType"
            defaultValue={account?.accountType ?? "FARM"}
            disabled={pending}
            aria-invalid={!!err("accountType")}
            className={selectClass}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACCOUNT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          {err("accountType") && <p className="text-xs text-red-500">{err("accountType")}</p>}
        </div>
      </div>

      {/* ── Row 4: Account Country + Traffic Country ──────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-country">Account Country</Label>
          <Input
            id="account-country"
            name="accountCountry"
            defaultValue={account?.accountCountry ?? ""}
            placeholder="e.g. US"
            maxLength={100}
            disabled={pending}
            aria-invalid={!!err("accountCountry")}
          />
          {err("accountCountry") && (
            <p className="text-xs text-red-500">{err("accountCountry")}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="traffic-country">Traffic Country</Label>
          <Input
            id="traffic-country"
            name="trafficCountry"
            defaultValue={account?.trafficCountry ?? ""}
            placeholder="e.g. DE"
            maxLength={100}
            disabled={pending}
            aria-invalid={!!err("trafficCountry")}
          />
          {err("trafficCountry") && (
            <p className="text-xs text-red-500">{err("trafficCountry")}</p>
          )}
        </div>
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving\u2026" : isEdit ? "Save Changes" : "Create Account"}
        </Button>
      </div>
    </form>
  );
}
