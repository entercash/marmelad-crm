/**
 * ConversionStatsDaily upsert service.
 * Normalizes Keitaro report rows into our conversion_stats_daily schema.
 *
 * KEY DESIGN RULE:
 * Conversion stats are stored with source="keitaro" and the Keitaro campaign ID
 * as externalCampaignId. They are NEVER joined with Taboola data here.
 * The join happens at P&L computation time via campaign_mappings.
 *
 * Revenue handling:
 * - grossRevenue = revenue as returned by Keitaro (pre-rejection basis)
 * - netRevenue = same as gross in MVP (Keitaro's revenue field is post-rejection)
 *   Phase 2: differentiate if Keitaro exposes separate gross/net fields.
 *
 * GEO normalization: Keitaro may return "" for unknown country → "XX".
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fromApiDate } from "@/lib/date";
import type { KeitaroReportRow } from "@/integrations/keitaro";
import type { SyncCounter } from "@/services/sync/types";

const CHUNK_SIZE = 100;
const SOURCE = "keitaro";

// ─── Normalization helpers ────────────────────────────────────────────────────

/** Keitaro may return numeric values as strings. Always parse safely. */
function toInt(value: number | string | undefined): number {
  if (value === undefined || value === null) return 0;
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  return isNaN(n) ? 0 : Math.max(0, n);
}

function toDecimal(value: number | string | undefined): Prisma.Decimal {
  if (value === undefined || value === null) return new Prisma.Decimal(0);
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return new Prisma.Decimal(0);
  return new Prisma.Decimal(Math.max(0, n));
}

function normalizeGeo(country: string | undefined): string {
  if (!country) return "XX";
  const trimmed = country.trim().toUpperCase();
  return trimmed.length === 2 ? trimmed : "XX";
}

// ─── Row validation ───────────────────────────────────────────────────────────

/**
 * A valid row must have: campaign_id, day, and at least one metric.
 * Rows without campaign_id or day cannot be stored (no unique key).
 */
function isValidRow(row: KeitaroReportRow): boolean {
  return (
    typeof row.campaign_id === "string" &&
    row.campaign_id.trim().length > 0 &&
    typeof row.day === "string" &&
    row.day.trim().length > 0
  );
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

/**
 * Upsert daily conversion stats from Keitaro.
 * Rows are keyed on (source, externalCampaignId, date, geo).
 */
export async function upsertConversionStats(
  rows: KeitaroReportRow[],
): Promise<Partial<SyncCounter>> {
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  const validRows = rows.filter(isValidRow);
  skipped = rows.length - validRows.length;

  for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
    const chunk = validRows.slice(i, i + CHUNK_SIZE);

    try {
      await prisma.$transaction(
        chunk.map((row) => {
          const externalCampaignId = row.campaign_id!.trim();
          const date = fromApiDate(row.day!.trim());
          const geo = normalizeGeo(row.country);

          const leads = toInt(row.leads);
          const sales = toInt(row.sales);
          const rejected = toInt(row.rejected);
          // Pending = total received - approved - rejected (floor at 0)
          const pending = Math.max(0, leads - sales - rejected);

          const revenue = toDecimal(row.revenue);

          return prisma.conversionStatsDaily.upsert({
            where: {
              source_externalCampaignId_date_geo: {
                source: SOURCE,
                externalCampaignId,
                date,
                geo,
              },
            },
            update: {
              clicks: toInt(row.clicks),
              conversions: leads,
              approvedConversions: sales,
              pendingConversions: pending,
              rejectedConversions: rejected,
              // In MVP, gross == net (Keitaro reports post-rejection revenue)
              grossRevenue: revenue,
              netRevenue: revenue,
            },
            create: {
              source: SOURCE,
              externalCampaignId,
              date,
              geo,
              clicks: toInt(row.clicks),
              conversions: leads,
              approvedConversions: sales,
              pendingConversions: pending,
              rejectedConversions: rejected,
              grossRevenue: revenue,
              netRevenue: revenue,
            },
            select: { id: true },
          });
        }),
      );

      updated += chunk.length;
    } catch (err) {
      // Log chunk-level failure but continue processing remaining chunks
      console.error(
        `[upsert:conversion-stats] Chunk at index ${i} failed:`,
        err,
      );
      failed += chunk.length;
    }
  }

  return { updated, skipped, failed };
}
