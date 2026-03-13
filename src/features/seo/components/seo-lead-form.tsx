"use client";

import { useState } from "react";

import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { upsertSeoLead } from "../actions";
import { PAYMENT_MODELS, PAYMENT_MODEL_LABELS } from "../schema";

interface Props {
  brandId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const selectClass =
  "h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-100 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40";

export function SeoLeadForm({ brandId, onSuccess, onCancel }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function fe(field: string) {
    return fieldErrors[field];
  }

  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const result = await upsertSeoLead(formData);

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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="seoBrandId" value={brandId} />

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Date */}
        <div className="flex flex-col gap-1.5">
          <Label>Date *</Label>
          <Input name="date" type="date" required defaultValue={today} />
          {fe("date") && <p className="text-xs text-red-400">{fe("date")}</p>}
        </div>

        {/* Country */}
        <div className="flex flex-col gap-1.5">
          <Label>Country *</Label>
          <Input name="country" required placeholder="GB" maxLength={2} className="uppercase" />
          {fe("country") && <p className="text-xs text-red-400">{fe("country")}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Quantity */}
        <div className="flex flex-col gap-1.5">
          <Label>Leads *</Label>
          <Input name="quantity" type="number" required min={1} placeholder="10" />
          {fe("quantity") && <p className="text-xs text-red-400">{fe("quantity")}</p>}
        </div>

        {/* Rate */}
        <div className="flex flex-col gap-1.5">
          <Label>Rate per Lead (USD) *</Label>
          <Input name="rate" type="text" inputMode="decimal" required placeholder="12.50" />
          {fe("rate") && <p className="text-xs text-red-400">{fe("rate")}</p>}
        </div>
      </div>

      {/* Payment Model */}
      <div className="flex flex-col gap-1.5">
        <Label>Payment Model *</Label>
        <select name="paymentModel" required className={selectClass} defaultValue="CPL">
          {PAYMENT_MODELS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_MODEL_LABELS[m]}
            </option>
          ))}
        </select>
        {fe("paymentModel") && <p className="text-xs text-red-400">{fe("paymentModel")}</p>}
      </div>

      <p className="text-xs text-slate-500">
        Same brand + date + country will overwrite existing entry.
      </p>

      <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-3">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving..." : "Save Leads"}
        </Button>
      </div>
    </form>
  );
}
