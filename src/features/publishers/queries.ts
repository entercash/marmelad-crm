/**
 * Publishers data-access layer (v2 — CSV aggregation).
 *
 * Aggregates Taboola CSV import data per site/publisher with:
 *   - Commission-adjusted spend (account → agency → multiplier)
 *   - Keitaro leads matched via campaign_id + sub_id_1 (= Taboola site ID)
 *   - Revenue calculated from CampaignLink payment model (CPL/CPA)
 *   - Country filtering via CampaignLink.country (Keitaro) + TaboolaCsvRow.countryCode (Taboola)
 *
 * Called only from the Publishers Server Component — never imported by client code.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { KeitaroClient } from "@/integrations/keitaro/client";
import { getKeitaroSettings } from "@/features/integration-settings/queries";
import { CRM_TIMEZONE, todayCrm, toApiDate } from "@/lib/date";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PublisherStatsRow = {
  siteExternalId: string;
  siteName: string;
  siteUrl: string | null;
  clicks: number;
  impressions: number;
  spend: number;
  cpc: number | null;
  ctr: number | null;
  leads: number | null;
  revenue: number | null;
  profit: number | null;
  roi: number | null;
  botPercent: number | null;
  clickDiscrepancy: number | null;
};

export type PublisherStatsResult = {
  rows: PublisherStatsRow[];
  total: number;
};

export type CountryOption = {
  code: string;
  name: string;
};

// ─── Raw SQL row types ──────────────────────────────────────────────────────

type RawCountRow = { total: bigint };

type RawStatsRow = {
  siteExternalId: string;
  siteName: string;
  siteUrl: string | null;
  clicks: bigint;
  impressions: bigint;
  spend: unknown; // Prisma Decimal from SUM
};

// ─── Internal types ─────────────────────────────────────────────────────────

type CampaignLinkInfo = {
  taboolaCampaignExternalId: string;
  keitaroCampaignExternalId: number;
  paymentModel: string;
  cplRate: number | null;
};

// ─── Dropdown queries ───────────────────────────────────────────────────────

/** Get distinct countries from CSV data for the filter dropdown. */
export async function getDistinctCountries(): Promise<CountryOption[]> {
  const rows = await prisma.$queryRaw<
    { countryCode: string; country: string }[]
  >`
    SELECT DISTINCT "countryCode", "country"
    FROM "taboola_csv_rows"
    WHERE "countryCode" != ''
    ORDER BY "country"
  `;
  return rows.map((r) => ({ code: r.countryCode, name: r.country }));
}

// ─── Campaign links for publisher matching ──────────────────────────────────

/**
 * Get CampaignLinks relevant for publisher matching.
 * When country filter is active, only return links for that country.
 */
async function getCampaignLinksForPublishers(
  country?: string,
): Promise<CampaignLinkInfo[]> {
  const where: Prisma.CampaignLinkWhereInput = {};
  if (country) {
    where.country = country;
  }

  const links = await prisma.campaignLink.findMany({
    where,
    select: {
      taboolaCampaignExternalId: true,
      paymentModel: true,
      cplRate: true,
      keitaroCampaign: { select: { externalId: true } },
    },
  });

  return links.map((l) => ({
    taboolaCampaignExternalId: l.taboolaCampaignExternalId,
    keitaroCampaignExternalId: l.keitaroCampaign.externalId,
    paymentModel: l.paymentModel,
    cplRate: l.cplRate ? Number(l.cplRate) : null,
  }));
}

// ─── Site → campaign associations ───────────────────────────────────────────

/**
 * For a set of sites, find which Taboola campaigns they belong to.
 * Returns Map<siteExternalId, campaignExternalId[]>.
 */
