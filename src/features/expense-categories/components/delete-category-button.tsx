"use client";

/**
 * DeleteCategoryButton — inline delete with a two-step confirmation.
 *
 * States:
 *   idle     -> shows a trash icon button
 *   confirm  -> shows "Delete? | Confirm | Cancel"
 *   deleting -> shows "Deleting..." while the server action runs
 *
 * Safety:
 *   - System categories: trash icon is hidden
 *   - Categories with linked expenses: server action returns a
 *     user-friendly error explaining why deletion is blocked
 */

import { useState }  from "react";
import { useRouter } from "next/navigation";
import { Trash2 }    from "lucide-react";

import { deleteExpenseCategory } from "@/features/expense-categories/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "idle" | "confirm" | "deleting";

interface DeleteCategoryButtonProps {
  id: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DeleteCategoryButton({ id }: DeleteCategoryButtonProps) {
  const [step,  setStep]  = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const router            = useRouter();

  async function handleDelete() {
    setStep("deleting");
    setError(null);

    const result = await deleteExpenseCategory(id);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error);
      setStep("confirm");
    }
  }

  function reset() {
    setStep("idle");
    setError(null);
  }

  if (step === "idle") {
    return (
      <button
        onClick={() => setStep("confirm")}
        className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
        title="Delete category"
        aria-label="Delete category"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    );
  }

  if (step === "deleting") {
    return <span className="text-xs text-slate-400">Deleting...</span>;
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <span className="max-w-[260px] text-right text-xs font-medium text-slate-700">
        Delete this category?
      </span>

      {error && (
        <span className="max-w-[260px] text-right text-xs text-red-500">
          {error}
        </span>
      )}

      <span className="flex items-center gap-1.5">
        <button
          onClick={handleDelete}
          className="text-xs font-medium text-red-600 hover:text-red-700"
        >
          Confirm delete
        </button>
        <span className="text-slate-300" aria-hidden="true">|</span>
        <button
          onClick={reset}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
      </span>
    </span>
  );
}
