/**
 * Telegram Lead Notifications
 *
 * After each Keitaro sync, fetches individual conversions from Keitaro API,
 * compares against the last processed conversion ID (stored in Redis),
 * and sends one Telegram message per new lead.
 */

import { createKeitaroClient } from "@/integrations/keitaro";
import type { KeitaroConfig, KeitaroConversion } from "@/integrations/keitaro";
import { sendTelegramMessage } from "@/lib/telegram";
import { getTelegramSettings } from "@/features/integration-settings/queries";
import { getKeitaroSettings } from "@/features/integration-settings/queries";
import { prisma } from "@/lib/prisma";
import { todayCrm, daysAgoCrm } from "@/lib/date";

const REDIS_KEY = "telegram:lastConversionId";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getRedis() {
  const { redis } = await import("@/lib/redis");
  return redis;
}

async function getLastConversionId(): Promise<number> {
  try {
    const redis = await getRedis();
    const val = await redis.get(REDIS_KEY);
    return val ? Number(val) : 0;
  } catch {
    return 0;
  }
}

async function setLastConversionId(id: number): Promise<void> {
  try {
    const redis = await getRedis();
    await redis.set(REDIS_KEY, String(id));
  } catch (err) {
    console.error("[telegram-leads] Failed to save lastConversionId:", err);
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

  // 4. Filter new conversions (id > lastConversionId)
  const lastId = await getLastConversionId();
  const newConversions = conversions
    .filter((c) => c.conversion_id > lastId)
    .sort((a, b) => a.conversion_id - b.conversion_id); // oldest first for sending

  if (newConversions.length === 0) return 0;

  // On first run (lastId=0), set watermark to latest without spamming
  if (lastId === 0) {
    const maxId = Math.max(...conversions.map((c) => c.conversion_id));
    await setLastConversionId(maxId);
    console.log(`[telegram-leads] First run — set watermark to ${maxId}, skipping ${conversions.length} existing conversions`);
    return 0;
  }

  console.log(`[telegram-leads] Found ${newConversions.length} new conversions (after id=${lastId})`);

  // 5. Send one message per lead
  let sent = 0;
  let maxSentId = lastId;

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
      maxSentId = Math.max(maxSentId, conv.conversion_id);
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
  if (maxSentId > lastId) {
    await setLastConversionId(maxSentId);
  }

  console.log(`[telegram-leads] Sent ${sent}/${newConversions.length} notifications`);
  return sent;
}
