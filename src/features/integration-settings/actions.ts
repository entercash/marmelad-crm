"use server";

import { revalidatePath } from "next/cache";

import { guardAdmin }      from "@/lib/auth-guard";
import type { ActionResult } from "@/lib/auth-guard";
import { KeitaroClient }   from "@/integrations/keitaro/client";
import type { KeitaroConfig } from "@/integrations/keitaro/client";
import { setSetting, getKeitaroSettings } from "./queries";

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
