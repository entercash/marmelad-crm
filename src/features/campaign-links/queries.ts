import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { KeitaroClient } from "@/integrations/keitaro/client";
import { getKeitaroSettings } from "@/features/integration-settings/queries";
import { CRM_TIMEZONE, todayCrm } from "@/lib/date";

// ─── Types ──────────────────────────────────────────────────────────────────

export type TaboolaCampaignOption = {
  campaignExternalId: string;
  campaignName: string;
};

export type KeitaroCampaignOption = {
  id: string;
  externalId: number;
  alias: string;
  name: string;
  state: string;
};

export type CampaignLinkRow = {
  id: string;
  taboolaCampaignExternalId: string;
  taboolaCampaignName: string;
  keitaroCampaignId: string;
  keitaroCampaignExternalId: number;
  keitaroCampaignName: string;
  paymentModel: string;
  cplRate: number | null;
  country: string | null;
  adspectStreamId: string | null;
  createdAt: Date;
};

export type AdspectStreamOption = {
  id: string;
  name: string;
};

export type CampaignStatsRow = {
  linkId: string;
  taboolaCampaignName: string;
  keitaroCampaignName: string;
  paymentModel: string;
  cplRate: number | null;
  country: string | null;
  // Taboola side
  clicks: number;
  spend: number;
  impressions: number;
  // Keitaro side
  leads: number | null;
  sales: number | null;
  keitaroRevenue: number | null;
  // Computed
  cpl: number | null;
  revenue: number | null;
  profit: number | null;
  roi: number | null;
};

// ─── Dropdown queries ───────────────────────────────────────────────────────

/** Get distinct Taboola campaigns from synced Campaign table (for mapping dropdown). */
export async function getDistinctTaboolaCampaigns(): Promise<TaboolaCampaignOption[]> {
  const taboola = await prisma.trafficSource.findUnique({
    where: { slug: "taboola" },
    select: { id: true },
  });
  if (!taboola) return [];

  const campaigns = await prisma.campaign.findMany({
    where: { trafficSourceId: taboola.id },
    select: { externalId: true, name: true },
    orderBy: { name: "asc" },
  });

  return campaigns.map((c) => ({
    campaignExternalId: c.externalId,
    campaignName: c.name,
  }));
}

/** Get Keitaro campaigns for mapping dropdown. */
export async function getKeitaroCampaignOptions(): Promise<KeitaroCampaignOption[]> {
  const campaigns = await prisma.keitaroCampaign.findMany({
    orderBy: [{ state: "asc" }, { name: "asc" }],
    select: { id: true, externalId: true, alias: true, name: true, state: true },
  });
  return campaigns;
}

// ─── Link queries ───────────────────────────────────────────────────────────

/** Get all campaign links with joined Keitaro campaign data. */
export async function getCampaignLinks(): Promise<CampaignLinkRow[]> {
  const links = await prisma.campaignLink.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      keitaroCampaign: { select: { externalId: true, name: true } },
    },
  });

  return links.map((l) => ({
    id: l.id,
    taboolaCampaignExternalId: l.taboolaCampaignExternalId,
    taboolaCampaignName: l.taboolaCampaignName,
    keitaroCampaignId: l.keitaroCampaignId,
    keitaroCampaignExternalId: l.keitaroCampaign.externalId,
    keitaroCampaignName: l.keitaroCampaign.name,
    paymentModel: l.paymentModel,
    cplRate: l.cplRate ? Number(l.cplRate) : null,
    country: l.country,
    adspectStreamId: l.adspectStreamId,
    createdAt: l.createdAt,
  }));
}

// ─── Stats aggregation ──────────────────────────────────────────────────────

/** Aggregate Taboola stats by campaign externalId from campaign_stats_daily. */
async function getTaboolaStatsByCampaign(
  externalIds: string[],
  dateFrom?: string,
  dateTo?: string,
): Promise<
  Map<string, { clicks: number; spend: number; impressions: number }>
