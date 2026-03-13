"use client";

import { useState } from "react";

import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createCampaignLink } from "../actions";
import { PAYMENT_MODELS, PAYMENT_MODEL_LABELS } from "../schema";
import type { TaboolaCampaignOption, KeitaroCampaignOption } from "../queries";

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  taboolaCampaigns: TaboolaCampaignOption[];
  keitaroCampaigns: KeitaroCampaignOption[];
  onSuccess: () => void;
  onCancel: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const selectClass =
  "h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-100 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40";

export function CampaignLinkForm({
  taboolaCampaigns,
  keitaroCampaigns,
  onSuccess,
  onCancel,
}: Props) {
  const [pending, setPending]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [paymentModel, setPaymentModel] = useState("CPL");
  const [campaignName, setCampaignName] = useState("");

  function fe(field: string) {
    return fieldErrors[field];
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const result = await createCampaignLink(formData);

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
      {/* Global error */}
      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Taboola campaign */}
      <div className="flex flex-col gap-1.5">
        <Label>Taboola Campaign *</Label>
        <select
          name="taboolaCampaignExternalId"
          required
          className={selectClass}
          defaultValue=""
          onChange={(e) => {
            const opt = e.target.selectedOptions[0];
            setCampaignName(opt?.dataset.name ?? "");
          }}
        >
          <option value="" disabled>
            Select Taboola campaign...
          </option>
          {taboolaCampaigns.map((c) => (
            <option
              key={c.campaignExternalId}
              value={c.campaignExternalId}
              data-name={c.campaignName}
            >
              {c.campaignName} ({c.campaignExternalId})
            </option>
          ))}
        </select>
        <input type="hidden" name="taboolaCampaignName" value={campaignName} />
        {fe("taboolaCampaignExternalId") && (
          <p className="text-xs text-red-400">{fe("taboolaCampaignExternalId")}</p>
        )}
      </div>

      {/* Keitaro campaign */}
      <div className="flex flex-col gap-1.5">
        <Label>Keitaro Campaign *</Label>
        <select
          name="keitaroCampaignId"
          required
          className={selectClass}
          defaultValue=""
        >
          <option value="" disabled>
            Select Keitaro campaign...
          </option>
          {keitaroCampaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.state !== "active" ? ` (${c.state})` : ""}
            </option>
          ))}
        </select>
        {fe("keitaroCampaignId") && (
          <p className="text-xs text-red-400">{fe("keitaroCampaignId")}</p>
        )}
      </div>

      {/* Payment model */}
      <div className="flex flex-col gap-1.5">
        <Label>Payment Model *</Label>
        <select
          name="paymentModel"
          required
          className={selectClass}
          value={paymentModel}
          onChange={(e) => setPaymentModel(e.target.value)}
        >
          {PAYMENT_MODELS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_MODEL_LABELS[m]}
            </option>
          ))}
        </select>
        {fe("paymentModel") && (
          <p className="text-xs text-red-400">{fe("paymentModel")}</p>
        )}
      </div>

      {/* CPL rate */}
      {paymentModel === "CPL" && (
        <div className="flex flex-col gap-1.5">
          <Label>Rate per Lead (USD) *</Label>
          <Input
            name="cplRate"
            type="text"
            inputMode="decimal"
            placeholder="e.g. 12.50"
          />
          {fe("cplRate") && (
            <p className="text-xs text-red-400">{fe("cplRate")}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 border-t border-white/[0.06] pt-3">
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
          {pending ? "Creating..." : "Add Mapping"}
        </Button>
      </div>
    </form>
  );
}
