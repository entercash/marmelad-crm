"use client";

import { useState }  from "react";
import { useRouter } from "next/navigation";
import { Trash2 }    from "lucide-react";

import { deleteSeoLead } from "../actions";

type Step = "idle" | "confirm" | "deleting";

export function DeleteLeadButton({ id }: { id: string }) {
  const [step, setStep]   = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete() {
    setStep("deleting");
    setError(null);
    const result = await deleteSeoLead(id);
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
        title="Delete lead"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    );
  }

  if (step === "deleting") {
    return <span className="text-xs text-slate-400">Deleting...</span>;
  }

  return (
    <span className="flex items-center gap-1.5">
      {error && <span className="text-xs text-red-400">{error}</span>}
      <button onClick={handleDelete} className="text-xs font-medium text-red-400 hover:text-red-300">
        Confirm
      </button>
      <span className="text-slate-600" aria-hidden="true">|</span>
      <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-200">
        Cancel
      </button>
    </span>
  );
}
