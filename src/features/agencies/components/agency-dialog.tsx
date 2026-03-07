"use client";

/**
 * AgencyDialog — wraps AgencyForm in a Dialog.
 *
 * Usage:
 *   // Create mode
 *   <AgencyDialog trigger={<Button>New Agency</Button>} />
 *
 *   // Edit mode
 *   <AgencyDialog agency={editData} trigger={<button>Edit</button>} />
 *
 * After a successful save the page is refreshed via router.refresh(),
 * which re-executes the Server Component's data fetch without a full reload.
 */

import { useState }    from "react";
import { useRouter }   from "next/navigation";

import { Dialog }      from "@/components/ui/dialog";
import { AgencyForm }  from "./agency-form";
import type { AgencyEditData } from "@/features/agencies/queries";

interface AgencyDialogProps {
  /** Pass an existing agency to open in edit mode; omit for create mode. */
  agency?:  AgencyEditData;
  /** The element that triggers the dialog when clicked. */
  trigger:  React.ReactNode;
}

export function AgencyDialog({ agency, trigger }: AgencyDialogProps) {
  const [open, setOpen] = useState(false);
  const router          = useRouter();

  const isEdit = !!agency;

  function handleSuccess() {
    setOpen(false);
    router.refresh(); // re-run server component data fetch
  }

  return (
    <>
      {/* Trigger wrapper — clicking any child opens the dialog */}
      <div
        onClick={() => setOpen(true)}
        className="inline-flex cursor-pointer"
      >
        {trigger}
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={isEdit ? "Edit Agency" : "New Agency"}
        description={
          isEdit
            ? `Editing "${agency.name}"`
            : "Add a new agency and set its financial terms"
        }
      >
        <AgencyForm
          agency={agency}
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
