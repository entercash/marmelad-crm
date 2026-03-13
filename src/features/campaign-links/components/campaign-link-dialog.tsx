"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Dialog } from "@/components/ui/dialog";
import { CampaignLinkForm } from "./campaign-link-form";
import type { TaboolaCampaignOption, KeitaroCampaignOption, AdspectStreamOption } from "../queries";
import type { CountryOption } from "@/features/publishers/queries";

interface Props {
  taboolaCampaigns: TaboolaCampaignOption[];
  keitaroCampaigns: KeitaroCampaignOption[];
  countries: CountryOption[];
  adspectStreams: AdspectStreamOption[];
  trigger: React.ReactNode;
}

export function CampaignLinkDialog({
  taboolaCampaigns,
  keitaroCampaigns,
  countries,
  adspectStreams,
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
          countries={countries}
          adspectStreams={adspectStreams}
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      </Dialog>
    </>
  );
}
