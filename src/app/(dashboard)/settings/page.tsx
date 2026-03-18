export const dynamic = "force-dynamic";

import { PageHeader } from "@/components/shared/page-header";
import { SettingsTabs } from "@/features/integration-settings/components/settings-tabs";
import type { TaboolaAccountOption } from "@/features/integration-settings/components/taboola-connections-list";
import type { KeitaroInstanceOption } from "@/features/integration-settings/components/keitaro-connections-list";
import {
  getTaboolaAccountSettings,
  getTaboolaConnectedAccountIds,
  getKeitaroInstances,
  getAdspectSettings,
  getTelegramSettings,
} from "@/features/integration-settings/queries";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Settings" };

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function SettingsPage() {
  const [taboolaAccounts, connectedIds, keitaroInstances, adspectSettings, telegramSettings] = await Promise.all([
    prisma.account.findMany({
      where: { platform: "TABOOLA" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, externalId: true },
    }),
    getTaboolaConnectedAccountIds(),
    getKeitaroInstances(),
    getAdspectSettings(),
    getTelegramSettings(),
  ]);

  // Pre-fetch Taboola settings for connected accounts
  const taboolaOptions: TaboolaAccountOption[] = await Promise.all(
    taboolaAccounts.map(async (a) => {
      const settings = connectedIds.has(a.id)
        ? await getTaboolaAccountSettings(a.id)
        : null;
      return {
        id: a.id,
        name: a.name,
        externalId: a.externalId,
        connected: connectedIds.has(a.id),
        taboolaAccountId: settings?.taboolaAccountId ?? "",
        clientId: settings?.clientId ?? "",
        clientSecret: settings?.clientSecret ?? "",
        proxyUrl: settings?.proxyUrl ?? "",
      };
    }),
  );

  const keitaroOptions: KeitaroInstanceOption[] = keitaroInstances.map((inst) => ({
    id: inst.id,
    name: inst.name,
    apiUrl: inst.apiUrl ?? "",
    apiKey: inst.apiKey ?? "",
    configured: !!(inst.apiUrl && inst.apiKey),
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Settings"
        description="Configure integrations, sync schedules, and system preferences"
      />

      <SettingsTabs
        taboolaAccounts={taboolaOptions}
        keitaroInstances={keitaroOptions}
        adspect={{
          apiKey: adspectSettings.apiKey ?? "",
          configured: !!adspectSettings.apiKey,
        }}
        telegram={{
          botToken: telegramSettings.botToken ?? "",
          chatId: telegramSettings.chatId ?? "",
          leadsTopicId: telegramSettings.leadsTopicId ?? "",
          alertsTopicId: telegramSettings.alertsTopicId ?? "",
          configured: !!(telegramSettings.botToken && telegramSettings.chatId),
        }}
      />
    </div>
  );
}
