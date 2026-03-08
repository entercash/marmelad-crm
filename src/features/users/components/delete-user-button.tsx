"use client";

/**
 * DeleteUserButton — inline delete with two-step confirmation.
 *
 * Safety: prevents deleting yourself (server-side check too).
 */

import { useState }  from "react";
import { useRouter } from "next/navigation";
import { Trash2 }    from "lucide-react";

import { deleteUser } from "@/features/users/actions";

// ─── Types ─────────────────────────────────────────────────────────────────

type Step = "idle" | "confirm" | "deleting";

interface DeleteUserButtonProps {
  id:          string;
  isSelf:      boolean;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function DeleteUserButton({ id, isSelf }: DeleteUserButtonProps) {
  const [step,  setStep]  = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const router            = useRouter();

  async function handleDelete() {
    setStep("deleting");
    setError(null);

    const result = await deleteUser(id);

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

  // Can't delete yourself
  if (isSelf) {
    return (
      <span
        className="cursor-not-allowed rounded p-1 text-slate-300"
        title="You cannot delete your own account"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </span>
    );
  }

  // ── idle ──
  if (step === "idle") {
    return (
      <button
        onClick={() => setStep("confirm")}
        className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
        title="Delete user"
        aria-label="Delete user"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    );
  }

  // ── deleting ──
  if (step === "deleting") {
    return <span className="text-xs text-slate-400">Deleting…</span>;
  }

  // ── confirm ──
  return (
    <span className="flex flex-col items-end gap-1">
      <span className="max-w-[240px] text-right text-xs font-medium text-slate-700">
        Delete this user?
      </span>
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
          Confirm
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
