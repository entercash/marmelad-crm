import { prisma } from "@/lib/prisma";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface KeitaroCampaignRow {
  id:         string;
  externalId: number;
  name:       string;
  alias:      string;
  state:      string;
  groupId:    number | null;
  updatedAt:  Date;
}

export interface KeitaroSyncStats {
  totalCampaigns:  number;
  activeCampaigns: number;
  lastSyncAt:      Date | null;
  totalSyncs:      number;
}

export interface KeitaroSyncHistoryRow {
  id:              string;
  startedAt:       Date;
  finishedAt:      Date | null;
  status:          string;
  recordsFetched:  number | null;
  recordsInserted: number | null;
  recordsUpdated:  number | null;
  errorMessage:    string | null;
}

// ─── Queries ────────────────────────────────────────────────────────────────

/** Get all Keitaro campaigns, optionally filtered by state. */
export async function getKeitaroCampaigns(
  stateFilter?: string,
): Promise<KeitaroCampaignRow[]> {
  const campaigns = await prisma.keitaroCampaign.findMany({
    where: stateFilter ? { state: stateFilter } : undefined,
    orderBy: [{ state: "asc" }, { name: "asc" }],
  });

  return campaigns.map((c) => ({
    id:         c.id,
    externalId: c.externalId,
    name:       c.name,
    alias:      c.alias,
    state:      c.state,
    groupId:    c.groupId,
    updatedAt:  c.updatedAt,
  }));
}

/** Get aggregate sync stats. */
export async function getKeitaroSyncStats(): Promise<KeitaroSyncStats> {
  const [total, active, lastSync, totalSyncs] = await Promise.all([
    prisma.keitaroCampaign.count(),
    prisma.keitaroCampaign.count({ where: { state: "active" } }),
    prisma.syncLog.findFirst({
      where: { source: "keitaro", entityType: "campaigns", status: { in: ["SUCCESS", "PARTIAL"] } },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
    prisma.syncLog.count({
      where: { source: "keitaro", entityType: "campaigns" },
    }),
  ]);

  return {
    totalCampaigns:  total,
    activeCampaigns: active,
    lastSyncAt:      lastSync?.finishedAt ?? null,
    totalSyncs,
  };
}

/** Get recent sync history for Keitaro campaigns. */
export async function getKeitaroSyncHistory(
  limit = 10,
): Promise<KeitaroSyncHistoryRow[]> {
  const logs = await prisma.syncLog.findMany({
    where: { source: "keitaro", entityType: "campaigns" },
    orderBy: { startedAt: "desc" },
    take: limit,
  });

  return logs.map((log) => ({
    id:              log.id,
    startedAt:       log.startedAt,
    finishedAt:      log.finishedAt,
    status:          log.status,
    recordsFetched:  log.recordsFetched,
    recordsInserted: log.recordsInserted,
    recordsUpdated:  log.recordsUpdated,
    errorMessage:    log.errorMessage,
  }));
}