async function getSiteCampaignAssociations(
  siteExternalIds: string[],
  country?: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<Map<string, string[]>> {
  if (siteExternalIds.length === 0) return new Map();

  const countryClause = country
    ? Prisma.sql`AND "countryCode" = ${country}`
    : Prisma.empty;

  const dateClause = dateFrom && dateTo
    ? Prisma.sql`AND "day" >= ${dateFrom}::date AND "day" <= ${dateTo}::date`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    { siteExternalId: string; campaignExternalId: string }[]
  >(
    Prisma.sql`
      SELECT DISTINCT "siteExternalId", "campaignExternalId"
      FROM "taboola_csv_rows"
      WHERE "siteExternalId" IN (${Prisma.join(siteExternalIds)})
      ${countryClause}
      ${dateClause}
    `,
  );

  const map = new Map<string, string[]>();
  for (const r of rows) {
    const arr = map.get(r.siteExternalId) ?? [];
    arr.push(r.campaignExternalId);
    map.set(r.siteExternalId, arr);
  }
  return map;
}

// ─── Keitaro stats by campaign (campaign-level) ─────────────────────────────

/**
 * Fetch Keitaro stats grouped by campaign_id only (no sub_id).
 * Leads are distributed to sites proportionally by clicks in getPublisherStats.
 * Returns Map keyed by keitaroCampaignExternalId.
 */
async function getKeitaroStatsByCampaign(
  keitaroExternalIds: number[],
  dateFrom?: string,
  dateTo?: string,
): Promise<Map<number, { leads: number; revenue: number }> | null> {
  if (keitaroExternalIds.length === 0) return new Map();

  try {
    const settings = await getKeitaroSettings();
    if (!settings.apiUrl || !settings.apiKey) return null;

    const client = new KeitaroClient({
      apiUrl: settings.apiUrl,
      apiKey: settings.apiKey,
    });

    const from = dateFrom ?? "2024-01-01";
    const to = dateTo ?? todayCrm();

    const report = await client.buildReport({
      range: { from, to, timezone: CRM_TIMEZONE },
      grouping: ["campaign_id"],
      metrics: ["conversions", "revenue"],
      limit: 10_000,
      offset: 0,
    });

    const idSet = new Set(keitaroExternalIds);
    const map = new Map<number, { leads: number; revenue: number }>();
    for (const row of report.rows) {
      const campId = Number(row.campaign_id);
      if (!campId || !idSet.has(campId)) continue;

      map.set(campId, {
        leads: Number(row.conversions ?? 0),
        revenue: Number(row.revenue ?? 0),
      });
    }
    return map;
  } catch (err) {
    console.error("[getKeitaroStatsByCampaign] Keitaro API error:", err);
    return null;
  }
}

// ─── Click distribution helpers ─────────────────────────────────────────────

/** Get total clicks per Taboola campaign (across ALL sites, for proportional share denominator). */
async function getCampaignClickTotals(
  campaignExternalIds: string[],
  dateFrom?: string,
  dateTo?: string,
): Promise<Map<string, number>> {
  if (campaignExternalIds.length === 0) return new Map();

  const dateClause = dateFrom && dateTo
    ? Prisma.sql`AND "day" >= ${dateFrom}::date AND "day" <= ${dateTo}::date`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    { campaignExternalId: string; clicks: bigint }[]
  >(
    Prisma.sql`
      SELECT "campaignExternalId", SUM("clicks") as clicks
      FROM "taboola_csv_rows"
      WHERE "campaignExternalId" IN (${Prisma.join(campaignExternalIds)})
        ${dateClause}
      GROUP BY "campaignExternalId"
    `,
  );

  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.campaignExternalId, Number(r.clicks));
  }
  return map;
}

/** Get clicks per site per campaign (for proportional lead distribution to individual sites). */
async function getSiteCampaignClicks(
  siteExternalIds: string[],
  campaignExternalIds: string[],
  dateFrom?: string,
  dateTo?: string,
): Promise<Map<string, number>> {
  if (siteExternalIds.length === 0 || campaignExternalIds.length === 0) return new Map();

  const dateClause = dateFrom && dateTo
    ? Prisma.sql`AND "day" >= ${dateFrom}::date AND "day" <= ${dateTo}::date`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    { siteExternalId: string; campaignExternalId: string; clicks: bigint }[]
  >(
    Prisma.sql`
      SELECT "siteExternalId", "campaignExternalId", SUM("clicks") as clicks
      FROM "taboola_csv_rows"
      WHERE "siteExternalId" IN (${Prisma.join(siteExternalIds)})
        AND "campaignExternalId" IN (${Prisma.join(campaignExternalIds)})
        ${dateClause}
      GROUP BY "siteExternalId", "campaignExternalId"
    `,
  );

  // Key: "siteExternalId_campaignExternalId" → clicks
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(`${r.siteExternalId}_${r.campaignExternalId}`, Number(r.clicks));
  }
  return map;
}

