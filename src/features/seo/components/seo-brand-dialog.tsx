"use client";

import { useState }  from "react";
import { useRouter } from "next/navigation";

import { Dialog }        from "@/components/ui/dialog";
import { SeoBrandForm }  from "./seo-brand-form";

interface Props {
  trigger: React.ReactNode;
}

export function SeoBrandDialog({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

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
        title="New SEO Brand"
        description="Add a new brand to track SEO leads."
        className="w-full max-w-md"
      >
        <SeoBrandForm onSuccess={handleSuccess} onCancel={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
