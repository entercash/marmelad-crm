/**
 * Telegram Lead Notifications
 *
 * After each Keitaro sync, fetches individual conversions from Keitaro API,
 * compares against the last processed click_datetime (stored in Redis),
 * and sends one Telegram message per new lead.
 *
 * Watermark strategy: uses click_datetime string ("YYYY-MM-DD HH:mm:ss")
 * because Keitaro conversion_id is a UUID (not sortable numerically).
 */

import { createKeitaroClient } from "@/integrations/keitaro";
import type { KeitaroConfig, KeitaroConversion } from "@/integrations/keitaro";
import { sendTelegramMessage } from "@/lib/telegram";
import { getTelegramSettings } from "@/features/integration-settings/queries";
import { getKeitaroSettings } from "@/features/integration-settings/queries";
import { prisma } from "@/lib/prisma";
import { todayCrm, daysAgoCrm } from "@/lib/date";

const REDIS_KEY = "telegram:lastConversionDatetime";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getRedis() {
  const { redis } = await import("@/lib/redis");
  return redis;
}

async function getLastDatetime(): Promise<string | null> {
  try {
    const redis = await getRedis();
    return await redis.get(REDIS_KEY);
  } catch {
    return null;
  }
}

async function setLastDatetime(dt: string): Promise<void> {
  try {
    const redis = await getRedis();
    await redis.set(REDIS_KEY, dt);
  } catch (err) {
    console.error("[telegram-leads] Failed to save lastDatetime:", err);
  }
}

/** Resolve campaign name from CampaignLink by Keitaro campaign external ID. */
async function resolveCampaignName(keitaroCampaignId: number): Promise<string | null> {
  const kc = await prisma.keitaroCampaign.findFirst({
    where: { externalId: keitaroCampaignId },
    select: {
      name: true,
      campaignLinks: {
        select: { taboolaCampaignName: true, country: true },
        take: 1,
      },
    },
  });
  if (!kc) return null;

  const link = kc.campaignLinks[0];
  if (link) {
    const geo = link.country ? ` — ${link.country}` : "";
    return `${link.taboolaCampaignName}${geo}`;
  }
  return kc.name;
}

/** Resolve site name from Publishers table by slug (sub_id_3). */
async function resolveSiteName(siteSlug: string): Promise<{ name: string; numericId: number | null } | null> {
  if (!siteSlug) return null;
  const pub = await prisma.publisher.findFirst({
    where: { externalId: siteSlug },
    select: { name: true, numericId: true },
  });
  if (!pub) return { name: siteSlug, numericId: null };
  return { name: pub.name || siteSlug, numericId: pub.numericId };
}

function formatTime(datetime: string): string {
  try {
    const d = new Date(datetime);
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return datetime;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

export async function notifyNewLeads(): Promise<number> {
  // 1. Check Telegram is configured
  const tgSettings = await getTelegramSettings();
  if (!tgSettings.botToken || !tgSettings.chatId) {
    console.log("[telegram-leads] Skipping — Telegram not configured");
    return 0;
  }

  // 2. Check Keitaro is configured
  const kSettings = await getKeitaroSettings();
  if (!kSettings.apiUrl || !kSettings.apiKey) {
    console.log("[telegram-leads] Skipping — Keitaro not configured");
    return 0;
  }

  // 3. Fetch recent conversions from Keitaro
  const config: KeitaroConfig = {
    apiUrl: kSettings.apiUrl.replace(/\/$/, ""),
    apiKey: kSettings.apiKey,
  };
  const client = createKeitaroClient(config);

  let conversions: KeitaroConversion[];
  try {
    conversions = await client.getConversions({
      dateFrom: daysAgoCrm(1),
      dateTo: todayCrm(),
      limit: 100,
    });
  } catch (err) {
    console.error("[telegram-leads] Failed to fetch conversions:", err);
    return 0;
  }

  console.log(`[telegram-leads] Fetched ${conversions.length} conversions from Keitaro`);
  if (conversions.length === 0) return 0;

  // 4. Filter new conversions (click_datetime > last watermark)
  const lastDt = await getLastDatetime();

  // Sort by click_datetime ascending (oldest first)
  const sorted = [...conversions].sort((a, b) =>
    a.click_datetime.localeCompare(b.click_datetime),
  );

  const newConversions = lastDt
    ? sorted.filter((c) => c.click_datetime > lastDt)
    : sorted;

  if (newConversions.length === 0) return 0;

  // On first run (no watermark), set watermark to latest without spamming
  if (!lastDt) {
    const maxDt = sorted[sorted.length - 1].click_datetime;
    await setLastDatetime(maxDt);
    console.log(`[telegram-leads] First run — set watermark to ${maxDt}, skipping ${conversions.length} existing conversions`);
    return 0;
  }

  console.log(`[telegram-leads] Found ${newConversions.length} new conversions (after ${lastDt})`);

  // 5. Send one message per lead
  let sent = 0;
  let maxDt = lastDt;

  for (const conv of newConversions) {
    const campaignName = await resolveCampaignName(conv.campaign_id);
    const siteSlug = conv.sub_id_3 || "";
    const site = await resolveSiteName(siteSlug);
    const geo = conv.sub_id_6 || conv.country || "";
    const time = formatTime(conv.click_datetime);

    const siteDisplay = site
      ? site.numericId
        ? `${site.name} (#${site.numericId})`
        : site.name
      : siteSlug || "Unknown";

    const lines = [
      "🟢 <b>New Lead</b>",
      `Campaign: ${campaignName || `#${conv.campaign_id}`}`,
      `Site: ${siteDisplay}`,
      geo ? `GEO: ${geo}` : null,
      `Time: ${time}`,
    ].filter(Boolean);

    const result = await sendTelegramMessage({
      botToken: tgSettings.botToken,
      chatId: tgSettings.chatId,
      topicId: tgSettings.leadsTopicId,
      text: lines.join("\n"),
    });

    if (result.ok) {
      sent++;
      if (conv.click_datetime > maxDt) {
        maxDt = conv.click_datetime;
      }
    } else {
      console.error(`[telegram-leads] Failed to send for conversion ${conv.conversion_id}: ${result.error}`);
      // Stop on first failure to avoid spamming broken config
      break;
    }

    // Small delay to avoid Telegram rate limits (30 msg/sec for bots)
    if (newConversions.length > 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  // 6. Update watermark
  if (maxDt > lastDt) {
    await setLastDatetime(maxDt);
  }

  console.log(`[telegram-leads] Sent ${sent}/${newConversions.length} notifications`);
  return sent;
}
