"use client";

/**
 * DeleteAccountButton — inline delete with a two-step confirmation.
 *
 * States:
 *   idle     → trash icon
 *   confirm  → "Confirm delete | Cancel" (with error if previous attempt failed)
 *   deleting → "Deleting…" spinner text
 */

import { useState }  from "react";
import { useRouter } from "next/navigation";
import { Trash2 }    from "lucide-react";

import { deleteAccount } from "@/features/ad-accounts/actions";

type Step = "idle" | "confirm" | "deleting";

interface DeleteAccountButtonProps {
  id:   string;
  name: string;
}

export function DeleteAccountButton({ id, name }: DeleteAccountButtonProps) {
  const [step,  setStep]  = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const router            = useRouter();

  async function handleDelete() {
    setStep("deleting");
    setError(null);

    const result = await deleteAccount(id);

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
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
        title={`Delete ${name}`}
        aria-label={`Delete ${name}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    );
  }

  if (step === "deleting") {
    return <span className="text-xs text-slate-400">Deleting…</span>;
  }

  // confirm
  return (
    <span className="flex flex-col items-end gap-1">
      <span className="max-w-[220px] text-right text-xs font-medium text-slate-300">
        Delete &ldquo;{name}&rdquo;?
      </span>

      {error && (
        <span className="max-w-[220px] text-right text-xs text-red-500">{error}</span>
      )}

      <span className="flex items-center gap-1.5">
        <button
          onClick={handleDelete}
          className="text-xs font-medium text-red-400 hover:text-red-300"
        >
          Confirm delete
        </button>
        <span className="text-slate-600" aria-hidden="true">|</span>
        <button
          onClick={reset}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          Cancel
        </button>
      </span>
    </span>
  );
}
