"use server";

/**
 * CSV Import — server action for Taboola CSV file import.
 *
 * Workflow:
 *  1. guardWrite() — check permissions
 *  2. Read file from FormData
 *  3. Parse CSV via parser.ts
 *  4. Create SyncLog (source: "taboola-csv")
 *  5. Bulk upsert via raw SQL (ON CONFLICT DO UPDATE) in chunks of 500
 *  6. Complete SyncLog with counters
 *  7. Revalidate page cache
 */

import { revalidatePath } from "next/cache";
import { Prisma }         from "@prisma/client";

import { prisma }     from "@/lib/prisma";
import { guardWrite } from "@/lib/auth-guard";
import { getHistoricalRates, findRateForDate, toUsd } from "@/lib/fx-rates";
import { parseTaboolaCsv } from "./parser";
import type { TaboolaCsvRowInput } from "./parser";

// ─── Result type ────────────────────────────────────────────────────────────

export type ImportResult =
  | { success: true;  totalRows: number; upserted: number; parseErrors: string[] }
  | { success: false; error: string; parseErrors?: string[] };

// ─── SQL builder (parameterized) ─────────────────────────────────────────────

const UPSERT_COLUMNS = [
  "id", "day", "campaignExternalId", "adExternalId", "siteExternalId",
  "countryCode", "accountName", "accountExternalId", "campaignName",
  "campaignStatus", "campaignBid", "campaignBidStrategy", "campaignStartDate",
  "conversionGoal", "campaignBudgetType", "campaignBudget", "spendingLimit",
  "spendingLimitType", "adTitle", "adDescription", "adStatus", "siteName",
  "siteUrl", "country", "currency", "inventoryType", "spent", "spentUsd",
  "clicks", "impressions", "conversions", "conversionsValue", "servedAds",
  "actualCpc", "actualCpa", "cpm", "ctr", "conversionRate", "roas",
  "syncLogId", "createdAt", "updatedAt",
] as const;

const CONFLICT_COLUMNS = [
  "day", "campaignExternalId", "adExternalId", "siteExternalId", "countryCode",
];

// Columns to update on conflict (everything except PK and unique key)
const UPDATE_COLUMNS = UPSERT_COLUMNS.filter(
  (c) => c !== "id" && c !== "createdAt" && !CONFLICT_COLUMNS.includes(c),
);

// Pre-built SQL fragments for column/conflict/update lists (static, safe to use Prisma.raw)
const COLUMN_LIST_SQL  = Prisma.raw(UPSERT_COLUMNS.map((c) => `"${c}"`).join(", "));
const CONFLICT_LIST_SQL = Prisma.raw(CONFLICT_COLUMNS.map((c) => `"${c}"`).join(", "));
const UPDATE_SET_SQL   = Prisma.raw(UPDATE_COLUMNS.map((c) => `"${c}" = EXCLUDED."${c}"`).join(", "));

function generateCuid(): string {
  // Simple cuid-like ID: timestamp + random (good enough for bulk inserts)
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return `c${ts}${rand}`;
}

/** Formats a Date as "YYYY-MM-DD" for FX rate lookups. */
function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Builds a fully parameterized INSERT … ON CONFLICT DO UPDATE query.
 * All values are passed as query parameters — no string interpolation of user data.
 */
function buildBulkUpsertQuery(
  rows: TaboolaCsvRowInput[],
  syncLogId: string,
  spentUsdMap: Map<TaboolaCsvRowInput, number>,
): Prisma.Sql {
  const now = new Date();

  const rowFragments = rows.map((r) => {
    const id = generateCuid();
    const spentUsd = Math.round((spentUsdMap.get(r) ?? r.spent) * 100) / 100;

    return Prisma.sql`(
      ${id},
      ${r.day},
      ${r.campaignExternalId},
      ${r.adExternalId},
      ${r.siteExternalId},
      ${r.countryCode},
      ${r.accountName},
      ${r.accountExternalId},
      ${r.campaignName},
      ${r.campaignStatus},
      ${r.campaignBid},
      ${r.campaignBidStrategy},
      ${r.campaignStartDate},
      ${r.conversionGoal},
      ${r.campaignBudgetType},
      ${r.campaignBudget},
      ${r.spendingLimit},
      ${r.spendingLimitType},
      ${r.adTitle},
      ${r.adDescription},
      ${r.adStatus},
      ${r.siteName},
      ${r.siteUrl},
      ${r.country},
      ${r.currency},
      ${r.inventoryType},
      ${r.spent},
      ${spentUsd},
      ${r.clicks},
      ${r.impressions},
      ${r.conversions},
      ${r.conversionsValue},
      ${r.servedAds},
      ${r.actualCpc},
      ${r.actualCpa},
      ${r.cpm},
      ${r.ctr},
      ${r.conversionRate},
      ${r.roas},
      ${syncLogId},
      ${now},
      ${now}
    )`;
  });

  return Prisma.sql`
    INSERT INTO "taboola_csv_rows" (${COLUMN_LIST_SQL})
    VALUES ${Prisma.join(rowFragments)}
    ON CONFLICT (${CONFLICT_LIST_SQL})
    DO UPDATE SET ${UPDATE_SET_SQL}
  `;
}