> {
  if (externalIds.length === 0) return new Map();

  const dateClause = dateFrom && dateTo
    ? Prisma.sql`AND csd."date" >= ${dateFrom}::date AND csd."date" <= ${dateTo}::date`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    { externalId: string; clicks: bigint; spend: Prisma.Decimal; impressions: bigint }[]
  >`
    SELECT c."externalId",
           SUM(csd."clicks")::bigint as clicks,
           SUM(csd."spend") as spend,
           SUM(csd."impressions")::bigint as impressions
    FROM "campaign_stats_daily" csd
    JOIN "campaigns" c ON c."id" = csd."campaignId"
    WHERE c."externalId" IN (${Prisma.join(externalIds)})
    ${dateClause}
    GROUP BY c."externalId"
  `;

  const map = new Map<
    string,
    { clicks: number; spend: number; impressions: number }
  >();
  for (const r of rows) {
    map.set(r.externalId, {
      clicks: Number(r.clicks),
      spend: Number(r.spend),
      impressions: Number(r.impressions),
    });
  }
  return map;
}

/** Fetch Keitaro stats from Reports API for mapped campaigns. Returns null on error. */
type KeitaroStatsKey = string; // "keitaroCampaignId:taboolaExternalId" or "keitaroCampaignId"
type KeitaroStatsValue = { clicks: number; leads: number; sales: number; revenue: number };

/**
 * Fetch Keitaro stats grouped by campaign_id + sub_id_1.
 * sub_id_1 contains the Taboola campaign ID passed via tracking link parameters.
 *
 * Returns two maps:
 * - exact: keyed by "keitaroCampaignId:taboolaCampaignId" (when sub_id_1 matches)
 * - byCampaign: keyed by "keitaroCampaignId" (aggregated fallback for old traffic)
 */
async function getKeitaroStatsForCampaigns(
  keitaroExternalIds: number[],
  taboolaExternalIds: string[],
  dateFrom: string,
  dateTo: string,
): Promise<{ exact: Map<KeitaroStatsKey, KeitaroStatsValue>; byCampaign: Map<string, KeitaroStatsValue> } | null> {
  if (keitaroExternalIds.length === 0) return { exact: new Map(), byCampaign: new Map() };

  try {
    const settings = await getKeitaroSettings();
    if (!settings.apiUrl || !settings.apiKey) return null;

    const client = new KeitaroClient({
      apiUrl: settings.apiUrl,
      apiKey: settings.apiKey,
    });

    // Group by campaign_id + sub_id_1 to get exact per-Taboola-campaign stats.
    // sub_id_1 = Taboola campaign ID (passed via {campaign_id} macro in tracking URL).
    const report = await client.buildReport({
      range: { from: dateFrom, to: dateTo, timezone: CRM_TIMEZONE },
      grouping: ["campaign_id", "sub_id_1"],
      metrics: ["clicks", "conversions", "sales", "revenue"],
      limit: 100_000,
      offset: 0,
    });

    const keitaroIdSet = new Set(keitaroExternalIds);
    const taboolaIdSet = new Set(taboolaExternalIds);
    const exact = new Map<KeitaroStatsKey, KeitaroStatsValue>();
    const byCampaign = new Map<string, KeitaroStatsValue>();

    for (const row of report.rows) {
      const campId = Number(row.campaign_id);
      if (!campId || !keitaroIdSet.has(campId)) continue;

      const clicks = Number(row.clicks ?? 0);
      const leads = Number(row.conversions ?? 0);
      const sales = Number(row.sales ?? 0);
      const revenue = Number(row.revenue ?? 0);

      // Always aggregate by campaign (fallback)
      const campKey = String(campId);
      const campExisting = byCampaign.get(campKey);
      if (campExisting) {
        campExisting.clicks += clicks;
        campExisting.leads += leads;
        campExisting.sales += sales;
        campExisting.revenue += revenue;
      } else {
        byCampaign.set(campKey, { clicks, leads, sales, revenue });
      }

      // Exact match via sub_id_1
      const subId = String(row.sub_id_1 ?? "").trim();
      if (subId && taboolaIdSet.has(subId)) {
        const exactKey = `${campId}:${subId}`;
        const exactExisting = exact.get(exactKey);
        if (exactExisting) {
          exactExisting.clicks += clicks;
          exactExisting.leads += leads;
          exactExisting.sales += sales;
          exactExisting.revenue += revenue;
        } else {
          exact.set(exactKey, { clicks, leads, sales, revenue });
        }
      }
    }
    return { exact, byCampaign };
  } catch (err) {
    console.error("[getKeitaroStatsForCampaigns] Keitaro API error:", err);
    return null;
  }
}

