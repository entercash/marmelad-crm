"use client";

import { useState }  from "react";
import { useRouter } from "next/navigation";
import { Trash2 }    from "lucide-react";

import { deleteSeoBrand } from "../actions";

type Step = "idle" | "confirm" | "deleting";

export function DeleteBrandButton({ id }: { id: string }) {
  const [step, setStep]   = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete() {
    setStep("deleting");
    setError(null);
    const result = await deleteSeoBrand(id);
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
        className="rounded p-1 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
        title="Delete brand"
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
      <span className="max-w-[240px] text-right text-xs font-medium text-slate-300">
        Delete brand and all its leads?
      </span>
      {error && (
        <span className="max-w-[240px] text-right text-xs text-red-400">{error}</span>
      )}
      <span className="flex items-center gap-1.5">
        <button onClick={handleDelete} className="text-xs font-medium text-red-400 hover:text-red-300">
          Confirm
        </button>
        <span className="text-slate-600" aria-hidden="true">|</span>
        <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-200">
          Cancel
        </button>
      </span>
    </span>
  );
}
