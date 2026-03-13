import { prisma } from "@/lib/prisma";
import { KeitaroClient } from "@/integrations/keitaro/client";
import { getKeitaroSettings } from "@/features/integration-settings/queries";

// ─── Types ──────────────────────────────────────────────────────────────────

export type TaboolaCampaignOption = {
  campaignExternalId: string;
  campaignName: string;
};

export type KeitaroCampaignOption = {
  id: string;
  externalId: number;
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
  createdAt: Date;
};

export type CampaignStatsRow = {
  linkId: string;
  taboolaCampaignName: string;
  keitaroCampaignName: string;
  paymentModel: string;
  cplRate: number | null;
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
  roi: number | null;
};

// ─── Dropdown queries ───────────────────────────────────────────────────────

/** Get distinct Taboola campaigns from CSV data (for mapping dropdown). */
export async function getDistinctTaboolaCampaigns(): Promise<TaboolaCampaignOption[]> {
  const rows = await prisma.$queryRaw<
    { campaignExternalId: string; campaignName: string }[]
  >`
    SELECT DISTINCT ON ("campaignExternalId")
      "campaignExternalId",
      "campaignName"
    FROM "taboola_csv_rows"
    ORDER BY "campaignExternalId", "day" DESC
  `;
  return rows;
}

/** Get Keitaro campaigns for mapping dropdown. */
export async function getKeitaroCampaignOptions(): Promise<KeitaroCampaignOption[]> {
  const campaigns = await prisma.keitaroCampaign.findMany({
    orderBy: [{ state: "asc" }, { name: "asc" }],
    select: { id: true, externalId: true, name: true, state: true },
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
    createdAt: l.createdAt,
  }));
}

// ─── Stats aggregation ──────────────────────────────────────────────────────

/** Aggregate Taboola stats by campaignExternalId. */
async function getTaboolaStatsByCampaign(
  externalIds: string[],
): Promise<
  Map<string, { clicks: number; spend: number; impressions: number; minDay: Date; maxDay: Date }>
> {
  if (externalIds.length === 0) return new Map();

  const rows = await prisma.taboolaCsvRow.groupBy({
    by: ["campaignExternalId"],
    where: { campaignExternalId: { in: externalIds } },
    _sum: { clicks: true, spentUsd: true, impressions: true },
    _min: { day: true },
    _max: { day: true },
  });

  const map = new Map<
    string,
    { clicks: number; spend: number; impressions: number; minDay: Date; maxDay: Date }
  >();
  for (const r of rows) {
    map.set(r.campaignExternalId, {
      clicks: r._sum.clicks ?? 0,
      spend: Number(r._sum.spentUsd ?? 0),
      impressions: r._sum.impressions ?? 0,
      minDay: r._min.day!,
      maxDay: r._max.day!,
    });
  }
  return map;
}

/** Fetch Keitaro stats from Reports API for mapped campaigns. Returns null on error. */
async function getKeitaroStatsForCampaigns(
  keitaroExternalIds: number[],
  dateFrom: string,
  dateTo: string,
): Promise<Map<number, { clicks: number; leads: number; sales: number; revenue: number }> | null> {
  if (keitaroExternalIds.length === 0) return new Map();

  try {
    const settings = await getKeitaroSettings();
    if (!settings.apiUrl || !settings.apiKey) return null;

    const client = new KeitaroClient({
      apiUrl: settings.apiUrl,
      apiKey: settings.apiKey,
    });

    const report = await client.buildReport({
      range: { from: dateFrom, to: dateTo, timezone: "UTC" },
      grouping: ["campaign_id"],
      metrics: ["clicks", "leads", "sales", "revenue"],
      filters: [
        {
          name: "campaign_id",
          operator: "IN",
          values: keitaroExternalIds.map(String),
        },
      ],
      limit: 10_000,
      offset: 0,
    });

    const map = new Map<number, { clicks: number; leads: number; sales: number; revenue: number }>();
    for (const row of report.rows) {
      const campId = Number(row.campaign_id);
      if (!campId) continue;
      map.set(campId, {
        clicks: Number(row.clicks ?? 0),
        leads: Number(row.leads ?? 0),
        sales: Number(row.sales ?? 0),
        revenue: Number(row.revenue ?? 0),
      });
    }
    return map;
  } catch (err) {
    console.error("[getKeitaroStatsForCampaigns] Keitaro API error:", err);
    return null;
  }
}

// ─── Combined stats (main page query) ───────────────────────────────────────

/** Get all campaign links with merged Taboola + Keitaro stats. */
export async function getCampaignLinkStats(): Promise<CampaignStatsRow[]> {
  const links = await getCampaignLinks();
  if (links.length === 0) return [];

  // Taboola stats
  const taboolaIdSet = new Set(links.map((l) => l.taboolaCampaignExternalId));
  const taboolaIds = Array.from(taboolaIdSet);
  const taboolaStats = await getTaboolaStatsByCampaign(taboolaIds);

  // Determine global date range
  let globalMinDay: Date | null = null;
  let globalMaxDay: Date | null = null;
  taboolaStats.forEach((stats) => {
    if (!globalMinDay || stats.minDay < globalMinDay) globalMinDay = stats.minDay;
    if (!globalMaxDay || stats.maxDay > globalMaxDay) globalMaxDay = stats.maxDay;
  });

  // Keitaro stats (may return null if API unreachable)
  let keitaroStats: Map<
    number,
    { clicks: number; leads: number; sales: number; revenue: number }
  > | null = null;
  if (globalMinDay && globalMaxDay) {
    const keitaroIdSet = new Set(links.map((l) => l.keitaroCampaignExternalId));
    const keitaroIds = Array.from(keitaroIdSet);
    const minDay: Date = globalMinDay;
    const maxDay: Date = globalMaxDay;
    const from = minDay.toISOString().slice(0, 10);
    const to = maxDay.toISOString().slice(0, 10);
    keitaroStats = await getKeitaroStatsForCampaigns(keitaroIds, from, to);
  }

  // Merge
  return links.map((link) => {
    const ts = taboolaStats.get(link.taboolaCampaignExternalId);
    const ks = keitaroStats?.get(link.keitaroCampaignExternalId) ?? null;

    const spend = ts?.spend ?? 0;
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

    // ROI = (revenue - spend) / spend × 100
    const roi =
      revenue !== null && spend > 0 ? ((revenue - spend) / spend) * 100 : null;

    return {
      linkId: link.id,
      taboolaCampaignName: link.taboolaCampaignName,
      keitaroCampaignName: link.keitaroCampaignName,
      paymentModel: link.paymentModel,
      cplRate: link.cplRate,
      clicks: ts?.clicks ?? 0,
      spend,
      impressions: ts?.impressions ?? 0,
      leads,
      sales,
      keitaroRevenue,
      cpl,
      revenue,
      roi,
    };
  });
}