/** Get commission multiplier per campaign via Campaign → AdAccount → Account → Agency chain. */
async function getCommissionMultipliers(
  campaignExternalIds: string[],
): Promise<Map<string, number>> {
  if (campaignExternalIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<
    { externalId: string; multiplier: number }[]
  >`
    SELECT c."externalId",
           (1 + COALESCE(a."commissionPercent", ag."commissionPercent", 0) / 100) *
           (1 + COALESCE(a."cryptoPaymentPercent", ag."cryptoPaymentPercent", 0) / 100) as multiplier
    FROM "campaigns" c
    JOIN "ad_accounts" aa ON aa."id" = c."adAccountId"
    LEFT JOIN "integration_settings" iset
      ON iset."value" = aa."externalId"
      AND iset."key" LIKE 'taboola.%.taboolaAccountId'
    LEFT JOIN "accounts" a
      ON a."id" = SUBSTRING(iset."key" FROM 'taboola\\.(.+)\\.taboolaAccountId')
    LEFT JOIN "agencies" ag ON ag."id" = COALESCE(a."agencyId", aa."agencyId")
    WHERE c."externalId" IN (${Prisma.join(campaignExternalIds)})
  `;

  const result = new Map<string, number>();
  for (const r of rows) {
    result.set(r.externalId, Number(r.multiplier));
  }
  return result;
}

// ─── Daily revenue for dashboard chart ──────────────────────────────────────

/**
 * Get daily revenue from campaign links (Keitaro API grouped by day).
 * Returns a Map of "YYYY-MM-DD" → total revenue for that day.
 */
export async function getCampaignLinkDailyRevenue(
  dateFrom?: string,
  dateTo?: string,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  try {
    const links = await getCampaignLinks();
    if (links.length === 0) return result;

    const settings = await getKeitaroSettings();
    if (!settings.apiUrl || !settings.apiKey) return result;

    const client = new KeitaroClient({
      apiUrl: settings.apiUrl,
      apiKey: settings.apiKey,
    });

    const from = dateFrom ?? "2024-01-01";
    const to = dateTo ?? todayCrm();

    const report = await client.buildReport({
      range: { from, to, timezone: CRM_TIMEZONE },
      grouping: ["campaign_id", "day"],
      metrics: ["conversions", "sales", "revenue"],
      limit: 50_000,
      offset: 0,
    });

    // Build a quick lookup: keitaroExternalId → { paymentModel, cplRate }
    const linkMap = new Map<number, { paymentModel: string; cplRate: number | null }>();
    for (const l of links) {
      linkMap.set(l.keitaroCampaignExternalId, {
        paymentModel: l.paymentModel,
        cplRate: l.cplRate,
      });
    }

    for (const row of report.rows) {
      const campId = Number(row.campaign_id);
      const day = row.day as string | undefined;
      if (!campId || !day) continue;

      const link = linkMap.get(campId);
      if (!link) continue;

      let revenue = 0;
      if (link.paymentModel === "CPL" && link.cplRate !== null) {
        revenue = Number(row.conversions ?? 0) * link.cplRate;
      } else if (link.paymentModel === "CPA") {
        revenue = Number(row.revenue ?? 0);
      }

      if (revenue > 0) {
        result.set(day, (result.get(day) ?? 0) + revenue);
      }
    }
  } catch (err) {
    console.error("[getCampaignLinkDailyRevenue] Error:", err);
  }

  return result;
}

// ─── Adspect stream options ──────────────────────────────────────────────────

/** Fetch Adspect streams for the CampaignLink form dropdown. */
export async function getAdspectStreams(): Promise<AdspectStreamOption[]> {
  try {
    const { isAdspectConfigured, getAdspectSettings } = await import(
      "@/features/integration-settings/queries"
    );
    if (!(await isAdspectConfigured())) return [];
    const settings = await getAdspectSettings();
    if (!settings.apiKey) return [];

    const { AdspectClient } = await import("@/integrations/adspect/client");
    const client = new AdspectClient({ apiKey: settings.apiKey });
    const streams = await client.getStreams();
    return streams.map((s) => ({ id: s.stream_id, name: s.name }));
  } catch (err) {
    console.error("[getAdspectStreams] Adspect API error:", err);
    return [];
  }
}

// ─── Combined stats (main page query) ───────────────────────────────────────

/** Get all campaign links with merged Taboola + Keitaro stats. */
export async function getCampaignLinkStats(
  dateFrom?: string,
  dateTo?: string,
): Promise<CampaignStatsRow[]> {
  const links = await getCampaignLinks();
  if (links.length === 0) return [];

  // Taboola stats + commission multipliers
  const taboolaIdSet = new Set(links.map((l) => l.taboolaCampaignExternalId));
  const taboolaIds = Array.from(taboolaIdSet);
  const [taboolaStats, commMultipliers] = await Promise.all([
    getTaboolaStatsByCampaign(taboolaIds, dateFrom, dateTo),
    getCommissionMultipliers(taboolaIds),
  ]);

  // Keitaro stats — grouped by campaign_id + sub_id for exact per-Taboola matching
  const keitaroIdSet = new Set(links.map((l) => l.keitaroCampaignExternalId));
  const keitaroIds = Array.from(keitaroIdSet);
  const from = dateFrom ?? "2024-01-01";
  const to = dateTo ?? todayCrm();
  let keitaroResult: { exact: Map<string, KeitaroStatsValue>; byCampaign: Map<string, KeitaroStatsValue> } | null = null;
  if (keitaroIds.length > 0) {
    keitaroResult = await getKeitaroStatsForCampaigns(keitaroIds, taboolaIds, from, to);
  }

  // Count how many links share the same Keitaro campaign (for fallback distribution)
  const linksPerKeitaro = new Map<number, number>();
  for (const l of links) {
    linksPerKeitaro.set(l.keitaroCampaignExternalId, (linksPerKeitaro.get(l.keitaroCampaignExternalId) ?? 0) + 1);
  }

  // Merge — prefer exact sub_id match, fall back to campaign-level
  return links.map((link) => {
    const ts = taboolaStats.get(link.taboolaCampaignExternalId);

    // Try exact match first (sub_id_1 = Taboola campaign ID)
    const ksKey = `${link.keitaroCampaignExternalId}:${link.taboolaCampaignExternalId}`;
    const exactKs = keitaroResult?.exact.get(ksKey) ?? null;
    // Fallback: campaign-level stats (only if this is the sole link for this Keitaro campaign)
    const campaignKs = keitaroResult?.byCampaign.get(String(link.keitaroCampaignExternalId)) ?? null;
    const linkCount = linksPerKeitaro.get(link.keitaroCampaignExternalId) ?? 1;
    const ks = exactKs ?? (linkCount === 1 ? campaignKs : null);

    const rawSpend = ts?.spend ?? 0;
    const multiplier = commMultipliers.get(link.taboolaCampaignExternalId) ?? 1;
    const spend = rawSpend * multiplier;

    const leads = ks?.leads ?? null;
    const sales = ks?.sales ?? null;
    const keitaroRevenue = ks?.revenue ?? null;

    // CPL = spend / leads
    const cpl = leads && leads > 0 ? spend / leads : null;

    // Revenue: CPL = leads × rate; CPA = Keitaro revenue
    let revenue: number | null = null;
    if (link.paymentModel === "CPL" && leads !== null && link.cplRate !== null) {
      revenue = leads * link.cplRate;
    } else if (link.paymentModel === "CPA" && keitaroRevenue !== null) {
      revenue = keitaroRevenue;
    }

    // Profit = revenue - spend
    const profit = revenue !== null ? revenue - spend : null;

    // ROI = (revenue - spend) / spend × 100
    const roi =
      revenue !== null && spend > 0 ? ((revenue - spend) / spend) * 100 : null;

    return {
      linkId: link.id,
      taboolaCampaignName: link.taboolaCampaignName,
      keitaroCampaignName: link.keitaroCampaignName,
      paymentModel: link.paymentModel,
      cplRate: link.cplRate,
      country: link.country,
      clicks: ts?.clicks ?? 0,
      spend,
      impressions: ts?.impressions ?? 0,
      leads,
      sales,
      keitaroRevenue,
      cpl,
      revenue,
      profit,
      roi,
    };
  });
}
