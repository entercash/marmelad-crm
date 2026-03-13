"use client";

import { useState }  from "react";
import { useRouter } from "next/navigation";

import { Dialog }      from "@/components/ui/dialog";
import { SeoLeadForm } from "./seo-lead-form";

interface Props {
  brandId: string;
  trigger: React.ReactNode;
}

export function SeoLeadDialog({ brandId, trigger }: Props) {
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
        title="Add Leads"
        description="Enter lead data for this brand."
        className="w-full max-w-md"
      >
        <SeoLeadForm
          brandId={brandId}
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