// ─── Adspect stats by sub_id (site) ─────────────────────────────────────────

/**
 * Fetch Adspect funnel stats grouped by sub_id (= Taboola site_id).
 * Returns Map<siteExternalId, { botPercent, adspectClicks }>.
 * Returns null when Adspect is not configured or no streams are mapped.
 */
const ADSPECT_CACHE_TTL = 600; // 10 minutes

type AdspectSiteStats = { botPercent: number; adspectClicks: number };

async function getAdspectStatsBySite(
  siteExternalIds: string[],
  dateFrom?: string,
  dateTo?: string,
): Promise<Map<string, AdspectSiteStats> | null> {
  if (siteExternalIds.length === 0) return new Map();

  try {
    // 1. Find CampaignLinks with adspectStreamId set
    const linksWithStreams = await prisma.campaignLink.findMany({
      where: { adspectStreamId: { not: null } },
      select: { adspectStreamId: true },
    });
    const streamIds = Array.from(new Set(
      linksWithStreams.map((l) => l.adspectStreamId!).filter(Boolean),
    ));
    if (streamIds.length === 0) return null;

    // 2. Check if Adspect is configured
    const { getAdspectSettings } = await import(
      "@/features/integration-settings/queries"
    );
    const settings = await getAdspectSettings();
    if (!settings.apiKey) return null;

    // 3. Check Redis cache (with 2s timeout — never block page render)
    const df = dateFrom ?? "2024-01-01";
    const dt = dateTo ?? todayCrm();
    const cacheKey = `adspect:funnel:${streamIds.sort().join(",")}:${df}:${dt}`;

    let redisClient: Awaited<typeof import("@/lib/redis")>["redis"] | null = null;
    try {
      const { redis } = await import("@/lib/redis");
      redisClient = redis;
      const cached = await Promise.race([
        redis.get(cacheKey),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]);
      if (cached) {
        const entries: [string, AdspectSiteStats][] = JSON.parse(cached);
        return new Map(entries);
      }
    } catch {
      // Redis unavailable — skip cache, fetch from API
    }

    // 4. Call Adspect funnel API
    const { AdspectClient } = await import("@/integrations/adspect/client");
    const client = new AdspectClient({ apiKey: settings.apiKey });
    const rows = await client.getFunnelBySite({ streamIds, dateFrom: df, dateTo: dt });

    // 5. Build map keyed by sub_id (= site external ID)
    const map = new Map<string, AdspectSiteStats>();
    for (const row of rows) {
      if (!row.sub_id) continue;
      const totalClicks = row.clicks || 0;
      // quality is 0–1 ratio (e.g. 0.52 = 52% good); bot% = (1 − quality) × 100
      const botPct = totalClicks > 0 ? (1 - row.quality) * 100 : 0;
      map.set(row.sub_id, {
        botPercent: Math.round(botPct * 10) / 10,
        adspectClicks: totalClicks,
      });
    }

    // 6. Store in Redis cache (fire-and-forget, with timeout)
    if (redisClient) {
      Promise.race([
        redisClient.set(cacheKey, JSON.stringify(Array.from(map.entries())), "EX", ADSPECT_CACHE_TTL),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]).catch(() => {});
    }

    return map;
  } catch (err) {
    console.error("[getAdspectStatsBySite] Adspect API error:", err);
    return null;
  }
}

// ─── Main stats query ───────────────────────────────────────────────────────

