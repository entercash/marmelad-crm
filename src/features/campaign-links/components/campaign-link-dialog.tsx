"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Dialog } from "@/components/ui/dialog";
import { CampaignLinkForm } from "./campaign-link-form";
import type { TaboolaCampaignOption, KeitaroCampaignOption } from "../queries";

interface Props {
  taboolaCampaigns: TaboolaCampaignOption[];
  keitaroCampaigns: KeitaroCampaignOption[];
  trigger: React.ReactNode;
}

export function CampaignLinkDialog({
  taboolaCampaigns,
  keitaroCampaigns,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleSuccess() {
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">
        {trigger}
      </span>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add Campaign Mapping"
        description="Map a Taboola campaign to a Keitaro campaign"
      >
        <CampaignLinkForm
          taboolaCampaigns={taboolaCampaigns}
          keitaroCampaigns={keitaroCampaigns}
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
