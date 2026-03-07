"use client";

/**
 * ExpenseForm — create / edit form for a single expense record.
 *
 * Modes:
 *  - Create: `expense` is undefined; submits createExpense action.
 *  - Edit:   `expense` provided; submits updateExpense(id, ...) action.
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

import { createExpense, updateExpense } from "@/features/expenses/actions";
import type { ExpenseEditData, CategoryOption } from "@/features/expenses/queries";
import {
  EXPENSE_RECURRENCES,
  EXPENSE_RECURRENCE_LABELS,
} from "@/features/expenses/schema";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExpenseFormProps {
  /** Provide to pre-fill the form for editing. Omit for create mode. */
  expense?: ExpenseEditData;
  /** Available categories for the <select>. */
  categories: CategoryOption[];
  onSuccess: () => void;
  onCancel:  () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExpenseForm({
  expense,
  categories,
  onSuccess,
  onCancel,
}: ExpenseFormProps) {
  const [pending,     setPending]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isEdit = !!expense;

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
      ? await updateExpense(expense.id, formData)
      : await createExpense(formData);

    setPending(false);

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
    }
  }

  // Default date to today for new expenses
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* Global error banner */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Row 1: Date + Category ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date">Date *</Label>
          <Input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={expense?.date ?? today}
            aria-invalid={!!err("date")}
          />
          {err("date") && (
            <p className="text-xs text-red-600">{err("date")}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="categoryId">Category *</Label>
          <select
            id="categoryId"
            name="categoryId"
            required
            defaultValue={expense?.categoryId ?? ""}
            aria-invalid={!!err("categoryId")}
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Select category...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {err("categoryId") && (
            <p className="text-xs text-red-600">{err("categoryId")}</p>
          )}
        </div>
      </div>

      {/* ── Row 2: Title / Description (full width) ──────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Title / Description *</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="e.g. OpenAI API credits, Hetzner VPS, etc."
          required
          maxLength={500}
          defaultValue={expense?.name ?? ""}
          aria-invalid={!!err("name")}
        />
        {err("name") && (
          <p className="text-xs text-red-600">{err("name")}</p>
        )}
      </div>

      {/* ── Row 3: Amount + Recurrence ───────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount">Amount (USD) *</Label>
          <Input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            required
            defaultValue={expense?.amount ?? ""}
            aria-invalid={!!err("amount")}
          />
          {err("amount") && (
            <p className="text-xs text-red-600">{err("amount")}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="recurrence">Recurrence</Label>
          <select
            id="recurrence"
            name="recurrence"
            defaultValue={expense?.recurrence ?? "ONE_TIME"}
            aria-invalid={!!err("recurrence")}
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {EXPENSE_RECURRENCES.map((r) => (
              <option key={r} value={r}>
                {EXPENSE_RECURRENCE_LABELS[r]}
              </option>
            ))}
          </select>
          {err("recurrence") && (
            <p className="text-xs text-red-600">{err("recurrence")}</p>
          )}
        </div>
      </div>

      {/* ── Row 4: Vendor (half width) ───────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="vendor">Vendor / Source</Label>
        <Input
          id="vendor"
          name="vendor"
          type="text"
          placeholder="e.g. Hetzner, OpenAI, Namecheap"
          maxLength={300}
          defaultValue={expense?.vendor ?? ""}
          aria-invalid={!!err("vendor")}
        />
        {err("vendor") && (
          <p className="text-xs text-red-600">{err("vendor")}</p>
        )}
      </div>

      {/* ── Row 5: Notes (full width textarea) ───────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Any additional details..."
          rows={3}
          maxLength={5000}
          defaultValue={expense?.notes ?? ""}
          aria-invalid={!!err("notes")}
        />
        {err("notes") && (
          <p className="text-xs text-red-600">{err("notes")}</p>
        )}
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
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
            : isEdit ? "Save Changes" : "Add Expense"}
        </Button>
      </div>
    </form>
  );
}
