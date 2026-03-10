import { prisma } from "@/lib/prisma";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ImportHistoryRow {
  id:              string;
  startedAt:       Date;
  finishedAt:      Date | null;
  status:          string;
  fileName:        string | null;
  fileSize:        number | null;
  totalRows:       number | null;
  recordsInserted: number | null;
  recordsUpdated:  number | null;
  recordsSkipped:  number | null;
  recordsFailed:   number | null;
  errorMessage:    string | null;
}

export interface ImportStats {
  totalRows:     number;
  totalImports:  number;
  lastImportAt:  Date | null;
  dateRangeMin:  Date | null;
  dateRangeMax:  Date | null;
}

// ─── Queries ────────────────────────────────────────────────────────────────

/** Get recent import history (SyncLogs where source = "taboola-csv"). */
export async function getImportHistory(limit = 20): Promise<ImportHistoryRow[]> {
  const logs = await prisma.syncLog.findMany({
    where: { source: "taboola-csv" },
    orderBy: { startedAt: "desc" },
    take: limit,
  });

  return logs.map((log) => {
    const meta = (log.meta as Record<string, unknown>) ?? {};
    return {
      id:              log.id,
      startedAt:       log.startedAt,
      finishedAt:      log.finishedAt,
      status:          log.status,
      fileName:        (meta.fileName as string) ?? null,
      fileSize:        (meta.fileSize as number) ?? null,
      totalRows:       (meta.totalRows as number) ?? log.recordsFetched ?? null,
      recordsInserted: log.recordsInserted,
      recordsUpdated:  log.recordsUpdated,
      recordsSkipped:  log.recordsSkipped,
      recordsFailed:   log.recordsFailed,
      errorMessage:    log.errorMessage,
    };
  });
}

/** Get aggregate import stats. */
export async function getImportStats(): Promise<ImportStats> {
  const [countResult, dateRange, lastImport] = await Promise.all([
    prisma.taboolaCsvRow.count(),
    prisma.taboolaCsvRow.aggregate({
      _min: { day: true },
      _max: { day: true },
    }),
    prisma.syncLog.findFirst({
      where: { source: "taboola-csv", status: { in: ["SUCCESS", "PARTIAL"] } },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
  ]);

  return {
    totalRows:    countResult,
    totalImports: await prisma.syncLog.count({
      where: { source: "taboola-csv", status: { in: ["SUCCESS", "PARTIAL"] } },
    }),
    lastImportAt: lastImport?.finishedAt ?? null,
    dateRangeMin: dateRange._min.day,
    dateRangeMax: dateRange._max.day,
  };
}
