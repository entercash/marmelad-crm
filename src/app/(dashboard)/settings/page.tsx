export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/shared/page-header";
import { KeitaroSettingsForm } from "@/features/integration-settings/components/keitaro-settings-form";
import { getKeitaroSettings } from "@/features/integration-settings/queries";

export const metadata = { title: "Settings" };

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function SettingsPage() {
  const keitaro = await getKeitaroSettings();

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Settings"
        description="Configure integrations, sync schedules, and system preferences"
      />

      {/* Keitaro API Settings */}
      <section className="glass p-5">
        <h3 className="mb-4 text-sm font-semibold text-white">
          Keitaro API
        </h3>
        <KeitaroSettingsForm
          initialApiUrl={keitaro.apiUrl ?? ""}
          initialApiKey={keitaro.apiKey ?? ""}
        />
      </section>
    </div>
  );
}