/**
 * Get publisher stats aggregated from TaboolaCsvRow with:
 *   - Commission-adjusted spend via Account → Agency chain
 *   - Keitaro leads matched via CampaignLink → campaign_id + sub_id_1
 *   - Revenue from CampaignLink payment model (CPL: leads × rate, CPA: Keitaro revenue)
 *   - Country filter on both Taboola (countryCode) and Keitaro (CampaignLink.country) sides
 */
export async function getPublisherStats(params: {
  country?: string;
  page?: number;
  perPage?: number;
  dateFrom?: string;
  dateTo?: string;
  linkedOnly?: boolean;
}): Promise<PublisherStatsResult> {
  const { country, page = 1, perPage = 50, dateFrom, dateTo, linkedOnly } = params;
  const offset = (page - 1) * perPage;

  // If linkedOnly, get campaign external IDs from CampaignLink
  let linkedCampaignIds: string[] | null = null;
  if (linkedOnly) {
    const links = await prisma.campaignLink.findMany({
      select: { taboolaCampaignExternalId: true },
    });
    linkedCampaignIds = Array.from(new Set(links.map((l) => l.taboolaCampaignExternalId)));
    if (linkedCampaignIds.length === 0) {
      return { rows: [], total: 0 };
    }
  }

  const conditions: Prisma.Sql[] = [];
  if (country) conditions.push(Prisma.sql`"countryCode" = ${country}`);
  if (dateFrom && dateTo) conditions.push(Prisma.sql`"day" >= ${dateFrom}::date AND "day" <= ${dateTo}::date`);
  if (linkedCampaignIds) conditions.push(Prisma.sql`"campaignExternalId" IN (${Prisma.join(linkedCampaignIds)})`);

  const countWhereClause = conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;

  const tConditions: Prisma.Sql[] = [];
  if (country) tConditions.push(Prisma.sql`t."countryCode" = ${country}`);
  if (dateFrom && dateTo) tConditions.push(Prisma.sql`t."day" >= ${dateFrom}::date AND t."day" <= ${dateTo}::date`);
  if (linkedCampaignIds) tConditions.push(Prisma.sql`t."campaignExternalId" IN (${Prisma.join(linkedCampaignIds)})`);

  const whereClause = tConditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(tConditions, " AND ")}`
    : Prisma.empty;

  // 1. Total count of distinct sites
  const countRows = await prisma.$queryRaw<RawCountRow[]>(
    Prisma.sql`
      SELECT COUNT(DISTINCT "siteExternalId") as total
      FROM "taboola_csv_rows"
      ${countWhereClause}
    `,
  );
  const total = Number(countRows[0]?.total ?? 0);

  if (total === 0) {
    return { rows: [], total: 0 };
  }

  // 2. Aggregated stats per site WITH commission-adjusted spend
  //    CTE computes per-account multiplier: (1 + commPct/100) × (1 + cryptoPct/100)
  //    Main query applies multiplier per CSV row before SUM
  const rawRows = await prisma.$queryRaw<RawStatsRow[]>(
    Prisma.sql`
      WITH acct_mult AS (
        SELECT DISTINCT ON (a."externalId")
          a."externalId",
          (1 + COALESCE(ag."commissionPercent", 0) / 100) *
          (1 + COALESCE(ag."cryptoPaymentPercent", 0) / 100) as multiplier
        FROM "accounts" a
        LEFT JOIN "agencies" ag ON ag."id" = a."agencyId"
        WHERE a."externalId" IS NOT NULL
        ORDER BY a."externalId"
      )
      SELECT
        t."siteExternalId",
        MAX(t."siteName") as "siteName",
        MAX(t."siteUrl") as "siteUrl",
        COALESCE(SUM(t."clicks"), 0) as "clicks",
        COALESCE(SUM(t."impressions"), 0) as "impressions",
        COALESCE(SUM(t."spentUsd" * COALESCE(am.multiplier, 1)), 0) as "spend"
      FROM "taboola_csv_rows" t
      LEFT JOIN acct_mult am ON am."externalId" = t."accountExternalId"
      ${whereClause}
      GROUP BY t."siteExternalId"
      ORDER BY SUM(t."spentUsd" * COALESCE(am.multiplier, 1)) DESC
      LIMIT ${perPage} OFFSET ${offset}
    `,
  );

  // 3. Get CampaignLinks (filtered by country for Keitaro side)
  const links = await getCampaignLinksForPublishers(country);
  const linkByTaboolaCampaign = new Map(
    links.map((l) => [l.taboolaCampaignExternalId, l]),
  );

  // 4. For sites on this page, find which campaigns they belong to
  const siteIds = rawRows.map((r) => r.siteExternalId);
  const siteCampaigns = await getSiteCampaignAssociations(siteIds, country, dateFrom, dateTo);

  // 5. Fetch Keitaro stats at campaign level + click distribution data
  const keitaroExternalIds = Array.from(
    new Set(links.map((l) => l.keitaroCampaignExternalId)),
  );
  const linkedTaboolaCampaignIds = Array.from(
    new Set(links.map((l) => l.taboolaCampaignExternalId)),
  );

  const [keitaroStats, campaignClickTotals, siteCampaignClickMap, adspectStats] =
    await Promise.all([
      getKeitaroStatsByCampaign(keitaroExternalIds, dateFrom, dateTo),
      getCampaignClickTotals(linkedTaboolaCampaignIds, dateFrom, dateTo),
      getSiteCampaignClicks(siteIds, linkedTaboolaCampaignIds, dateFrom, dateTo),
      getAdspectStatsBySite(siteIds, dateFrom, dateTo),
    ]);

  // Build: keitaroCampaignExternalId → total Taboola clicks (denominator for proportional share)
  const keitaroCampaignTotalClicks = new Map<number, number>();
  for (const link of links) {
    const kid = link.keitaroCampaignExternalId;
    const tc = campaignClickTotals.get(link.taboolaCampaignExternalId) ?? 0;
    keitaroCampaignTotalClicks.set(kid, (keitaroCampaignTotalClicks.get(kid) ?? 0) + tc);
  }

  // 6. Merge Taboola + Keitaro + Adspect data
  const rows: PublisherStatsRow[] = rawRows.map((r) => {
    const clicks = Number(r.clicks);
    const impressions = Number(r.impressions);
    const spend = Number(r.spend);
    const cpc = clicks > 0 ? spend / clicks : null;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;

    // Sum leads and revenue across campaigns for this site (proportional by clicks)
    let totalLeads = 0;
    let totalRevenue = 0;
    let hasKeitaroData = false;

    const campaigns = siteCampaigns.get(r.siteExternalId) ?? [];
    for (const campaignExternalId of campaigns) {
      const link = linkByTaboolaCampaign.get(campaignExternalId);
      if (!link) continue;

      const ks = keitaroStats?.get(link.keitaroCampaignExternalId);
      if (!ks) continue;

      hasKeitaroData = true;

      // Proportional share: site clicks in this campaign / total clicks for the Keitaro campaign
      const siteClicks = siteCampaignClickMap.get(`${r.siteExternalId}_${campaignExternalId}`) ?? 0;
      const totalClicks = keitaroCampaignTotalClicks.get(link.keitaroCampaignExternalId) ?? 0;
      const share = totalClicks > 0 ? siteClicks / totalClicks : 0;

      totalLeads += ks.leads * share;

      if (link.paymentModel === "CPL" && link.cplRate !== null) {
        totalRevenue += ks.leads * share * link.cplRate;
      } else if (link.paymentModel === "CPA") {
        totalRevenue += ks.revenue * share;
      }
    }

    const leads = hasKeitaroData ? totalLeads : null;
    const revenue = hasKeitaroData ? totalRevenue : null;
    const profit = revenue !== null ? revenue - spend : null;
    const roi =
      revenue !== null && spend > 0
        ? ((revenue - spend) / spend) * 100
        : null;

    // Adspect data — sub_id may be siteExternalId (new), siteName, or domain from siteUrl (legacy)
    let adspect = adspectStats?.get(r.siteExternalId) ?? adspectStats?.get(r.siteName) ?? null;
    if (!adspect && r.siteUrl && adspectStats) {
      try {
        const hostname = new URL(r.siteUrl.startsWith("http") ? r.siteUrl : `https://${r.siteUrl}`).hostname;
        adspect = adspectStats.get(hostname) ?? null;
      } catch { /* invalid URL */ }
    }
    const botPercent = adspect?.botPercent ?? null;
    const clickDiscrepancy = adspect ? clicks - adspect.adspectClicks : null;

    return {
      siteExternalId: r.siteExternalId,
      siteName: r.siteName,
      siteUrl: r.siteUrl,
      clicks,
      impressions,
      spend,
      cpc,
      ctr,
      leads,
      revenue,
      profit,
      roi,
      botPercent,
      clickDiscrepancy,
    };
  });

  return { rows, total };
}

