"use client";

/**
 * QuickCreateCategory — inline "+ New category" button that opens a small
 * dialog for creating a category without leaving the expense form.
 *
 * On success: calls onCreated(newCategoryId) so the parent form can
 * add the new option to the <select> and select it automatically.
 */

import { useState }  from "react";
import { useRouter } from "next/navigation";
import { Plus }      from "lucide-react";

import { Dialog }       from "@/components/ui/dialog";
import { CategoryForm } from "./category-form";

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuickCreateCategoryProps {
  /** Called after a category is successfully created, with the new ID. */
  onCreated: (id: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuickCreateCategory({ onCreated }: QuickCreateCategoryProps) {
  const [open, setOpen] = useState(false);
  const router          = useRouter();

  function handleSuccess(id?: string) {
    setOpen(false);
    router.refresh();
    if (id) onCreated(id);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
      >
        <Plus className="h-3 w-3" />
        New category
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New Category"
        description="Create a new expense category. It will be immediately available in the dropdown."
        className="w-full max-w-md"
      >
        <CategoryForm
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
