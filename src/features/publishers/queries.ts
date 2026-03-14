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

// ─── Keitaro stats by campaign + sub_id_1 ───────────────────────────────────

/**
 * Fetch Keitaro stats grouped by campaign_id + sub_id_1.
 * Returns Map keyed by "{keitaroCampaignId}_{siteExternalId}".
 */
async function getKeitaroStatsByCampaignAndSite(
  keitaroExternalIds: number[],
  dateFrom?: string,
  dateTo?: string,
): Promise<Map<string, { leads: number; revenue: number }> | null> {
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
      grouping: ["campaign_id", "sub_id_1"],
      metrics: ["conversions", "revenue"],
      limit: 10_000,
      offset: 0,
    });

    const idSet = new Set(keitaroExternalIds);
    const map = new Map<string, { leads: number; revenue: number }>();
    let totalRows = 0;
    let rowsWithSub = 0;
    let rowsMatched = 0;
    for (const row of report.rows) {
      totalRows++;
      const campId = Number(row.campaign_id);
      if (!campId || !idSet.has(campId)) continue;
      rowsMatched++;

      const subId = String(row.sub_id_1 ?? "").trim();
      if (!subId) continue;
      rowsWithSub++;

      const key = `${campId}_${subId}`;
      map.set(key, {
        leads: Number(row.conversions ?? 0),
        revenue: Number(row.revenue ?? 0),
      });
    }
    console.log(`[DIAG keitaro] report: ${totalRows} total rows, ${rowsMatched} matched campaigns, ${rowsWithSub} with sub_id_1, ${map.size} unique keys`);
    // Log first 10 keys with leads > 0
    const keysWithLeads = Array.from(map.entries()).filter(([, v]) => v.leads > 0).slice(0, 10);
    console.log(`[DIAG keitaro] keys with leads:`, keysWithLeads.map(([k, v]) => `${k} → ${v.leads}L/${v.revenue}R`));
    return map;
  } catch (err) {
    console.error("[getKeitaroStatsByCampaignAndSite] Keitaro API error:", err);
    return null;
  }
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

  // 5. Fetch Keitaro stats grouped by campaign_id + sub_id_1
  const keitaroExternalIds = Array.from(
    new Set(links.map((l) => l.keitaroCampaignExternalId)),
  );
  const keitaroStats =
    await getKeitaroStatsByCampaignAndSite(keitaroExternalIds, dateFrom, dateTo);

  // 5b. Fetch Adspect stats by sub_id (site)
  const adspectStats = await getAdspectStatsBySite(siteIds, dateFrom, dateTo);

  // DIAG: log matching info
  console.log(`[DIAG merge] ${rawRows.length} sites on page, ${links.length} campaign links, keitaroStats: ${keitaroStats?.size ?? 'null'} keys`);
  if (keitaroStats && rawRows.length > 0) {
    // Check first 3 sites
    for (const r of rawRows.slice(0, 3)) {
      const campaigns = siteCampaigns.get(r.siteExternalId) ?? [];
      const linkedCampaigns = campaigns.filter(c => linkByTaboolaCampaign.has(c));
      const keys = linkedCampaigns.map(c => {
        const link = linkByTaboolaCampaign.get(c)!;
        return `${link.keitaroCampaignExternalId}_${r.siteExternalId}`;
      });
      const found = keys.filter(k => keitaroStats.has(k));
      console.log(`[DIAG merge] site ${r.siteExternalId} (${r.siteName}): ${campaigns.length} campaigns, ${linkedCampaigns.length} linked, keys: [${keys.join(', ')}], found: [${found.join(', ')}]`);
    }
  }

  // 6. Merge Taboola + Keitaro + Adspect data
  const rows: PublisherStatsRow[] = rawRows.map((r) => {
    const clicks = Number(r.clicks);
    const impressions = Number(r.impressions);
    const spend = Number(r.spend);
    const cpc = clicks > 0 ? spend / clicks : null;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;

    // Sum leads and revenue across campaigns for this site
    let totalLeads = 0;
    let totalRevenue = 0;
    let hasKeitaroData = false;

    const campaigns = siteCampaigns.get(r.siteExternalId) ?? [];
    for (const campaignExternalId of campaigns) {
      const link = linkByTaboolaCampaign.get(campaignExternalId);
      if (!link) continue; // No CampaignLink for this campaign

      const key = `${link.keitaroCampaignExternalId}_${r.siteExternalId}`;
      const ks = keitaroStats?.get(key);
      if (!ks) continue;

      hasKeitaroData = true;
      totalLeads += ks.leads;

      if (link.paymentModel === "CPL" && link.cplRate !== null) {
        totalRevenue += ks.leads * link.cplRate;
      } else if (link.paymentModel === "CPA") {
        totalRevenue += ks.revenue;
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

  // 2. Keitaro: daily revenue per site
  //    Map<siteId, Map<day, { leads, revenue }>>
  const revenueByDay = new Map<string, Map<string, { leads: number; revenue: number }>>();

  try {
    const settings = await getKeitaroSettings();
    if (settings.apiUrl && settings.apiKey) {
      // Get campaign links for revenue calculation
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
          grouping: ["day", "campaign_id", "sub_id_1"],
          metrics: ["conversions", "revenue"],
          limit: 50_000,
          offset: 0,
        });

        // Build lookup: taboolaCampaignExternalId → link info
        const linkByCampaign = new Map(
          links.map((l) => [l.taboolaCampaignExternalId, l]),
        );

        // Also need site → campaign mapping for this date range
        const siteCampaigns = await getSiteCampaignAssociations(siteExternalIds, undefined, dateFrom, dateTo);
        // Invert: keitaroCampaignId → { paymentModel, cplRate } per taboolaCampaign
        const keitaroToLink = new Map<number, typeof links[number][]>();
        for (const l of links) {
          const kid = l.keitaroCampaign.externalId;
          if (!keitaroToLink.has(kid)) keitaroToLink.set(kid, []);
          keitaroToLink.get(kid)!.push(l);
        }

        for (const row of report.rows) {
          const campId = Number(row.campaign_id);
          const subId = String(row.sub_id_1 ?? "").trim();
          const day = String(row.day ?? "").trim();
          if (!campId || !subId || !day) continue;
          if (!siteExternalIds.includes(subId)) continue;

          // Find link for this keitaro campaign
          const matchingLinks = keitaroToLink.get(campId);
          if (!matchingLinks?.length) continue;
          const link = matchingLinks[0]; // use first match

          const leads = Number(row.conversions ?? 0);
          let revenue = 0;
          if (link.paymentModel === "CPL" && link.cplRate) {
            revenue = leads * Number(link.cplRate);
          } else if (link.paymentModel === "CPA") {
            revenue = Number(row.revenue ?? 0);
          }

          if (!revenueByDay.has(subId)) revenueByDay.set(subId, new Map());
          const dayMap = revenueByDay.get(subId)!;
          const existing = dayMap.get(day) ?? { leads: 0, revenue: 0 };
          dayMap.set(day, {
            leads: existing.leads + leads,
            revenue: existing.revenue + revenue,
          });
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
