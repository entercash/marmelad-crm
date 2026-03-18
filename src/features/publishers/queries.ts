/**
 * Publishers data-access layer (v3 — API-synced tables).
 *
 * Aggregates publisher_stats_daily (from Taboola API sync) with:
 *   - Commission-adjusted spend (AdAccount → Account → Agency chain)
 *   - Keitaro leads matched via CampaignLink → campaign_id + sub_id_1
 *   - Revenue calculated from CampaignLink payment model (CPL/CPA)
 *   - Country filtering via publisher_stats_daily.geo + CampaignLink.country
 *
 * Called only from the Publishers Server Component — never imported by client code.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { KeitaroClient } from "@/integrations/keitaro/client";
import { getKeitaroSettings } from "@/features/integration-settings/queries";
import { ACCT_MULT_CTE } from "@/lib/spend-queries";
import { CRM_TIMEZONE, todayCrm, toApiDate } from "@/lib/date";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PublisherStatsRow = {
  siteExternalId: string;
  siteNumericId: number | null;
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
  siteNumericId: number | null;
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

// ─── Country code → name mapping ────────────────────────────────────────────

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", GB: "United Kingdom", FR: "France", DE: "Germany",
  CA: "Canada", AU: "Australia", IT: "Italy", ES: "Spain", NL: "Netherlands",
  BR: "Brazil", IN: "India", JP: "Japan", IL: "Israel", MX: "Mexico",
  PL: "Poland", SE: "Sweden", TR: "Turkey", HK: "Hong Kong", RU: "Russia",
  UA: "Ukraine", KR: "South Korea", TH: "Thailand", PH: "Philippines",
  ID: "Indonesia", ZA: "South Africa", NZ: "New Zealand", IE: "Ireland",
  AT: "Austria", CH: "Switzerland", BE: "Belgium", PT: "Portugal",
  NO: "Norway", DK: "Denmark", FI: "Finland", CZ: "Czech Republic",
  RO: "Romania", HU: "Hungary", GR: "Greece", AR: "Argentina",
  CL: "Chile", CO: "Colombia", PE: "Peru", MY: "Malaysia", SG: "Singapore",
  AE: "UAE", SA: "Saudi Arabia", EG: "Egypt", NG: "Nigeria", KE: "Kenya",
};

/** Get all available countries for form dropdowns (static list). */
export function getAllCountries(): CountryOption[] {
  return Object.entries(COUNTRY_NAMES)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Dropdown queries ───────────────────────────────────────────────────────

/** Get distinct countries from publisher_stats_daily for the filter dropdown. */
export async function getDistinctCountries(): Promise<CountryOption[]> {
  const rows = await prisma.$queryRaw<{ geo: string }[]>`
    SELECT DISTINCT "geo"
    FROM "publisher_stats_daily"
    WHERE "geo" != 'XX'
    ORDER BY "geo"
  `;
  return rows.map((r) => ({
    code: r.geo,
    name: COUNTRY_NAMES[r.geo] || r.geo,
  }));
}

// ─── Campaign links for publisher matching ──────────────────────────────────

async function getCampaignLinksForPublishers(
  country?: string,
): Promise<CampaignLinkInfo[]> {
  const where: Prisma.CampaignLinkWhereInput = {};
  if (country) where.country = country;

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

async function getSiteCampaignAssociations(
  siteExternalIds: string[],
  country?: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<Map<string, string[]>> {
  if (siteExternalIds.length === 0) return new Map();

  const conditions: Prisma.Sql[] = [
    Prisma.sql`p."externalId" IN (${Prisma.join(siteExternalIds)})`,
  ];
  if (country) conditions.push(Prisma.sql`psd."geo" = ${country}`);
  if (dateFrom && dateTo) conditions.push(Prisma.sql`psd."date" >= ${dateFrom}::date AND psd."date" <= ${dateTo}::date`);

  const rows = await prisma.$queryRaw<
    { siteExternalId: string; campaignExternalId: string }[]
  >(
    Prisma.sql`
      SELECT DISTINCT p."externalId" as "siteExternalId", c."externalId" as "campaignExternalId"
      FROM "publisher_stats_daily" psd
      JOIN "publishers" p ON p."id" = psd."publisherId"
      JOIN "campaigns" c ON c."id" = psd."campaignId"
      WHERE ${Prisma.join(conditions, " AND ")}
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

// ─── Keitaro stats by site (exact matching via sub_id_3 = site slug) ─────────

type KeitaroSiteStats = { leads: number; revenue: number };

/**
 * Fetch Keitaro stats grouped by campaign_id + sub_id_3.
 * sub_id_3 = utm_source = {site} = Taboola site slug (e.g. "reach-express").
 * Note: sub_id_4 = {site_id} is empty — Taboola doesn't populate numeric site_id.
 *
 * Keitaro sub_id mapping (positional, matches UTM builder):
 *   sub_id_1 = camp      = {campaign_id}
 *   sub_id_2 = cont      = {campaign_item_id}
 *   sub_id_3 = utm_source = {site}        (publisher name)
 *   sub_id_4 = src_id    = {site_id}      (publisher numeric ID) ← THIS
 *   sub_id_5 = utm_medium = {platform}
 *   sub_id_6 = geo       = {country}
 *   sub_id_7 = click_id  = {click_id}
 *   sub_id_8 = network_id = {account_id}
 *   sub_id_9 = headline  = {title}
 *   sub_id_10 = utm_term = {campaign_name}
 *
 * Returns a Map keyed by siteExternalId → { leads, revenue }.
 * Multiple campaigns are aggregated per site.
 */
async function getKeitaroStatsBySite(
  keitaroExternalIds: number[],
  links: CampaignLinkInfo[],
  dateFrom?: string,
  dateTo?: string,
): Promise<Map<string, KeitaroSiteStats> | null> {
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

    // Group by campaign_id + sub_id_3 to get exact per-site stats.
    // sub_id_3 = utm_source = {site} = Taboola site slug (e.g. "reach-express").
    // Note: sub_id_4 = src_id = {site_id} is empty (Taboola doesn't populate it).
    const report = await client.buildReport({
      range: { from, to, timezone: CRM_TIMEZONE },
      grouping: ["campaign_id", "sub_id_3"],
      metrics: ["conversions", "revenue"],
      limit: 100_000,
      offset: 0,
    });

    const idSet = new Set(keitaroExternalIds);

    const map = new Map<string, KeitaroSiteStats>();
    for (const row of report.rows) {
      const campId = Number(row.campaign_id);
      if (!campId || !idSet.has(campId)) continue;

      const siteId = String(row.sub_id_3 ?? "").trim();
      if (!siteId) continue;

      const leads = Number(row.conversions ?? 0);
      const revenue = Number(row.revenue ?? 0);

      const existing = map.get(siteId);
      if (existing) {
        existing.leads += leads;
        existing.revenue += revenue;
      } else {
        map.set(siteId, { leads, revenue });
      }
    }
    return map;
  } catch (err) {
    console.error("[getKeitaroStatsBySite] Keitaro API error:", err);
    return null;
  }
}

// ─── Click distribution helpers ─────────────────────────────────────────────

/** Total clicks per campaign from campaign_stats_daily. */
async function getCampaignClickTotals(
  campaignExternalIds: string[],
  dateFrom?: string,
  dateTo?: string,
): Promise<Map<string, number>> {
  if (campaignExternalIds.length === 0) return new Map();

  const dateClause = dateFrom && dateTo
    ? Prisma.sql`AND csd."date" >= ${dateFrom}::date AND csd."date" <= ${dateTo}::date`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    { externalId: string; clicks: bigint }[]
  >(
    Prisma.sql`
      SELECT c."externalId", SUM(csd."clicks") as clicks
      FROM "campaign_stats_daily" csd
      JOIN "campaigns" c ON c."id" = csd."campaignId"
      WHERE c."externalId" IN (${Prisma.join(campaignExternalIds)})
        ${dateClause}
      GROUP BY c."externalId"
    `,
  );

  const map = new Map<string, number>();
  for (const r of rows) map.set(r.externalId, Number(r.clicks));
  return map;
}

/** Clicks per site per campaign from publisher_stats_daily. */
async function getSiteCampaignClicks(
  siteExternalIds: string[],
  campaignExternalIds: string[],
  dateFrom?: string,
  dateTo?: string,
): Promise<Map<string, number>> {
  if (siteExternalIds.length === 0 || campaignExternalIds.length === 0) return new Map();

  const dateClause = dateFrom && dateTo
    ? Prisma.sql`AND psd."date" >= ${dateFrom}::date AND psd."date" <= ${dateTo}::date`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    { siteExternalId: string; campaignExternalId: string; clicks: bigint }[]
  >(
    Prisma.sql`
      SELECT p."externalId" as "siteExternalId",
             c."externalId" as "campaignExternalId",
             SUM(psd."clicks") as clicks
      FROM "publisher_stats_daily" psd
      JOIN "publishers" p ON p."id" = psd."publisherId"
      JOIN "campaigns" c ON c."id" = psd."campaignId"
      WHERE p."externalId" IN (${Prisma.join(siteExternalIds)})
        AND c."externalId" IN (${Prisma.join(campaignExternalIds)})
        ${dateClause}
      GROUP BY p."externalId", c."externalId"
    `,
  );

  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(`${r.siteExternalId}_${r.campaignExternalId}`, Number(r.clicks));
  }
  return map;
}

// ─── Adspect stats by sub_id (site) ─────────────────────────────────────────

const ADSPECT_CACHE_TTL = 600; // 10 minutes

type AdspectSiteStats = { botPercent: number; adspectClicks: number };

async function getAdspectStatsBySite(
  siteExternalIds: string[],
  dateFrom?: string,
  dateTo?: string,
): Promise<Map<string, AdspectSiteStats> | null> {
  if (siteExternalIds.length === 0) return new Map();

  try {
    const linksWithStreams = await prisma.campaignLink.findMany({
      where: { adspectStreamId: { not: null } },
      select: { adspectStreamId: true },
    });
    const streamIds = Array.from(new Set(
      linksWithStreams.map((l) => l.adspectStreamId!).filter(Boolean),
    ));
    if (streamIds.length === 0) return null;

    const { getAdspectSettings } = await import("@/features/integration-settings/queries");
    const settings = await getAdspectSettings();
    if (!settings.apiKey) return null;

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
    } catch { /* Redis unavailable */ }

    const { AdspectClient } = await import("@/integrations/adspect/client");
    const client = new AdspectClient({ apiKey: settings.apiKey });
    const rows = await client.getFunnelBySite({ streamIds, dateFrom: df, dateTo: dt });

    const map = new Map<string, AdspectSiteStats>();
    for (const row of rows) {
      if (!row.sub_id) continue;
      const totalClicks = row.clicks || 0;
      const botPct = totalClicks > 0 ? (1 - row.quality) * 100 : 0;
      map.set(row.sub_id, {
        botPercent: Math.round(botPct * 10) / 10,
        adspectClicks: totalClicks,
      });
    }

    // Re-key: Adspect sub_id = Taboola numeric site_id (e.g. "1374768").
    // Also add entries keyed by slug (e.g. "reach-express") for easy lookup.
    if (siteExternalIds.length > 0) {
      const pubs = await prisma.$queryRaw<{ externalId: string; numericId: number | null }[]>`
        SELECT "externalId", "numericId" FROM "publishers"
        WHERE "externalId" IN (${Prisma.join(siteExternalIds)})
          AND "numericId" IS NOT NULL
      `;
      for (const p of pubs) {
        if (!p.numericId) continue;
        const numKey = String(p.numericId);
        const stats = map.get(numKey);
        if (stats && !map.has(p.externalId)) {
          map.set(p.externalId, stats);
        }
      }
    }

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

  // If linkedOnly, restrict to campaigns in CampaignLink
  let linkedCampaignIds: string[] | null = null;
  if (linkedOnly) {
    const links = await prisma.campaignLink.findMany({
      select: { taboolaCampaignExternalId: true },
    });
    linkedCampaignIds = Array.from(new Set(links.map((l) => l.taboolaCampaignExternalId)));
    if (linkedCampaignIds.length === 0) return { rows: [], total: 0 };
  }

  // Build WHERE conditions for publisher_stats_daily
  const conditions: Prisma.Sql[] = [];
  // GEO filter: use psd.geo from Taboola API (stored per publisher×campaign×day×country)
  if (country) conditions.push(Prisma.sql`psd."geo" = ${country}`);
  if (dateFrom && dateTo) conditions.push(Prisma.sql`psd."date" >= ${dateFrom}::date AND psd."date" <= ${dateTo}::date`);
  if (linkedCampaignIds) {
    conditions.push(Prisma.sql`c."externalId" IN (${Prisma.join(linkedCampaignIds)})`);
  }

  const whereClause = conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;

  // 1. Total count of distinct publishers
  const countRows = await prisma.$queryRaw<RawCountRow[]>(
    Prisma.sql`
      SELECT COUNT(DISTINCT p."externalId") as total
      FROM "publisher_stats_daily" psd
      JOIN "publishers" p ON p."id" = psd."publisherId"
      JOIN "campaigns" c ON c."id" = psd."campaignId"
      ${whereClause}
    `,
  );
  const total = Number(countRows[0]?.total ?? 0);
  if (total === 0) return { rows: [], total: 0 };

  // 2. Aggregated stats per publisher with commission-adjusted spend
  const rawRows = await prisma.$queryRaw<RawStatsRow[]>(
    Prisma.sql`
      ${ACCT_MULT_CTE}
      SELECT
        p."externalId" as "siteExternalId",
        p."numericId" as "siteNumericId",
        p."name" as "siteName",
        p."domain" as "siteUrl",
        COALESCE(SUM(psd."clicks"), 0) as "clicks",
        COALESCE(SUM(psd."impressions"), 0) as "impressions",
        COALESCE(SUM(psd."spend" * COALESCE(am.multiplier, 1)), 0) as "spend"
      FROM "publisher_stats_daily" psd
      JOIN "publishers" p ON p."id" = psd."publisherId"
      JOIN "campaigns" c ON c."id" = psd."campaignId"
      JOIN "ad_accounts" aa ON aa."id" = c."adAccountId"
      LEFT JOIN acct_mult am ON am."adAccountId" = aa."id"
      ${whereClause}
      GROUP BY p."externalId", p."numericId", p."name", p."domain"
      ORDER BY SUM(psd."spend" * COALESCE(am.multiplier, 1)) DESC
      LIMIT ${perPage} OFFSET ${offset}
    `,
  );

  // 3. Get ALL CampaignLinks (no country filter — GEO is already applied to publisher_stats_daily)
  //    We need all links for Keitaro matching and revenue calculation.
  const links = await getCampaignLinksForPublishers();
  const linkByTaboolaCampaign = new Map(
    links.map((l) => [l.taboolaCampaignExternalId, l]),
  );

  // 4. Site → campaign associations (no country filter — need all campaigns for revenue calc)
  const siteIds = rawRows.map((r) => r.siteExternalId);
  const siteCampaigns = await getSiteCampaignAssociations(siteIds, undefined, dateFrom, dateTo);

  // 5. Keitaro exact matching by sub_id_3 (site slug) + Adspect
  const keitaroExternalIds = Array.from(new Set(links.map((l) => Number(l.keitaroCampaignExternalId)).filter(Boolean)));

  const [keitaroSiteStats, adspectStats] =
    await Promise.all([
      getKeitaroStatsBySite(keitaroExternalIds, links, dateFrom, dateTo),
      // Adspect: always fetch full range — bot% reflects overall publisher quality
      getAdspectStatsBySite(siteIds),
    ]);

  // 6. Merge Taboola + Keitaro (exact site match) + Adspect
  const rows: PublisherStatsRow[] = rawRows.map((r) => {
    const clicks = Number(r.clicks);
    const impressions = Number(r.impressions);
    const spend = Number(r.spend);
    const cpc = clicks > 0 ? spend / clicks : null;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;

    // Exact match: Keitaro sub_id = Taboola site external ID
    const ks = keitaroSiteStats?.get(r.siteExternalId) ?? null;

    let leads: number | null = null;
    let revenue: number | null = null;

    if (ks) {
      leads = ks.leads;
      // Calculate revenue based on payment model of linked campaigns
      const campaigns = siteCampaigns.get(r.siteExternalId) ?? [];
      let totalRevenue = 0;
      for (const campaignExternalId of campaigns) {
        const link = linkByTaboolaCampaign.get(campaignExternalId);
        if (!link) continue;
        if (link.paymentModel === "CPL" && link.cplRate !== null) {
          totalRevenue = ks.leads * link.cplRate;
        } else if (link.paymentModel === "CPA") {
          totalRevenue = ks.revenue;
        }
      }
      revenue = totalRevenue;
    }
    const profit = revenue !== null ? revenue - spend : null;
    const roi = revenue !== null && spend > 0 ? ((revenue - spend) / spend) * 100 : null;

    // Adspect: match by siteExternalId → numericId → siteName → domain
    let adspect = adspectStats?.get(r.siteExternalId) ?? null;
    if (!adspect && r.siteNumericId && adspectStats) {
      adspect = adspectStats.get(String(r.siteNumericId)) ?? null;
    }
    if (!adspect && adspectStats) {
      adspect = adspectStats.get(r.siteName) ?? null;
    }
    if (!adspect && r.siteUrl && adspectStats) {
      adspect = adspectStats.get(r.siteUrl) ?? null;
    }
    const botPercent = adspect?.botPercent ?? null;
    const clickDiscrepancy = adspect ? clicks - adspect.adspectClicks : null;

    return {
      siteExternalId: r.siteExternalId,
      siteNumericId: r.siteNumericId,
      siteName: r.siteName,
      siteUrl: r.siteUrl,
      clicks, impressions, spend, cpc, ctr,
      leads, revenue, profit, roi,
      botPercent, clickDiscrepancy,
    };
  });

  return { rows, total };
}

// ─── Daily trends for sparklines ─────────────────────────────────────────────

export type SiteTrends = {
  roiTrend: number[];
  botTrend: number[];
};

export async function getPublisherDailyTrends(
  siteExternalIds: string[],
): Promise<Map<string, SiteTrends>> {
  if (siteExternalIds.length === 0) return new Map();

  const today = todayCrm();
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const fromDate = new Date(todayDate);
  fromDate.setUTCDate(fromDate.getUTCDate() - 6);
  const dateFrom = toApiDate(fromDate);
  const dateTo = today;

  const dayLabels: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(fromDate);
    d.setUTCDate(d.getUTCDate() + i);
    dayLabels.push(toApiDate(d));
  }

  // 1. Daily spend + clicks per site from publisher_stats_daily (with commission)
  type RawDailyRow = {
    date: Date;
    siteExternalId: string;
    clicks: bigint;
    spend: unknown;
  };

  const dailySpend = await prisma.$queryRaw<RawDailyRow[]>(
    Prisma.sql`
      ${ACCT_MULT_CTE}
      SELECT
        psd."date",
        p."externalId" as "siteExternalId",
        COALESCE(SUM(psd."clicks"), 0) as "clicks",
        COALESCE(SUM(psd."spend" * COALESCE(am.multiplier, 1)), 0) as "spend"
      FROM "publisher_stats_daily" psd
      JOIN "publishers" p ON p."id" = psd."publisherId"
      JOIN "campaigns" c ON c."id" = psd."campaignId"
      JOIN "ad_accounts" aa ON aa."id" = c."adAccountId"
      LEFT JOIN acct_mult am ON am."adAccountId" = aa."id"
      WHERE p."externalId" IN (${Prisma.join(siteExternalIds)})
        AND psd."date" >= ${dateFrom}::date
        AND psd."date" <= ${dateTo}::date
      GROUP BY psd."date", p."externalId"
    `,
  );

  const spendByDay = new Map<string, Map<string, { spend: number; clicks: number }>>();
  for (const r of dailySpend) {
    const day = r.date instanceof Date ? toApiDate(r.date) : String(r.date).slice(0, 10);
    const siteId = r.siteExternalId;
    if (!spendByDay.has(siteId)) spendByDay.set(siteId, new Map());
    spendByDay.get(siteId)!.set(day, { spend: Number(r.spend), clicks: Number(r.clicks) });
  }

  // 2. Keitaro daily revenue per site (exact matching via sub_id = site_id)
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

        // Group by day + sub_id_3 for exact per-site daily stats
        // sub_id_3 = utm_source = {site} (Taboola publisher slug)
        const report = await client.buildReport({
          range: { from: dateFrom, to: dateTo, timezone: CRM_TIMEZONE },
          grouping: ["day", "campaign_id", "sub_id_3"],
          metrics: ["conversions", "revenue"],
          limit: 100_000,
          offset: 0,
        });

        const idSet = new Set(keitaroIds);
        // Find a CPL rate from any linked campaign (for revenue calculation)
        let defaultCplRate: number | null = null;
        let defaultPaymentModel = "CPL";
        for (const l of links) {
          if (l.paymentModel === "CPL" && l.cplRate) {
            defaultCplRate = Number(l.cplRate);
            defaultPaymentModel = "CPL";
            break;
          } else if (l.paymentModel === "CPA") {
            defaultPaymentModel = "CPA";
            break;
          }
        }

        for (const row of report.rows) {
          const campId = Number(row.campaign_id);
          const day = String(row.day ?? "").trim();
          const siteId = String(row.sub_id_3 ?? "").trim();
          if (!campId || !day || !siteId || !idSet.has(campId)) continue;

          const leads = Number(row.conversions ?? 0);
          const rawRevenue = Number(row.revenue ?? 0);

          let rev = 0;
          if (defaultPaymentModel === "CPL" && defaultCplRate !== null) {
            rev = leads * defaultCplRate;
          } else if (defaultPaymentModel === "CPA") {
            rev = rawRevenue;
          }

          if (!revenueByDay.has(siteId)) revenueByDay.set(siteId, new Map());
          const siteDayMap = revenueByDay.get(siteId)!;
          const existing = siteDayMap.get(day) ?? { leads: 0, revenue: 0 };
          siteDayMap.set(day, {
            leads: existing.leads + leads,
            revenue: existing.revenue + rev,
          });
        }
      }
    }
  } catch (err) {
    console.error("[getPublisherDailyTrends] Keitaro error:", err);
  }

  // 3. Adspect daily bot%
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

  // 3b. Build numericId → slug lookup for Adspect matching
  //     Adspect sub_id = Taboola numeric site_id (e.g. "1374768")
  //     Our keys are siteExternalId = slug (e.g. "reach-express")
  const numericToSlug = new Map<string, string>();
  if (botByDay.size > 0) {
    const pubs = await prisma.$queryRaw<{ externalId: string; numericId: number | null }[]>`
      SELECT "externalId", "numericId" FROM "publishers"
      WHERE "externalId" IN (${Prisma.join(siteExternalIds)})
        AND "numericId" IS NOT NULL
    `;
    for (const p of pubs) {
      if (p.numericId) numericToSlug.set(String(p.numericId), p.externalId);
    }
    // Re-key botByDay entries from numeric ID to slug
    for (const [numId, dayMap] of Array.from(botByDay.entries())) {
      const slug = numericToSlug.get(numId);
      if (slug && !botByDay.has(slug)) {
        botByDay.set(slug, dayMap);
      }
    }
  }

  // 4. Merge into SiteTrends
  const result = new Map<string, SiteTrends>();

  for (const siteId of siteExternalIds) {
    const spendDays = spendByDay.get(siteId);
    const revDays = revenueByDay.get(siteId);
    const botDays = botByDay.get(siteId);

    const roiTrend: number[] = [];
    if (spendDays && revDays) {
      for (const day of dayLabels) {
        const s = spendDays.get(day);
        const r = revDays.get(day);
        if (s && s.spend > 0 && r) {
          roiTrend.push(Math.round(((r.revenue - s.spend) / s.spend) * 1000) / 10);
        } else if (s && s.spend > 0) {
          roiTrend.push(-100);
        }
      }
    }

    const botTrend: number[] = [];
    if (botDays) {
      for (const day of dayLabels) {
        const bp = botDays.get(day);
        if (bp !== undefined) botTrend.push(bp);
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
