export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/shared/page-header";
import { getKeitaroCampaignOptions } from "@/features/campaign-links/queries";
import { getKeitaroSettings } from "@/features/integration-settings/queries";
import { UtmBuilderForm } from "@/features/utm-builder/components/utm-builder-form";

export const metadata = { title: "UTM Builder" };

export default async function UtmBuilderPage() {
  const [campaigns, keitaroSettings] = await Promise.all([
    getKeitaroCampaignOptions(),
    getKeitaroSettings(),
  ]);

  // Extract domain from Keitaro API URL (strip protocol + trailing slashes)
  const trackerDomain = keitaroSettings.apiUrl
    ? keitaroSettings.apiUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "")
    : "";

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="UTM Builder"
        description="Generate Taboola → Keitaro tracking URLs with macro mapping"
      />
      <UtmBuilderForm campaigns={campaigns} trackerDomain={trackerDomain} />
    </div>
  );
}
