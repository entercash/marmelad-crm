"use client";

/**
 * WhitePageForm — create / edit form for a single white page record.
 *
 * Modes:
 *  - Create: `whitePage` is undefined; submits createWhitePage action.
 *  - Edit:   `whitePage` provided; submits updateWhitePage(id, ...) action.
 *
 * Submission flow:
 *  1. preventDefault
 *  2. Build FormData from the form element
 *  3. Call the appropriate server action
 *  4. On success: call onSuccess()
 *  5. On error:  display global error and per-field errors inline
 */

import { useState } from "react";

import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button }   from "@/components/ui/button";

import { createWhitePage, updateWhitePage } from "@/features/white-pages/actions";
import type { WhitePageEditData }           from "@/features/white-pages/queries";
import {
  WHITE_PAGE_STATUSES,
  WHITE_PAGE_STATUS_LABELS,
} from "@/features/white-pages/schema";

// ─── Props ────────────────────────────────────────────────────────────────────

interface WhitePageFormProps {
  /** Provide to pre-fill the form for editing. Omit for create mode. */
  whitePage?: WhitePageEditData;
  onSuccess: () => void;
  onCancel:  () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WhitePageForm({
  whitePage,
  onSuccess,
  onCancel,
}: WhitePageFormProps) {
  const [pending,     setPending]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isEdit = !!whitePage;

  /** Returns the first field-level error for `field`, or undefined. */
  function err(field: string): string | undefined {
    return fieldErrors[field];
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const result   = isEdit
      ? await updateWhitePage(whitePage.id, formData)
      : await createWhitePage(formData);

    setPending(false);

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* Global error banner */}
      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Row 1: Transfer Date + GEO ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="transferDate">Transfer Date *</Label>
          <Input
            id="transferDate"
            name="transferDate"
            type="date"
            required
            defaultValue={whitePage?.transferDate ?? ""}
            aria-invalid={!!err("transferDate")}
          />
          {err("transferDate") && (
            <p className="text-xs text-red-600">{err("transferDate")}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="geo">GEO *</Label>
          <Input
            id="geo"
            name="geo"
            type="text"
            placeholder="US"
            required
            maxLength={10}
            defaultValue={whitePage?.geo ?? ""}
            aria-invalid={!!err("geo")}
          />
          {err("geo") && (
            <p className="text-xs text-red-600">{err("geo")}</p>
          )}
        </div>
      </div>

      {/* ── Row 2: URL (full width) ────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="url">URL *</Label>
        <Input
          id="url"
          name="url"
          type="text"
          placeholder="https://example.com"
          required
          maxLength={2000}
          defaultValue={whitePage?.url ?? ""}
          aria-invalid={!!err("url")}
        />
        {err("url") && (
          <p className="text-xs text-red-600">{err("url")}</p>
        )}
      </div>

      {/* ── Row 3: Topic + Status ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="topic">Topic</Label>
          <Input
            id="topic"
            name="topic"
            type="text"
            placeholder="Finance, Health…"
            maxLength={300}
            defaultValue={whitePage?.topic ?? ""}
            aria-invalid={!!err("topic")}
          />
          {err("topic") && (
            <p className="text-xs text-red-600">{err("topic")}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Status *</Label>
          {/*
           * Plain <select> styled to match Input — no additional Radix/shadcn
           * dependency. Height (h-9) and padding match the Input component.
           */}
          <select
            id="status"
            name="status"
            required
            defaultValue={whitePage?.status ?? "PREMODERATION"}
            aria-invalid={!!err("status")}
            className="h-9 w-full rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-100 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {WHITE_PAGE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {WHITE_PAGE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          {err("status") && (
            <p className="text-xs text-red-600">{err("status")}</p>
          )}
        </div>
      </div>

      {/* ── Row 4: Zoho Email + Password ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="zohoEmail">Zoho Email</Label>
          <Input
            id="zohoEmail"
            name="zohoEmail"
            type="text"
            placeholder="user@zoho.com"
            maxLength={300}
            defaultValue={whitePage?.zohoEmail ?? ""}
            aria-invalid={!!err("zohoEmail")}
          />
          {err("zohoEmail") && (
            <p className="text-xs text-red-600">{err("zohoEmail")}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          {/*
           * type="text" intentional — this is an internal tool and the team
           * needs to see/copy the password. Do not change to type="password".
           */}
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="text"
            placeholder="Account password"
            maxLength={200}
            defaultValue={whitePage?.password ?? ""}
            aria-invalid={!!err("password")}
          />
          {err("password") && (
            <p className="text-xs text-red-600">{err("password")}</p>
          )}
        </div>
      </div>

      {/* ── Row 5: Tax Number (half width) ────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="taxNumber">Tax Number</Label>
          <Input
            id="taxNumber"
            name="taxNumber"
            type="text"
            placeholder="VAT / Tax ID"
            maxLength={100}
            defaultValue={whitePage?.taxNumber ?? ""}
            aria-invalid={!!err("taxNumber")}
          />
          {err("taxNumber") && (
            <p className="text-xs text-red-600">{err("taxNumber")}</p>
          )}
        </div>
      </div>

      {/* ── Row 6: Legal entity data (full width textarea) ────────────────── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="legalEntityData">Legal Entity Data</Label>
        <Textarea
          id="legalEntityData"
          name="legalEntityData"
          placeholder="Company name, registration number, address…"
          rows={3}
          maxLength={5000}
          defaultValue={whitePage?.legalEntityData ?? ""}
          aria-invalid={!!err("legalEntityData")}
        />
        {err("legalEntityData") && (
          <p className="text-xs text-red-600">{err("legalEntityData")}</p>
        )}
      </div>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
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
            ? isEdit ? "Saving…"   : "Creating…"
            : isEdit ? "Save Changes" : "Create White Page"}
        </Button>
      </div>
    </form>
  );
}
