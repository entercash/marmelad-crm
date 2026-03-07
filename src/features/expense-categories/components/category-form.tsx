"use client";

/**
 * CategoryForm — create / edit form for an expense category.
 *
 * Modes:
 *  - Create: `category` is undefined; submits createExpenseCategory action.
 *  - Edit:   `category` provided; submits updateExpenseCategory(id, ...) action.
 */

import { useState } from "react";

import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import {
  createExpenseCategory,
  updateExpenseCategory,
} from "@/features/expense-categories/actions";
import type { ExpenseCategoryEditData } from "@/features/expense-categories/queries";
import { CATEGORY_COLORS }             from "@/features/expense-categories/schema";

// ─── Props ────────────────────────────────────────────────────────────────────

interface CategoryFormProps {
  /** Provide to pre-fill the form for editing. Omit for create mode. */
  category?: ExpenseCategoryEditData;
  onSuccess: (id?: string) => void;
  onCancel:  () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CategoryForm({
  category,
  onSuccess,
  onCancel,
}: CategoryFormProps) {
  const [pending,     setPending]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [selectedColor, setSelectedColor] = useState(
    category?.color ?? CATEGORY_COLORS[0],
  );

  const isEdit = !!category;

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
      ? await updateExpenseCategory(category.id, formData)
      : await createExpenseCategory(formData);

    setPending(false);

    if (result.success) {
      onSuccess(result.id);
    } else {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Global error banner */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Name ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cat-name">Name *</Label>
        <Input
          id="cat-name"
          name="name"
          type="text"
          placeholder="e.g. Proxies, Creatives, etc."
          required
          maxLength={100}
          defaultValue={category?.name ?? ""}
          aria-invalid={!!err("name")}
        />
        {err("name") && (
          <p className="text-xs text-red-600">{err("name")}</p>
        )}
      </div>

      {/* ── Colour picker ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <Label>Colour</Label>
        <input type="hidden" name="color" value={selectedColor} />
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedColor(c)}
              className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                selectedColor === c
                  ? "border-slate-900 ring-2 ring-slate-900/20"
                  : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
              title={c}
              aria-label={`Select colour ${c}`}
            />
          ))}
        </div>
        {/* Preview */}
        <div className="mt-1 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${selectedColor}18`,
              color: selectedColor,
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: selectedColor }}
            />
            Preview
          </span>
        </div>
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
            : isEdit ? "Save Changes" : "Add Category"}
        </Button>
      </div>
    </form>
  );
}
