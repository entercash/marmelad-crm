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
  createdAt: Date;
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
    country: l.country,
    createdAt: l.createdAt,
  }));
}

// ─── Stats aggregation ──────────────────────────────────────────────────────

/** Aggregate Taboola stats by campaignExternalId. */
async function getTaboolaStatsByCampaign(
  externalIds: string[],
  dateFrom?: string,
  dateTo?: string,
): Promise<
  Map<string, { clicks: number; spend: number; impressions: number }>
> {
  if (externalIds.length === 0) return new Map();

  const where: Prisma.TaboolaCsvRowWhereInput = {
    campaignExternalId: { in: externalIds },
  };
  if (dateFrom && dateTo) {
    where.day = {
      gte: new Date(`${dateFrom}T00:00:00.000Z`),
      lte: new Date(`${dateTo}T00:00:00.000Z`),
    };
  }

  const rows = await prisma.taboolaCsvRow.groupBy({
    by: ["campaignExternalId"],
    where,
    _sum: { clicks: true, spentUsd: true, impressions: true },
  });

  const map = new Map<
    string,
    { clicks: number; spend: number; impressions: number }
  >();
  for (const r of rows) {
    map.set(r.campaignExternalId, {
      clicks: r._sum.clicks ?? 0,
      spend: Number(r._sum.spentUsd ?? 0),
      impressions: r._sum.impressions ?? 0,
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

    // Fetch all campaigns (IN_LIST filter doesn't work for campaign_id in Keitaro),
    // then filter results in code.
    const report = await client.buildReport({
      range: { from: dateFrom, to: dateTo, timezone: CRM_TIMEZONE },
      grouping: ["campaign_id"],
      metrics: ["clicks", "conversions", "sales", "revenue"],
      limit: 10_000,
      offset: 0,
    });

    const idSet = new Set(keitaroExternalIds);
    const map = new Map<number, { clicks: number; leads: number; sales: number; revenue: number }>();
    for (const row of report.rows) {
      const campId = Number(row.campaign_id);
      if (!campId || !idSet.has(campId)) continue;
      map.set(campId, {
        clicks: Number(row.clicks ?? 0),
        leads: Number(row.conversions ?? 0),
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

/** Get commission multiplier per campaign via CSV account → agency chain. */
async function getCommissionMultipliers(
  campaignExternalIds: string[],
): Promise<Map<string, number>> {
  if (campaignExternalIds.length === 0) return new Map();

  // 1. Get accountExternalId for each campaign
  const campAcctRows = await prisma.$queryRaw<
    { campaignExternalId: string; accountExternalId: string }[]
  >`
    SELECT DISTINCT ON ("campaignExternalId")
      "campaignExternalId", "accountExternalId"
    FROM "taboola_csv_rows"
    WHERE "campaignExternalId" IN (${Prisma.join(campaignExternalIds)})
    ORDER BY "campaignExternalId"
  `;

  // 2. Get accounts with agency commissions
  const acctExtIdSet = new Set(campAcctRows.map((r) => r.accountExternalId));
  const acctExtIds = Array.from(acctExtIdSet);

  const accounts = await prisma.account.findMany({
    where: { externalId: { in: acctExtIds } },
    select: {
      externalId: true,
      agency: {
        select: { commissionPercent: true, cryptoPaymentPercent: true },
      },
    },
  });

  // 3. Build account → multiplier map
  const acctMultMap = new Map<string, number>();
  for (const a of accounts) {
    if (!a.externalId) continue;
    const commPct = a.agency?.commissionPercent ? Number(a.agency.commissionPercent) : 0;
    const cryptoPct = a.agency?.cryptoPaymentPercent ? Number(a.agency.cryptoPaymentPercent) : 0;
    acctMultMap.set(a.externalId, (1 + commPct / 100) * (1 + cryptoPct / 100));
  }

  // 4. Map campaign → multiplier
  const result = new Map<string, number>();
  for (const r of campAcctRows) {
    result.set(r.campaignExternalId, acctMultMap.get(r.accountExternalId) ?? 1);
  }
  return result;
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

  // Keitaro stats
  const keitaroIdSet = new Set(links.map((l) => l.keitaroCampaignExternalId));
  const keitaroIds = Array.from(keitaroIdSet);
  const from = dateFrom ?? "2024-01-01";
  const to = dateTo ?? todayCrm();
  let keitaroStats: Map<
    number,
    { clicks: number; leads: number; sales: number; revenue: number }
  > | null = null;
  if (keitaroIds.length > 0) {
    keitaroStats = await getKeitaroStatsForCampaigns(keitaroIds, from, to);
  }

  // Merge
  return links.map((link) => {
    const ts = taboolaStats.get(link.taboolaCampaignExternalId);
    const ks = keitaroStats?.get(link.keitaroCampaignExternalId) ?? null;

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
