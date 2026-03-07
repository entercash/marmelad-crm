"use client";

/**
 * CategoryDialog — wraps CategoryForm in the shared Dialog component.
 *
 * Used for both create (no `category` prop) and edit (with `category` prop).
 * On success: closes the dialog and calls router.refresh().
 */

import { useState }  from "react";
import { useRouter } from "next/navigation";

import { Dialog }       from "@/components/ui/dialog";
import { CategoryForm } from "./category-form";
import type { ExpenseCategoryEditData } from "@/features/expense-categories/queries";

// ─── Props ────────────────────────────────────────────────────────────────────

interface CategoryDialogProps {
  /** Provide to open the dialog in edit mode with pre-filled values. */
  category?: ExpenseCategoryEditData;
  /** The element that opens the dialog when clicked. */
  trigger: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CategoryDialog({ category, trigger }: CategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const router          = useRouter();

  const isEdit = !!category;

  function handleSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <div onClick={() => setOpen(true)} className="contents">
        {trigger}
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? "Edit Category" : "New Category"}
        description={
          isEdit
            ? "Update the name or colour for this category."
            : "Create a new expense category."
        }
        className="w-full max-w-md"
      >
        <CategoryForm
          category={category}
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
