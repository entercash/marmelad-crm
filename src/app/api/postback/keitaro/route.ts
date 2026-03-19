/**
 * Keitaro Postback → Telegram Lead Notification (realtime).
 *
 * Keitaro sends a GET postback on each conversion.
 * We validate the token, resolve display names, and push to Telegram instantly.
 *
 * URL configured in Keitaro:
 *   https://marmelad-crm.com/api/postback/keitaro?token=SECRET
 *     &campaign_name={campaign_name}&site={site}&site_id={site_id}
 *     &geo={country}&revenue={revenue}&status={status}
 *     &click_id={click_id}&datetime={datetime}&sub1={sub_id_1}
 */

import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";
import { getTelegramSettings } from "@/features/integration-settings/queries";
import { getPostbackToken } from "@/features/integration-settings/queries";
import { prisma } from "@/lib/prisma";

// ─── Name resolution helpers ────────────────────────────────────────────────

/** Resolve campaign display name from CampaignLink by Taboola external ID. */
async function resolveCampaignName(taboolaExternalId: string | null): Promise<string | null> {
  if (!taboolaExternalId) return null;
  const link = await prisma.campaignLink.findFirst({
    where: { taboolaCampaignExternalId: taboolaExternalId },
    select: { taboolaCampaignName: true, country: true },
  });
  if (!link) return null;
  const geo = link.country ? ` — ${link.country}` : "";
  return `${link.taboolaCampaignName}${geo}`;
}

/** Resolve site display name from Publishers table by slug. */
async function resolveSiteName(siteSlug: string): Promise<string> {
  if (!siteSlug) return "Unknown";
  const pub = await prisma.publisher.findFirst({
    where: { externalId: siteSlug },
    select: { name: true, numericId: true },
  });
  if (!pub) return siteSlug;
  const name = pub.name || siteSlug;
  return pub.numericId ? `${name} (#${pub.numericId})` : name;
}

function formatTime(datetime: string): string {
  try {
    const d = new Date(datetime.replace(" ", "T"));
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

// ─── Route handler ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  // 1. Auth: validate token
  const token = params.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const expectedToken = await getPostbackToken();
  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // 2. Parse params
  const status = params.get("status") || "lead";
  const campaignName = params.get("campaign_name") || null;
  const site = params.get("site") || "";
  const geo = params.get("geo") || "";
  const revenue = params.get("revenue") || "";
  const datetime = params.get("datetime") || "";
  const sub1 = params.get("sub1") || null; // Taboola campaign external ID

  // 3. Only notify on leads (skip sale/rejected/etc)
  if (status !== "lead") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // 4. Check Telegram is configured
  const tg = await getTelegramSettings();
  if (!tg.botToken || !tg.chatId) {
    console.log("[postback:keitaro] Telegram not configured, skipping");
    return NextResponse.json({ ok: true, skipped: true });
  }

  // 5. Resolve display names
  const resolvedCampaign = await resolveCampaignName(sub1);
  const displayCampaign = resolvedCampaign || campaignName || "Unknown";
  const displaySite = await resolveSiteName(site);
  const displayTime = datetime ? formatTime(datetime) : "";

  // 6. Build and send Telegram message
  const lines = [
    "🟢 <b>New Lead</b>",
    `Campaign: ${displayCampaign}`,
    `Site: ${displaySite}`,
    geo ? `GEO: ${geo}` : null,
    displayTime ? `Time: ${displayTime}` : null,
    revenue && Number(revenue) > 0 ? `Revenue: $${revenue}` : null,
  ].filter(Boolean);

  const result = await sendTelegramMessage({
    botToken: tg.botToken,
    chatId: tg.chatId,
    topicId: tg.leadsTopicId,
    text: lines.join("\n"),
  });

  if (!result.ok) {
    console.error(`[postback:keitaro] Telegram send failed: ${result.error}`);
  }

  // Always return 200 to Keitaro (don't retry on TG failures)
  return NextResponse.json({ ok: true, sent: result.ok });
}
