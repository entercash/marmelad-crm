"use client";

/**
 * AgencyForm — handles both create and edit in a single component.
 *
 * Props:
 *  - agency: pre-fill data for edit mode (undefined = create mode)
 *  - onSuccess: called after successful save
 *  - onCancel: called when the user cancels
 *
 * Submission flow:
 *   e.preventDefault() → build FormData → call server action → show error or call onSuccess()
 */

import { useState } from "react";

import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button }   from "@/components/ui/button";

import { createAgency, updateAgency } from "@/features/agencies/actions";
import type { AgencyEditData }        from "@/features/agencies/queries";

// ─── Types ─────────────────────────────────────────────────────────────────────

type FieldErrors = Record<string, string>;

interface AgencyFormProps {
  agency?:   AgencyEditData; // undefined → create mode
  onSuccess: () => void;
  onCancel:  () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function AgencyForm({ agency, onSuccess, onCancel }: AgencyFormProps) {
  const [pending,     setPending]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const isEdit = !!agency;

  // ── Submission ────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const result = isEdit
      ? await updateAgency(agency.id, formData)
      : await createAgency(formData);

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* General error (when there are no specific field errors to show) */}
      {error && Object.keys(fieldErrors).length === 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* ── Row 1: Name ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agency-name">
          Agency name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="agency-name"
          name="name"
          defaultValue={agency?.name ?? ""}
          placeholder="e.g. Blue Ocean Media"
          autoFocus
          disabled={pending}
          aria-invalid={!!err("name")}
        />
        {err("name") && (
          <p className="text-xs text-red-500">{err("name")}</p>
        )}
      </div>

      {/* ── Row 2: Website + Contact ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agency-website">Website</Label>
          <Input
            id="agency-website"
            name="website"
            defaultValue={agency?.website ?? ""}
            placeholder="https://agency.com"
            disabled={pending}
            aria-invalid={!!err("website")}
          />
          {err("website") && (
            <p className="text-xs text-red-500">{err("website")}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agency-contact">Contact</Label>
          <Input
            id="agency-contact"
            name="contact"
            defaultValue={agency?.contact ?? ""}
            placeholder="Name, email or phone"
            disabled={pending}
            aria-invalid={!!err("contact")}
          />
          {err("contact") && (
            <p className="text-xs text-red-500">{err("contact")}</p>
          )}
        </div>
      </div>

      {/* ── Row 3: Financial terms ───────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agency-cost">Account cost (USD)</Label>
          <Input
            id="agency-cost"
            name="accountCostUsd"
            type="number"
            step="0.01"
            min="0"
            defaultValue={agency?.accountCostUsd ?? ""}
            placeholder="0.00"
            disabled={pending}
            aria-invalid={!!err("accountCostUsd")}
          />
          {err("accountCostUsd") && (
            <p className="text-xs text-red-500">{err("accountCostUsd")}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agency-commission">Commission (%)</Label>
          <Input
            id="agency-commission"
            name="commissionPercent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={agency?.commissionPercent ?? ""}
            placeholder="0.00"
            disabled={pending}
            aria-invalid={!!err("commissionPercent")}
          />
          {err("commissionPercent") && (
            <p className="text-xs text-red-500">{err("commissionPercent")}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agency-crypto">Crypto payment (%)</Label>
          <Input
            id="agency-crypto"
            name="cryptoPaymentPercent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={agency?.cryptoPaymentPercent ?? ""}
            placeholder="0.00"
            disabled={pending}
            aria-invalid={!!err("cryptoPaymentPercent")}
          />
          {err("cryptoPaymentPercent") && (
            <p className="text-xs text-red-500">{err("cryptoPaymentPercent")}</p>
          )}
        </div>
      </div>

      {/* ── Row 4: Notes ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agency-notes">Notes</Label>
        <Textarea
          id="agency-notes"
          name="notes"
          defaultValue={agency?.notes ?? ""}
          placeholder="Payment terms, special conditions, contacts…"
          rows={3}
          disabled={pending}
          aria-invalid={!!err("notes")}
        />
        {err("notes") && (
          <p className="text-xs text-red-500">{err("notes")}</p>
        )}
      </div>

      {/* ── Row 5: Actions ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Save Changes" : "Create Agency"}
        </Button>
      </div>
    </form>
  );
}
