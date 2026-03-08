"use client";

/**
 * AccountDialog — wraps AccountForm in a Dialog.
 *
 * Usage:
 *   // Create mode
 *   <AccountDialog agencies={agencies} trigger={<Button>New Account</Button>} />
 *
 *   // Edit mode
 *   <AccountDialog account={editData} agencies={agencies} trigger={<button>Edit</button>} />
 *
 * After a successful save the page is refreshed via router.refresh().
 */

import { useState }  from "react";
import { useRouter } from "next/navigation";

import { Dialog }       from "@/components/ui/dialog";
import { AccountForm }  from "./account-form";
import type { AccountEditData, AgencyOption } from "@/features/ad-accounts/queries";

interface AccountDialogProps {
  account?:  AccountEditData;
  agencies:  AgencyOption[];
  trigger:   React.ReactNode;
}

export function AccountDialog({ account, agencies, trigger }: AccountDialogProps) {
  const [open, setOpen] = useState(false);
  const router          = useRouter();

  const isEdit = !!account;

  function handleSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <div onClick={() => setOpen(true)} className="inline-flex cursor-pointer">
        {trigger}
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? "Edit Account" : "New Account"}
        description={
          isEdit
            ? `Editing "${account.name}"`
            : "Add a new advertising account"
        }
        className="w-full max-w-xl"
      >
        <AccountForm
          account={account}
          agencies={agencies}
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
