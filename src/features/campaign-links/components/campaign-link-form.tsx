"use client";

import { useState } from "react";

import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createCampaignLinks } from "../actions";
import { PAYMENT_MODELS, PAYMENT_MODEL_LABELS } from "../schema";
import type { TaboolaCampaignOption, KeitaroCampaignOption, AdspectStreamOption } from "../queries";
import type { CountryOption } from "@/features/publishers/queries";

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  taboolaCampaigns: TaboolaCampaignOption[];
  keitaroCampaigns: KeitaroCampaignOption[];
  countries: CountryOption[];
  adspectStreams: AdspectStreamOption[];
  onSuccess: () => void;
  onCancel: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const selectClass =
  "h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-100 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40";

const checkboxListClass =
  "max-h-48 overflow-y-auto rounded-md border border-white/10 bg-white/5 p-2 flex flex-col gap-1";

export function CampaignLinkForm({
  taboolaCampaigns,
  keitaroCampaigns,
  countries,
  adspectStreams,
  onSuccess,
  onCancel,
}: Props) {
  const [pending, setPending]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [paymentModel, setPaymentModel] = useState("CPL");
  const [selectedTaboola, setSelectedTaboola] = useState<Set<string>>(new Set());

  function fe(field: string) {
    return fieldErrors[field];
  }

  function toggleTaboola(extId: string) {
    setSelectedTaboola((prev) => {
      const next = new Set(prev);
      if (next.has(extId)) next.delete(extId);
      else next.add(extId);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    if (selectedTaboola.size === 0) {
      setError("Select at least one Taboola campaign");
      setPending(false);
      return;
    }

    const formData = new FormData(e.currentTarget);

    // Build campaign list: externalId → name
    const campaigns = Array.from(selectedTaboola).map((extId) => {
      const camp = taboolaCampaigns.find((c) => c.campaignExternalId === extId);
      return { externalId: extId, name: camp?.campaignName ?? extId };
    });

    formData.set("taboolaCampaigns", JSON.stringify(campaigns));

    const result = await createCampaignLinks(formData);

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

      {/* Taboola campaigns — multi-select */}
      <div className="flex flex-col gap-1.5">
        <Label>
          Taboola Campaigns *
          {selectedTaboola.size > 0 && (
            <span className="ml-2 text-xs text-slate-400">
              ({selectedTaboola.size} selected)
            </span>
          )}
        </Label>
        <div className={checkboxListClass}>
          {taboolaCampaigns.map((c) => (
            <label
              key={c.campaignExternalId}
              className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-200 hover:bg-white/5 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedTaboola.has(c.campaignExternalId)}
                onChange={() => toggleTaboola(c.campaignExternalId)}
                className="rounded border-white/20 bg-white/5"
              />
              <span className="truncate">
                {c.campaignName}
                <span className="ml-1 text-xs text-slate-400">({c.campaignExternalId})</span>
              </span>
            </label>
          ))}
          {taboolaCampaigns.length === 0 && (
            <p className="text-xs text-slate-500 px-2 py-1">No Taboola campaigns synced yet</p>
          )}
        </div>
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

      {/* Country (GEO) */}
      <div className="flex flex-col gap-1.5">
        <Label>Country (GEO)</Label>
        <select
          name="country"
          className={selectClass}
          defaultValue=""
        >
          <option value="">— Not set —</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>
        {fe("country") && (
          <p className="text-xs text-red-400">{fe("country")}</p>
        )}
      </div>

      {/* Adspect Stream */}
      {adspectStreams.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label>Adspect Stream</Label>
          <select
            name="adspectStreamId"
            className={selectClass}
            defaultValue=""
          >
            <option value="">— Not set —</option>
            {adspectStreams.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {fe("adspectStreamId") && (
            <p className="text-xs text-red-400">{fe("adspectStreamId")}</p>
          )}
        </div>
      )}

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
          {pending
            ? "Creating..."
            : selectedTaboola.size > 1
              ? `Add ${selectedTaboola.size} Mappings`
              : "Add Mapping"}
        </Button>
      </div>
    </form>
  );
}
