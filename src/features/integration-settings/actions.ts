"use server";

import { revalidatePath } from "next/cache";

import { guardAdmin }      from "@/lib/auth-guard";
import type { ActionResult } from "@/lib/auth-guard";
import { KeitaroClient }   from "@/integrations/keitaro/client";
import type { KeitaroConfig } from "@/integrations/keitaro/client";
import { TaboolaClient }   from "@/integrations/taboola/client";
import type { TaboolaConfig } from "@/integrations/taboola/client";
import { AdspectClient }   from "@/integrations/adspect/client";
import { prisma }          from "@/lib/prisma";
import crypto from "crypto";
import { setSetting, getKeitaroSettings, getKeitaroInstanceSettings, getTaboolaAccountSettings, getAdspectSettings, getTelegramSettings, getGoogleSettings, upsertPostbackToken } from "./queries";
import { sendTelegramMessage } from "@/lib/telegram";

// ─── Save Keitaro Settings ──────────────────────────────────────────────────

export async function saveKeitaroSettings(
  formData: FormData,
): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const apiUrl = (formData.get("apiUrl") as string)?.trim();
  const apiKey = (formData.get("apiKey") as string)?.trim();

  if (!apiUrl) {
    return { success: false, error: "API URL is required" };
  }
  if (!apiKey) {
    return { success: false, error: "API Key is required" };
  }

  // Basic URL validation
  try {
    new URL(apiUrl);
  } catch {
    return { success: false, error: "Invalid URL format" };
  }

  // Strip trailing slash
  const cleanUrl = apiUrl.replace(/\/+$/, "");

  await setSetting("keitaro.apiUrl", cleanUrl);
  await setSetting("keitaro.apiKey", apiKey);

  revalidatePath("/settings");
  revalidatePath("/integrations/keitaro");

  return { success: true };
}

// ─── Test Keitaro Connection ────────────────────────────────────────────────

export type TestConnectionResult =
  | { success: true; campaignCount: number }
  | { success: false; error: string };

