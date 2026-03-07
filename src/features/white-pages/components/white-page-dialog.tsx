"use client";

/**
 * WhitePageDialog — wraps WhitePageForm in the shared Dialog component.
 *
 * Used for both create (no `whitePage` prop) and edit (with `whitePage` prop).
 * On success: closes the dialog and calls router.refresh() to re-render the
 * server-side table with the latest data.
 */

import { useState }  from "react";
import { useRouter } from "next/navigation";

import { Dialog }        from "@/components/ui/dialog";
import { WhitePageForm } from "./white-page-form";
import type { WhitePageEditData } from "@/features/white-pages/queries";

// ─── Props ────────────────────────────────────────────────────────────────────

interface WhitePageDialogProps {
  /** Provide to open the dialog in edit mode with pre-filled values. */
  whitePage?: WhitePageEditData;
  /** The element that opens the dialog when clicked. */
  trigger: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WhitePageDialog({ whitePage, trigger }: WhitePageDialogProps) {
  const [open, setOpen] = useState(false);
  const router          = useRouter();

  const isEdit = !!whitePage;

  function handleSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {/* Clicking the trigger element opens the dialog */}
      <div onClick={() => setOpen(true)} className="contents">
        {trigger}
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? "Edit White Page" : "New White Page"}
        description={
          isEdit
            ? "Update the details for this white page."
            : "Add a new white page to track its lifecycle and credentials."
        }
        className="w-full max-w-xl"
      >
        <WhitePageForm
          whitePage={whitePage}
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
