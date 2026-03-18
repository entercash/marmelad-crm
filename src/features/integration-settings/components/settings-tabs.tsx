"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { TaboolaConnectionsList } from "./taboola-connections-list";
import type { TaboolaAccountOption } from "./taboola-connections-list";
import { KeitaroConnectionsList } from "./keitaro-connections-list";
import type { KeitaroInstanceOption } from "./keitaro-connections-list";
import { AdspectConnection } from "./adspect-connection";
import type { AdspectConnectionProps } from "./adspect-connection";
import { TelegramConnection } from "./telegram-connection";
import type { TelegramConnectionProps } from "./telegram-connection";
import { GoogleConnection } from "./google-connection";
import type { GoogleConnectionProps } from "./google-connection";

// ─── Props ──────────────────────────────────────────────────────────────────

interface SettingsTabsProps {
  taboolaAccounts: TaboolaAccountOption[];
  keitaroInstances: KeitaroInstanceOption[];
  adspect: AdspectConnectionProps;
  telegram: TelegramConnectionProps;
  google: GoogleConnectionProps;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SettingsTabs({ taboolaAccounts, keitaroInstances, adspect, telegram, google }: SettingsTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "taboola";

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.push(`/settings?${params.toString()}`);
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="taboola">Taboola</TabsTrigger>
        <TabsTrigger value="keitaro">Keitaro</TabsTrigger>
        <TabsTrigger value="adspect">Adspect</TabsTrigger>
        <TabsTrigger value="telegram">Telegram</TabsTrigger>
        <TabsTrigger value="google">Google</TabsTrigger>
      </TabsList>

      <TabsContent value="taboola">
        <TaboolaConnectionsList accounts={taboolaAccounts} />
      </TabsContent>

      <TabsContent value="keitaro">
        <KeitaroConnectionsList instances={keitaroInstances} />
      </TabsContent>

      <TabsContent value="adspect">
        <AdspectConnection {...adspect} />
      </TabsContent>

      <TabsContent value="telegram">
        <TelegramConnection {...telegram} />
      </TabsContent>

      <TabsContent value="google">
        <GoogleConnection {...google} />
      </TabsContent>
    </Tabs>
  );
}