// ─── Daily trends for sparklines ─────────────────────────────────────────────

export type SiteTrends = {
  roiTrend: number[];   // daily ROI values (7 points)
  botTrend: number[];   // daily bot% values (7 points)
};

/**
 * Fetch last-7-day daily ROI and bot% per site for sparkline rendering.
 * Runs independently from the main stats query (fixed 7-day window).
 *
 * Returns Map<siteExternalId, SiteTrends>.
 */
export async function getPublisherDailyTrends(
  siteExternalIds: string[],
): Promise<Map<string, SiteTrends>> {
  if (siteExternalIds.length === 0) return new Map();

  // 7-day window: today - 6 days → today
  const today = todayCrm();
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const fromDate = new Date(todayDate);
  fromDate.setUTCDate(fromDate.getUTCDate() - 6);
  const dateFrom = toApiDate(fromDate);
  const dateTo = today;

  // Build ordered list of 7 days for consistent array indexing
  const dayLabels: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(fromDate);
    d.setUTCDate(d.getUTCDate() + i);
    dayLabels.push(toApiDate(d));
  }

  // 1. Taboola CSV: daily spend + clicks per site (with commission multiplier)
  type RawDailyRow = {
    day: Date;
    siteExternalId: string;
    clicks: bigint;
    spend: unknown;
  };

  const dailySpend = await prisma.$queryRaw<RawDailyRow[]>(
    Prisma.sql`
      WITH acct_mult AS (
        SELECT DISTINCT ON (a."externalId")
          a."externalId",
          (1 + COALESCE(a."commissionPercent", ag."commissionPercent", 0) / 100) *
          (1 + COALESCE(a."cryptoPaymentPercent", ag."cryptoPaymentPercent", 0) / 100)
          as multiplier
        FROM "accounts" a
        LEFT JOIN "agencies" ag ON ag."id" = a."agencyId"
        WHERE a."externalId" IS NOT NULL
        ORDER BY a."externalId"
      )
      SELECT
        t."day",
        t."siteExternalId",
        COALESCE(SUM(t."clicks"), 0) as "clicks",
        COALESCE(SUM(t."spentUsd" * COALESCE(am.multiplier, 1)), 0) as "spend"
      FROM "taboola_csv_rows" t
      LEFT JOIN acct_mult am ON am."externalId" = t."accountExternalId"
      WHERE t."siteExternalId" IN (${Prisma.join(siteExternalIds)})
        AND t."day" >= ${dateFrom}::date
        AND t."day" <= ${dateTo}::date
      GROUP BY t."day", t."siteExternalId"
    `,
  );

  // Index: Map<siteId, Map<day, { spend, clicks }>>
  const spendByDay = new Map<string, Map<string, { spend: number; clicks: number }>>();
  for (const r of dailySpend) {
    const day = r.day instanceof Date ? toApiDate(r.day) : String(r.day).slice(0, 10);
    const siteId = r.siteExternalId;
    if (!spendByDay.has(siteId)) spendByDay.set(siteId, new Map());
    spendByDay.get(siteId)!.set(day, {
      spend: Number(r.spend),
      clicks: Number(r.clicks),
    });
  }

  // 2. Keitaro: daily revenue per site (campaign-level, distributed by clicks)
  //    Map<siteId, Map<day, { leads, revenue }>>
  const revenueByDay = new Map<string, Map<string, { leads: number; revenue: number }>>();

  try {
    const settings = await getKeitaroSettings();
    if (settings.apiUrl && settings.apiKey) {
      const links = await prisma.campaignLink.findMany({
        select: {
          taboolaCampaignExternalId: true,
          paymentModel: true,
          cplRate: true,
          keitaroCampaign: { select: { externalId: true } },
        },
      });

      const keitaroIds = Array.from(new Set(links.map((l) => l.keitaroCampaign.externalId)));
      if (keitaroIds.length > 0) {
        const client = new KeitaroClient({ apiUrl: settings.apiUrl, apiKey: settings.apiKey });
        const report = await client.buildReport({
          range: { from: dateFrom, to: dateTo, timezone: CRM_TIMEZONE },
          grouping: ["day", "campaign_id"],
          metrics: ["conversions", "revenue"],
          limit: 50_000,
          offset: 0,
        });

        // Daily Keitaro data: Map<keitaroCampaignId, Map<day, { leads, revenue }>>
        const keitaroDailyByCampaign = new Map<number, Map<string, { leads: number; revenue: number }>>();
        const idSet = new Set(keitaroIds);
        for (const row of report.rows) {
          const campId = Number(row.campaign_id);
          const day = String(row.day ?? "").trim();
          if (!campId || !day || !idSet.has(campId)) continue;

          if (!keitaroDailyByCampaign.has(campId)) keitaroDailyByCampaign.set(campId, new Map());
          keitaroDailyByCampaign.get(campId)!.set(day, {
            leads: Number(row.conversions ?? 0),
            revenue: Number(row.revenue ?? 0),
          });
        }

        // Get click distribution for proportional share (7-day period)
        const linkedTaboolaCampaignIds = Array.from(new Set(links.map((l) => l.taboolaCampaignExternalId)));
        const [campClickTotals, siteCampClicks] = await Promise.all([
          getCampaignClickTotals(linkedTaboolaCampaignIds, dateFrom, dateTo),
          getSiteCampaignClicks(siteExternalIds, linkedTaboolaCampaignIds, dateFrom, dateTo),
        ]);

        // Build keitaroCampaignId → total Taboola clicks
        const keitaroCampTotalClicks = new Map<number, number>();
        for (const l of links) {
          const kid = l.keitaroCampaign.externalId;
          const tc = campClickTotals.get(l.taboolaCampaignExternalId) ?? 0;
          keitaroCampTotalClicks.set(kid, (keitaroCampTotalClicks.get(kid) ?? 0) + tc);
        }

        const linkByCampaign = new Map(
          links.map((l) => [l.taboolaCampaignExternalId, l]),
        );
        const siteCampaigns = await getSiteCampaignAssociations(siteExternalIds, undefined, dateFrom, dateTo);

        // Distribute daily Keitaro data to sites by click share
        for (const siteId of siteExternalIds) {
          const campaigns = siteCampaigns.get(siteId) ?? [];
          for (const campaignExternalId of campaigns) {
            const link = linkByCampaign.get(campaignExternalId);
            if (!link) continue;

            const kid = link.keitaroCampaign.externalId;
            const dailyMap = keitaroDailyByCampaign.get(kid);
            if (!dailyMap) continue;

            const siteClicks = siteCampClicks.get(`${siteId}_${campaignExternalId}`) ?? 0;
            const totalClicks = keitaroCampTotalClicks.get(kid) ?? 0;
            const share = totalClicks > 0 ? siteClicks / totalClicks : 0;
            if (share === 0) continue;

            if (!revenueByDay.has(siteId)) revenueByDay.set(siteId, new Map());
            const siteDayMap = revenueByDay.get(siteId)!;

            for (const [day, data] of Array.from(dailyMap.entries())) {
              let revenue = 0;
              if (link.paymentModel === "CPL" && link.cplRate) {
                revenue = data.leads * share * Number(link.cplRate);
              } else if (link.paymentModel === "CPA") {
                revenue = data.revenue * share;
              }

              const existing = siteDayMap.get(day) ?? { leads: 0, revenue: 0 };
              siteDayMap.set(day, {
                leads: existing.leads + data.leads * share,
                revenue: existing.revenue + revenue,
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[getPublisherDailyTrends] Keitaro error:", err);
  }

  // 3. Adspect: daily bot% per site
  //    Map<siteId, Map<day, botPercent>>
  const botByDay = new Map<string, Map<string, number>>();

  try {
    const linksWithStreams = await prisma.campaignLink.findMany({
      where: { adspectStreamId: { not: null } },
      select: { adspectStreamId: true },
    });
    const streamIds = Array.from(new Set(
      linksWithStreams.map((l) => l.adspectStreamId!).filter(Boolean),
    ));

    if (streamIds.length > 0) {
      const { getAdspectSettings } = await import("@/features/integration-settings/queries");
      const adSettings = await getAdspectSettings();
      if (adSettings.apiKey) {
        // Check Redis cache
        const cacheKey = `adspect:daily-funnel:${streamIds.sort().join(",")}:${dateFrom}:${dateTo}`;
        let redisClient: Awaited<typeof import("@/lib/redis")>["redis"] | null = null;
        let cached: string | null = null;

        try {
          const { redis } = await import("@/lib/redis");
          redisClient = redis;
          cached = await Promise.race([
            redis.get(cacheKey),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
          ]);
        } catch { /* Redis unavailable */ }

        if (cached) {
          const entries: [string, [string, number][]][] = JSON.parse(cached);
          for (const [siteId, dayEntries] of entries) {
            botByDay.set(siteId, new Map(dayEntries));
          }
        } else {
          const { AdspectClient } = await import("@/integrations/adspect/client");
          const adClient = new AdspectClient({ apiKey: adSettings.apiKey });
          const rows = await adClient.getFunnelBySiteAndDate({ streamIds, dateFrom, dateTo });

          for (const row of rows) {
            if (!row.sub_id) continue;
            const botPct = row.clicks > 0 ? (1 - row.quality) * 100 : 0;
            if (!botByDay.has(row.sub_id)) botByDay.set(row.sub_id, new Map());
            botByDay.get(row.sub_id)!.set(row.date, Math.round(botPct * 10) / 10);
          }

          // Cache result
          if (redisClient) {
            const serializable = Array.from(botByDay.entries()).map(
              ([sid, dm]) => [sid, Array.from(dm.entries())] as [string, [string, number][]]
            );
            Promise.race([
              redisClient.set(cacheKey, JSON.stringify(serializable), "EX", ADSPECT_CACHE_TTL),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
            ]).catch(() => {});
          }
        }
      }
    }
  } catch (err) {
    console.error("[getPublisherDailyTrends] Adspect error:", err);
  }

  // 4. Merge into SiteTrends per siteExternalId
  const result = new Map<string, SiteTrends>();

  for (const siteId of siteExternalIds) {
    const spendDays = spendByDay.get(siteId);
    const revDays = revenueByDay.get(siteId);
    const botDays = botByDay.get(siteId);

    // ROI trend: need both spend and revenue data
    const roiTrend: number[] = [];
    if (spendDays && revDays) {
      for (const day of dayLabels) {
        const s = spendDays.get(day);
        const r = revDays.get(day);
        if (s && s.spend > 0 && r) {
          roiTrend.push(Math.round(((r.revenue - s.spend) / s.spend) * 1000) / 10);
        } else if (s && s.spend > 0) {
          roiTrend.push(-100); // spend but no revenue = -100% ROI
        }
        // Skip days with no spend (don't push zero — would distort the trend)
      }
    }

    // Bot% trend
    const botTrend: number[] = [];
    if (botDays) {
      for (const day of dayLabels) {
        const bp = botDays.get(day);
        if (bp !== undefined) {
          botTrend.push(bp);
        }
      }
    }

    if (roiTrend.length >= 2 || botTrend.length >= 2) {
      result.set(siteId, {
        roiTrend: roiTrend.length >= 2 ? roiTrend : [],
        botTrend: botTrend.length >= 2 ? botTrend : [],
      });
    }
  }

  return result;
}
