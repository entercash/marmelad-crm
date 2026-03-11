"use client";

/**
 * TopUpForm — create / edit form for an account top-up.
 *
 * Amount is always in USD. Form is rendered inside a Dialog.
 */

import { useState } from "react";

import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { createTopUp, updateTopUp } from "@/features/balances/actions";
import type { TopUpEditData, AccountOption } from "@/features/balances/queries";

// ─── Props ────────────────────────────────────────────────────────────────────

interface TopUpFormProps {
  topUp?:   TopUpEditData;
  accounts: AccountOption[];
  onSuccess: () => void;
  onCancel:  () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TopUpForm({
  topUp,
  accounts,
  onSuccess,
  onCancel,
}: TopUpFormProps) {
  const [pending,     setPending]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isEdit = !!topUp;

  function err(field: string): string | undefined {
    return fieldErrors[field];
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const result = isEdit
      ? await updateTopUp(topUp.id, formData)
      : await createTopUp(formData);

    setPending(false);

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* Global error banner */}
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Account */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="accountId">Account *</Label>
        <select
          id="accountId"
          name="accountId"
          required
          defaultValue={topUp?.accountId ?? ""}
          aria-invalid={!!err("accountId")}
          className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Select account...</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {err("accountId") && (
          <p className="text-xs text-red-400">{err("accountId")}</p>
        )}
      </div>

      {/* Date + Amount */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date">Date *</Label>
          <Input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={topUp?.date ?? today}
            aria-invalid={!!err("date")}
          />
          {err("date") && (
            <p className="text-xs text-red-400">{err("date")}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount">Amount (USD) *</Label>
          <Input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            required
            defaultValue={topUp?.amount ?? ""}
            aria-invalid={!!err("amount")}
          />
          {err("amount") && (
            <p className="text-xs text-red-400">{err("amount")}</p>
          )}
        </div>
      </div>

      {/* Note */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Note</Label>
        <Input
          id="note"
          name="note"
          type="text"
          placeholder="Optional comment..."
          maxLength={1000}
          defaultValue={topUp?.note ?? ""}
          aria-invalid={!!err("note")}
        />
        {err("note") && (
          <p className="text-xs text-red-400">{err("note")}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 border-t border-white/10 pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending
            ? isEdit ? "Saving..."   : "Creating..."
            : isEdit ? "Save Changes" : "Add Top-Up"}
        </Button>
      </div>
    </form>
  );
}