export async function testKeitaroConnection(): Promise<TestConnectionResult> {
  const denied = await guardAdmin();
  if (denied) return { success: false, error: "Admin access required" };

  const settings = await getKeitaroSettings();

  if (!settings.apiUrl || !settings.apiKey) {
    return { success: false, error: "Keitaro is not configured. Save API URL and Key first." };
  }

  const config: KeitaroConfig = {
    apiUrl: settings.apiUrl,
    apiKey: settings.apiKey,
  };

  try {
    const client = new KeitaroClient(config);
    const campaigns = await client.getCampaigns();
    return { success: true, campaignCount: campaigns.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

// ─── Keitaro Instance CRUD ───────────────────────────────────────────────────

export async function saveKeitaroInstance(
  formData: FormData,
): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const instanceId = (formData.get("instanceId") as string)?.trim() || crypto.randomUUID().slice(0, 8);
  const name = (formData.get("name") as string)?.trim();
  const apiUrl = (formData.get("apiUrl") as string)?.trim();
  const apiKey = (formData.get("apiKey") as string)?.trim();

  if (!name) return { success: false, error: "Name is required" };
  if (!apiUrl) return { success: false, error: "API URL is required" };
  if (!apiKey) return { success: false, error: "API Key is required" };

  try {
    new URL(apiUrl);
  } catch {
    return { success: false, error: "Invalid URL format" };
  }

  const cleanUrl = apiUrl.replace(/\/+$/, "");

  if (instanceId === "default") {
    // Legacy instance uses 2-segment keys
    await setSetting("keitaro.apiUrl", cleanUrl);
    await setSetting("keitaro.apiKey", apiKey);
  } else {
    // "env" instance → migrate to new format with a real ID
    const realId = instanceId === "env" ? crypto.randomUUID().slice(0, 8) : instanceId;
    const prefix = `keitaro.${realId}`;
    await setSetting(`${prefix}.name`, name);
    await setSetting(`${prefix}.apiUrl`, cleanUrl);
    await setSetting(`${prefix}.apiKey`, apiKey);
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function testKeitaroInstance(
  instanceId: string,
): Promise<TestConnectionResult> {
  const denied = await guardAdmin();
  if (denied) return { success: false, error: "Admin access required" };

  const settings = await getKeitaroInstanceSettings(instanceId);

  if (!settings.apiUrl || !settings.apiKey) {
    return { success: false, error: "Keitaro instance is not configured. Save settings first." };
  }

  const config: KeitaroConfig = {
    apiUrl: settings.apiUrl,
    apiKey: settings.apiKey,
  };

  try {
    const client = new KeitaroClient(config);
    const campaigns = await client.getCampaigns();
    return { success: true, campaignCount: campaigns.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

export async function deleteKeitaroInstance(
  instanceId: string,
): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  if (instanceId === "default") {
    // Legacy instance: delete 2-segment keys
    await prisma.integrationSetting.deleteMany({
      where: { key: { in: ["keitaro.apiUrl", "keitaro.apiKey"] } },
    });
  } else {
    const prefix = `keitaro.${instanceId}.`;
    await prisma.integrationSetting.deleteMany({
      where: { key: { startsWith: prefix } },
    });
  }

  revalidatePath("/settings");
  return { success: true };
}

// ─── Save Taboola Account Settings ──────────────────────────────────────────

export async function saveTaboolaAccountSettings(
  formData: FormData,
): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const accountId = (formData.get("accountId") as string)?.trim();
  const taboolaAccountId = (formData.get("taboolaAccountId") as string)?.trim();
  const clientId = (formData.get("clientId") as string)?.trim();
  const clientSecret = (formData.get("clientSecret") as string)?.trim();
  const proxyUrl = (formData.get("proxyUrl") as string)?.trim() || "";

  if (!accountId) return { success: false, error: "Account is required" };
  if (!taboolaAccountId) return { success: false, error: "Taboola Account ID is required" };
  if (!clientId) return { success: false, error: "Client ID is required" };
  if (!clientSecret) return { success: false, error: "Client Secret is required" };

  // Validate proxy URL if provided
  if (proxyUrl) {
    try {
      new URL(proxyUrl);
    } catch {
      return { success: false, error: "Invalid proxy URL format" };
    }
  }

  const prefix = `taboola.${accountId}`;
  await setSetting(`${prefix}.taboolaAccountId`, taboolaAccountId);
  await setSetting(`${prefix}.clientId`, clientId);
  await setSetting(`${prefix}.clientSecret`, clientSecret);
  await setSetting(`${prefix}.proxyUrl`, proxyUrl);

  revalidatePath("/settings");
  return { success: true };
}

// ─── Test Taboola Account Connection ────────────────────────────────────────

export async function testTaboolaAccountConnection(
  accountId: string,
): Promise<TestConnectionResult> {
  const denied = await guardAdmin();
  if (denied) return { success: false, error: "Admin access required" };

  const settings = await getTaboolaAccountSettings(accountId);

  if (!settings.taboolaAccountId || !settings.clientId || !settings.clientSecret) {
    return { success: false, error: "Taboola is not configured for this account. Save credentials first." };
  }

  const config: TaboolaConfig = {
    clientId: settings.clientId,
    clientSecret: settings.clientSecret,
    accountId: settings.taboolaAccountId,
    proxyUrl: settings.proxyUrl ?? undefined,
  };

  try {
    const client = new TaboolaClient(config);
    const result = await client.getCampaigns();
    return { success: true, campaignCount: result.results?.length ?? 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

// ─── Disconnect Taboola Account ─────────────────────────────────────────────

export async function disconnectTaboolaAccount(
  accountId: string,
): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const prefix = `taboola.${accountId}.`;
  await prisma.integrationSetting.deleteMany({
    where: { key: { startsWith: prefix } },
  });

  revalidatePath("/settings");
  return { success: true };
}

// ─── Save Adspect Settings ──────────────────────────────────────────────────

export async function saveAdspectSettings(
  formData: FormData,
): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const apiKey = (formData.get("apiKey") as string)?.trim();

  if (!apiKey) {
    return { success: false, error: "API Key is required" };
  }

  await setSetting("adspect.apiKey", apiKey);

  revalidatePath("/settings");
  return { success: true };
}

// ─── Test Adspect Connection ────────────────────────────────────────────────

export async function testAdspectConnection(): Promise<TestConnectionResult> {
  const denied = await guardAdmin();
  if (denied) return { success: false, error: "Admin access required" };

  const settings = await getAdspectSettings();

  if (!settings.apiKey) {
    return { success: false, error: "Adspect is not configured. Save API Key first." };
  }

  try {
    const client = new AdspectClient({ apiKey: settings.apiKey });
    const streams = await client.getStreams();
    return { success: true, campaignCount: streams.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

// ─── Disconnect Adspect ─────────────────────────────────────────────────────

export async function disconnectAdspect(): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  await prisma.integrationSetting.deleteMany({
    where: { key: { startsWith: "adspect." } },
  });

  revalidatePath("/settings");
  return { success: true };
}

// ─── Save Telegram Settings ────────────────────────────────────────────────

export async function saveTelegramSettings(
  formData: FormData,
): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const botToken = (formData.get("botToken") as string)?.trim();
  const chatId = (formData.get("chatId") as string)?.trim();
  const leadsTopicId = (formData.get("leadsTopicId") as string)?.trim() || "";
  const alertsTopicId = (formData.get("alertsTopicId") as string)?.trim() || "";

  if (!botToken) return { success: false, error: "Bot Token is required" };
  if (!chatId) return { success: false, error: "Chat ID is required" };

  await setSetting("telegram.botToken", botToken);
  await setSetting("telegram.chatId", chatId);

  // Save or clear topic IDs per category
  for (const [key, val] of [
    ["telegram.topicId.leads", leadsTopicId],
    ["telegram.topicId.alerts", alertsTopicId],
  ] as const) {
    if (val) {
      await setSetting(key, val);
    } else {
      await prisma.integrationSetting.deleteMany({ where: { key } });
    }
  }

  // Remove legacy single topicId if it exists
  await prisma.integrationSetting.deleteMany({ where: { key: "telegram.topicId" } });

  revalidatePath("/settings");
  return { success: true };
}

// ─── Test Telegram Connection ──────────────────────────────────────────────

export async function testTelegramConnection(): Promise<TestConnectionResult> {
  const denied = await guardAdmin();
  if (denied) return { success: false, error: "Admin access required" };

  const settings = await getTelegramSettings();
  if (!settings.botToken || !settings.chatId) {
    return { success: false, error: "Telegram is not configured. Save Bot Token and Chat ID first." };
  }

  // Send test to each configured topic
  const topics = [
    { label: "Leads", topicId: settings.leadsTopicId },
    { label: "Alerts", topicId: settings.alertsTopicId },
  ].filter((t) => t.topicId);

  // If no topics configured, send to general chat
  if (topics.length === 0) {
    topics.push({ label: "General", topicId: null });
  }

  for (const t of topics) {
    const result = await sendTelegramMessage({
      botToken: settings.botToken,
      chatId: settings.chatId,
      topicId: t.topicId,
      text: `✅ Marmelad CRM — ${t.label} topic test successful!`,
    });
    if (!result.ok) {
      return { success: false, error: `${t.label}: ${result.error ?? "Failed to send message"}` };
    }
  }

  return { success: true, campaignCount: topics.length };
}

// ─── Save Google Settings ──────────────────────────────────────────────────

export async function saveGoogleSettings(
  formData: FormData,
): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const safeBrowsingApiKey = (formData.get("safeBrowsingApiKey") as string)?.trim();

  if (!safeBrowsingApiKey) {
    return { success: false, error: "API Key is required" };
  }

  await setSetting("google.safeBrowsingApiKey", safeBrowsingApiKey);

  revalidatePath("/settings");
  return { success: true };
}

// ─── Disconnect Google ─────────────────────────────────────────────────────

export async function disconnectGoogle(): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  await prisma.integrationSetting.deleteMany({
    where: { key: { startsWith: "google." } },
  });

  revalidatePath("/settings");
  return { success: true };
}

// ─── Disconnect Telegram ───────────────────────────────────────────────────

export async function disconnectTelegram(): Promise<ActionResult> {
  const denied = await guardAdmin();
  if (denied) return denied;

  await prisma.integrationSetting.deleteMany({
    where: { key: { startsWith: "telegram." } },
  });

  revalidatePath("/settings");
  return { success: true };
}

// ─── Regenerate Keitaro Postback Token ──────────────────────────────────────

export async function regeneratePostbackToken(): Promise<ActionResult & { token?: string }> {
  const denied = await guardAdmin();
  if (denied) return denied;

  const token = await upsertPostbackToken();
  revalidatePath("/settings");
  return { success: true, token };
}
