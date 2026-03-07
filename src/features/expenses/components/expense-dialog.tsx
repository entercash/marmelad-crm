"use client";

/**
 * ExpenseDialog — wraps ExpenseForm in the shared Dialog component.
 *
 * Used for both create (no `expense` prop) and edit (with `expense` prop).
 * On success: closes the dialog and calls router.refresh() to re-render the
 * server-side table with the latest data.
 */

import { useState }  from "react";
import { useRouter } from "next/navigation";

import { Dialog }      from "@/components/ui/dialog";
import { ExpenseForm } from "./expense-form";
import type { ExpenseEditData, CategoryOption } from "@/features/expenses/queries";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExpenseDialogProps {
  /** Provide to open the dialog in edit mode with pre-filled values. */
  expense?: ExpenseEditData;
  /** Available categories for the form <select>. */
  categories: CategoryOption[];
  /** The element that opens the dialog when clicked. */
  trigger: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExpenseDialog({ expense, categories, trigger }: ExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const router          = useRouter();

  const isEdit = !!expense;

  function handleSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {/* Clicking the trigger element opens the dialog */}
      <div onClick={() => setOpen(true)} className="contents">
        {trigger}
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? "Edit Expense" : "New Expense"}
        description={
          isEdit
            ? "Update the details for this expense."
            : "Record a new operational expense."
        }
        className="w-full max-w-xl"
      >
        <ExpenseForm
          expense={expense}
          categories={categories}
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
