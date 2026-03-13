export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/shared/page-header";
import { KeitaroSettingsForm } from "@/features/integration-settings/components/keitaro-settings-form";
import { TaboolaSettingsForm } from "@/features/integration-settings/components/taboola-settings-form";
import type { TaboolaAccountOption } from "@/features/integration-settings/components/taboola-settings-form";
import {
  getKeitaroSettings,
  getTaboolaAccountSettings,
  getTaboolaConnectedAccountIds,
} from "@/features/integration-settings/queries";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Settings" };

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function SettingsPage() {
  const [keitaro, taboolaAccounts, connectedIds] = await Promise.all([
    getKeitaroSettings(),
    prisma.account.findMany({
      where: { platform: "TABOOLA" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, externalId: true },
    }),
    getTaboolaConnectedAccountIds(),
  ]);

  // Pre-fetch settings for all Taboola accounts
  const accountOptions: TaboolaAccountOption[] = await Promise.all(
    taboolaAccounts.map(async (a) => {
      const settings = connectedIds.has(a.id)
        ? await getTaboolaAccountSettings(a.id)
        : null;
      return {
        id: a.id,
        name: a.name,
        externalId: a.externalId,
        connected: connectedIds.has(a.id),
        clientId: settings?.clientId ?? "",
        clientSecret: settings?.clientSecret ?? "",
        proxyUrl: settings?.proxyUrl ?? "",
      };
    }),
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Settings"
        description="Configure integrations, sync schedules, and system preferences"
      />

      {/* Taboola API Settings */}
      <section className="glass p-5">
        <h3 className="mb-4 text-sm font-semibold text-white">
          Taboola API
        </h3>
        <TaboolaSettingsForm accounts={accountOptions} />
      </section>

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
