/**
 * Publishers data-access layer (v2 — CSV aggregation).
 *
 * Aggregates Taboola CSV import data per site/publisher,
 * optionally matched with Keitaro leads via sub_id.
 *
 * Called only from the Publishers Server Component — never imported by client code.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { KeitaroClient } from "@/integrations/keitaro/client";
import { getKeitaroSettings } from "@/features/integration-settings/queries";

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

// ─── Keitaro sub_id stats ───────────────────────────────────────────────────

/** Fetch Keitaro stats grouped by sub_id for publisher matching. Returns null on error. */
async function getKeitaroStatsBySubId(): Promise<
  Map<string, { leads: number; revenue: number }> | null
> {
  try {
    const settings = await getKeitaroSettings();
    if (!settings.apiUrl || !settings.apiKey) return null;

    const client = new KeitaroClient({
      apiUrl: settings.apiUrl,
      apiKey: settings.apiKey,
    });

    const from = "2024-01-01";
    const to = new Date().toISOString().slice(0, 10);

    const report = await client.buildReport({
      range: { from, to, timezone: "UTC" },
      grouping: ["sub_id"],
      metrics: ["conversions", "revenue"],
      limit: 10_000,
      offset: 0,
    });

    const map = new Map<string, { leads: number; revenue: number }>();
    for (const row of report.rows) {
      const subId = String(row.sub_id ?? "").trim();
      if (!subId) continue;
      map.set(subId, {
        leads: Number(row.conversions ?? 0),
        revenue: Number(row.revenue ?? 0),
      });
    }
    return map;
  } catch (err) {
    console.error("[getKeitaroStatsBySubId] Keitaro API error:", err);
    return null;
  }
}

// ─── Main stats query ───────────────────────────────────────────────────────

/** Get publisher stats aggregated from TaboolaCsvRow, with optional country filter and pagination. */
export async function getPublisherStats(params: {
  country?: string;
  page?: number;
  perPage?: number;
}): Promise<PublisherStatsResult> {
  const { country, page = 1, perPage = 50 } = params;
  const offset = (page - 1) * perPage;

  // Build conditional WHERE clause
  const whereClause = country
    ? Prisma.sql`WHERE "countryCode" = ${country}`
    : Prisma.empty;

  // Total count of distinct sites
  const countRows = await prisma.$queryRaw<RawCountRow[]>(
    Prisma.sql`
      SELECT COUNT(DISTINCT "siteExternalId") as total
      FROM "taboola_csv_rows"
      ${whereClause}
    `,
  );
  const total = Number(countRows[0]?.total ?? 0);

  if (total === 0) {
    return { rows: [], total: 0 };
  }

  // Aggregated stats per site
  const rawRows = await prisma.$queryRaw<RawStatsRow[]>(
    Prisma.sql`
      SELECT
        "siteExternalId",
        MAX("siteName") as "siteName",
        MAX("siteUrl") as "siteUrl",
        COALESCE(SUM("clicks"), 0) as "clicks",
        COALESCE(SUM("impressions"), 0) as "impressions",
        COALESCE(SUM("spentUsd"), 0) as "spend"
      FROM "taboola_csv_rows"
      ${whereClause}
      GROUP BY "siteExternalId"
      ORDER BY SUM("spentUsd") DESC
      LIMIT ${perPage} OFFSET ${offset}
    `,
  );

  // Keitaro leads by sub_id (fetched once, cached for this request)
  const keitaroStats = await getKeitaroStatsBySubId();

  // Merge Taboola + Keitaro data
  const rows: PublisherStatsRow[] = rawRows.map((r) => {
    const clicks = Number(r.clicks);
    const impressions = Number(r.impressions);
    const spend = Number(r.spend);
    const cpc = clicks > 0 ? spend / clicks : null;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;

    // Match Keitaro data by siteExternalId or siteName
    const ks =
      keitaroStats?.get(r.siteExternalId) ??
      keitaroStats?.get(r.siteName) ??
      null;

    const leads = ks?.leads ?? null;
    const revenue = ks?.revenue ?? null;
    const profit = revenue !== null ? revenue - spend : null;
    const roi =
      revenue !== null && spend > 0
        ? ((revenue - spend) / spend) * 100
        : null;

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
    };
  });

  return { rows, total };
}
