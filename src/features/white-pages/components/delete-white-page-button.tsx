"use client";

/**
 * DeleteWhitePageButton — inline delete with a two-step confirmation.
 *
 * States:
 *   idle     → shows a trash icon button
 *   confirm  → shows "Delete this white page? | Confirm delete | Cancel"
 *   deleting → shows "Deleting…" while the server action runs
 *
 * On success: router.refresh() re-renders the server table without the deleted row.
 * On error:   shows the error above the confirm buttons and stays in confirm state.
 */

import { useState }  from "react";
import { useRouter } from "next/navigation";
import { Trash2 }    from "lucide-react";

import { deleteWhitePage } from "@/features/white-pages/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "idle" | "confirm" | "deleting";

interface DeleteWhitePageButtonProps {
  id: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DeleteWhitePageButton({ id }: DeleteWhitePageButtonProps) {
  const [step,  setStep]  = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const router            = useRouter();

  async function handleDelete() {
    setStep("deleting");
    setError(null);

    const result = await deleteWhitePage(id);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error);
      setStep("confirm"); // show error above confirm buttons
    }
  }

  function reset() {
    setStep("idle");
    setError(null);
  }

  // ── idle ───────────────────────────────────────────────────────────────────
  if (step === "idle") {
    return (
      <button
        onClick={() => setStep("confirm")}
        className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
        title="Delete white page"
        aria-label="Delete white page"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    );
  }

  // ── deleting ───────────────────────────────────────────────────────────────
  if (step === "deleting") {
    return (
      <span className="text-xs text-slate-400">Deleting…</span>
    );
  }

  // ── confirm ────────────────────────────────────────────────────────────────
  return (
    <span className="flex flex-col items-end gap-1">
      {/* Confirmation question */}
      <span className="max-w-[240px] text-right text-xs font-medium text-slate-700">
        Delete this white page?
      </span>

      {/* Error from a previous failed attempt */}
      {error && (
        <span className="max-w-[240px] text-right text-xs text-red-500">
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
