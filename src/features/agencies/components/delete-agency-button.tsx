"use client";

/**
 * DeleteAgencyButton — inline delete with a two-step confirmation.
 *
 * States:
 *   idle     → shows a trash icon
 *   confirm  → shows "Delete | Cancel" text buttons (+ error if previous attempt failed)
 *   deleting → shows "Deleting…" text while the server action runs
 *
 * On success: router.refresh() re-renders the server table without the deleted row.
 * On error:   shows the error above the confirm buttons and resets to idle after Cancel.
 */

import { useState }  from "react";
import { useRouter } from "next/navigation";
import { Trash2 }    from "lucide-react";

import { deleteAgency } from "@/features/agencies/actions";

type Step = "idle" | "confirm" | "deleting";

interface DeleteAgencyButtonProps {
  id:             string;
  name:           string;
  adAccountCount: number;
}

export function DeleteAgencyButton({
  id,
  name,
  adAccountCount,
}: DeleteAgencyButtonProps) {
  const [step,  setStep]  = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const router            = useRouter();

  async function handleDelete() {
    setStep("deleting");
    setError(null);

    const result = await deleteAgency(id);

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

  // ── idle ──────────────────────────────────────────────────────────────────
  if (step === "idle") {
    return (
      <button
        onClick={() => setStep("confirm")}
        className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
        title={`Delete ${name}`}
        aria-label={`Delete ${name}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    );
  }

  // ── deleting ──────────────────────────────────────────────────────────────
  if (step === "deleting") {
    return (
      <span className="text-xs text-slate-400">Deleting…</span>
    );
  }

  // ── confirm ──────────────────────────────────────────────────────────────
  return (
    <span className="flex flex-col items-end gap-1">
      {/* Confirmation question */}
      <span className="max-w-[220px] text-right text-xs font-medium text-slate-700">
        Delete &ldquo;{name}&rdquo;?
      </span>

      {/* Error from previous attempt */}
      {error && (
        <span className="max-w-[220px] text-right text-xs text-red-500">
          {error}
        </span>
      )}

      {/* Hint about linked ad accounts before first attempt */}
      {!error && adAccountCount > 0 && (
        <span className="max-w-[220px] text-right text-xs text-amber-600">
          Has {adAccountCount} linked account{adAccountCount !== 1 ? "s" : ""}
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
