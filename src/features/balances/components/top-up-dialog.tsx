"use client";

/**
 * TopUpDialog — wraps TopUpForm in the shared Dialog component.
 *
 * Used for both create (no `topUp` prop) and edit (with `topUp` prop).
 */

import { useState }  from "react";
import { useRouter } from "next/navigation";

import { Dialog }    from "@/components/ui/dialog";
import { TopUpForm } from "./top-up-form";
import type { TopUpEditData, AccountOption } from "@/features/balances/queries";

// ─── Props ────────────────────────────────────────────────────────────────────

interface TopUpDialogProps {
  topUp?:   TopUpEditData;
  accounts: AccountOption[];
  trigger:  React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TopUpDialog({ topUp, accounts, trigger }: TopUpDialogProps) {
  const [open, setOpen] = useState(false);
  const router          = useRouter();

  const isEdit = !!topUp;

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
        title={isEdit ? "Edit Top-Up" : "New Top-Up"}
        description={
          isEdit
            ? "Update the details for this top-up."
            : "Record a deposit to an ad account."
        }
        className="w-full max-w-md"
      >
        <TopUpForm
          topUp={topUp}
          accounts={accounts}
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
