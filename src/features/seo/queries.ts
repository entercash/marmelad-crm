import { prisma } from "@/lib/prisma";

// ─── Types ───────────────────────────────────────────────────────────────────

export type SeoBrandRow = {
  id: string;
  name: string;
  link: string;
  createdAt: Date;
  totalLeads: number;
  totalRevenue: number;
};

export type SeoLeadRow = {
  id: string;
  seoBrandId: string;
  date: Date;
  quantity: number;
  country: string;
  paymentModel: string;
  rate: number;
  revenue: number;
  createdAt: Date;
};

// ─── Brand queries ───────────────────────────────────────────────────────────

export async function getSeoBrands(): Promise<SeoBrandRow[]> {
  const brands = await prisma.seoBrand.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      leads: {
        select: { quantity: true, rate: true },
      },
    },
  });

  return brands.map((b) => {
    let totalLeads = 0;
    let totalRevenue = 0;
    for (const lead of b.leads) {
      totalLeads += lead.quantity;
      totalRevenue += lead.quantity * Number(lead.rate);
    }
    return {
      id: b.id,
      name: b.name,
      link: b.link,
      createdAt: b.createdAt,
      totalLeads,
      totalRevenue,
    };
  });
}

// ─── Lead queries ────────────────────────────────────────────────────────────

export async function getSeoLeads(brandId: string): Promise<SeoLeadRow[]> {
  const leads = await prisma.seoLead.findMany({
    where: { seoBrandId: brandId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return leads.map((l) => ({
    id: l.id,
    seoBrandId: l.seoBrandId,
    date: l.date,
    quantity: l.quantity,
    country: l.country,
    paymentModel: l.paymentModel,
    rate: Number(l.rate),
    revenue: l.quantity * Number(l.rate),
    createdAt: l.createdAt,
  }));
}

// ─── Dashboard aggregation ───────────────────────────────────────────────────

/** Total SEO revenue across all leads. Used by getDashboardSummary(). */
export async function getSeoTotalRevenue(): Promise<number> {
  const leads = await prisma.seoLead.findMany({
    select: { quantity: true, rate: true },
  });

  let total = 0;
  for (const l of leads) {
    total += l.quantity * Number(l.rate);
  }
  return total;
}