// ─── Chunk helper ───────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ─── Main action ────────────────────────────────────────────────────────────

const CHUNK_SIZE = 500;

export async function importTaboolaCsv(formData: FormData): Promise<ImportResult> {
  // Auth check
  const denied = await guardWrite();
  if (denied) return { success: false, error: !denied.success ? denied.error : "Access denied" };

  // Read file
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { success: false, error: "No file uploaded" };
  }

  if (!file.name.endsWith(".csv")) {
    return { success: false, error: "Only .csv files are accepted" };
  }

  const csvText = await file.text();
  if (!csvText.trim()) {
    return { success: false, error: "File is empty" };
  }

  // Parse CSV
  const { rows, errors: parseErrors } = parseTaboolaCsv(csvText);

  if (rows.length === 0) {
    return {
      success: false,
      error: parseErrors.length > 0
        ? `No valid rows found. ${parseErrors[0]}`
        : "No valid rows found in CSV",
      parseErrors,
    };
  }

  // Create SyncLog
  const syncLog = await prisma.syncLog.create({
    data: {
      source:     "taboola-csv",
      entityType: "stats",
      status:     "RUNNING",
      startedAt:  new Date(),
      meta: {
        fileName:   file.name,
        fileSize:   file.size,
        totalRows:  rows.length,
        parseErrors: parseErrors.length,
      },
    },
  });

  // ── Fetch historical FX rates for the date range in this CSV ─────────
  let spentUsdMap = new Map<TaboolaCsvRowInput, number>();

  try {
    // Find date range and unique currencies
    let minDate = rows[0].day;
    let maxDate = rows[0].day;
    const currencies = new Set<string>();
    for (const r of rows) {
      if (r.day < minDate) minDate = r.day;
      if (r.day > maxDate) maxDate = r.day;
      currencies.add(r.currency);
    }

    // Only fetch historical rates if there are non-USD currencies
    const needsFx = Array.from(currencies).some((c) => c !== "USD");

    if (needsFx) {
      const historicalRates = await getHistoricalRates(minDate, maxDate);

      for (const r of rows) {
        if (r.currency === "USD") {
          spentUsdMap.set(r, r.spent);
        } else {
          const dateKey = toDateStr(r.day);
          const rate = findRateForDate(dateKey, r.currency, historicalRates);
          spentUsdMap.set(r, toUsd(r.spent, r.currency, { [r.currency]: rate }));
        }
      }
    } else {
      // All USD — no conversion needed
      for (const r of rows) {
        spentUsdMap.set(r, r.spent);
      }
    }
  } catch (err) {
    console.warn("[importTaboolaCsv] FX rate fetch failed, using spent as-is:", err);
    // Fallback: treat spend as USD (best effort)
    for (const r of rows) {
      spentUsdMap.set(r, r.spent);
    }
  }

  // Bulk upsert in chunks
  let upserted = 0;
  let failed   = 0;

  try {
    const chunks = chunk(rows, CHUNK_SIZE);
    const queries = chunks.map((ch) =>
      prisma.$executeRaw(buildBulkUpsertQuery(ch, syncLog.id, spentUsdMap)),
    );

    // Execute all chunks in a single transaction
    const results = await prisma.$transaction(queries);

    for (const count of results) {
      upserted += count;
    }
  } catch (err) {
    console.error("[importTaboolaCsv] Bulk upsert failed:", err);

    // Update SyncLog as FAILED
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status:     "FAILED",
        finishedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        recordsFetched: rows.length,
        recordsFailed:  rows.length,
      },
    });

    return {
      success: false,
      error: "Database import failed. Please check the CSV format and try again.",
      parseErrors,
    };
  }

  // Update SyncLog as SUCCESS
  await prisma.syncLog.update({
    where: { id: syncLog.id },
    data: {
      status:          parseErrors.length > 0 ? "PARTIAL" : "SUCCESS",
      finishedAt:      new Date(),
      recordsFetched:  rows.length,
      recordsInserted: upserted,
      recordsUpdated:  0, // ON CONFLICT counts as affected, we can't distinguish
      recordsSkipped:  parseErrors.length,
      recordsFailed:   failed,
    },
  });

  revalidatePath("/integrations/taboola-csv");

  return {
    success:     true,
    totalRows:   rows.length,
    upserted,
    parseErrors,
  };
}
