"use client";

/**
 * UserDialog — wraps UserForm in the shared Dialog component.
 *
 * Used for both create (no `user` prop) and edit (with `user` prop).
 */

import { useState }  from "react";
import { useRouter } from "next/navigation";

import { Dialog }   from "@/components/ui/dialog";
import { UserForm } from "./user-form";
import type { UserEditData } from "@/features/users/queries";

// ─── Props ─────────────────────────────────────────────────────────────────

interface UserDialogProps {
  user?:   UserEditData;
  trigger: React.ReactNode;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function UserDialog({ user, trigger }: UserDialogProps) {
  const [open, setOpen] = useState(false);
  const router          = useRouter();

  const isEdit = !!user;

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
        title={isEdit ? "Edit User" : "New User"}
        description={
          isEdit
            ? "Update user details. Leave password blank to keep current."
            : "Create a new CRM user account."
        }
        className="w-full max-w-md"
      >
        <UserForm
          user={user}
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
