/**
 * Domains — read-only data access layer.
 *
 * Domains sorted: problems first (DOWN, SSL_ERROR, DNS_ERROR, BANNED, EXPIRED),
 * then UNKNOWN, then UP. Within each group, by name.
 */

import { prisma } from "@/lib/prisma";
import type { DomainStatus } from "@prisma/client";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DomainRow = {
  id: string;
  url: string;
  name: string | null;
  status: DomainStatus;
  httpStatus: number | null;
  responseMs: number | null;
  sslExpiry: Date | null;
  sslIssuer: string | null;
  dnsResolves: boolean | null;
  registrar: string | null;
  domainExpiry: Date | null;
  lastCheckedAt: Date | null;
  lastUpAt: Date | null;
  notes: string | null;
  createdAt: Date;
};

export type DomainStats = {
  total: number;
  up: number;
  down: number;
  sslExpiring: number;
  domainExpiring: number;
};

// ─── Sort order ──────────────────────────────────────────────────────────────

const STATUS_SORT_ORDER: Record<DomainStatus, number> = {
  DOWN: 0,
  SSL_ERROR: 1,
  DNS_ERROR: 2,
  BANNED: 3,
  EXPIRED: 4,
  UNKNOWN: 5,
  UP: 6,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getDomains(): Promise<DomainRow[]> {
  const rows = await prisma.domain.findMany({
    orderBy: { url: "asc" },
  });

  return rows
    .map((r) => ({
      id: r.id,
      url: r.url,
      name: r.name,
      status: r.status,
      httpStatus: r.httpStatus,
      responseMs: r.responseMs,
      sslExpiry: r.sslExpiry,
      sslIssuer: r.sslIssuer,
      dnsResolves: r.dnsResolves,
      registrar: r.registrar,
      domainExpiry: r.domainExpiry,
      lastCheckedAt: r.lastCheckedAt,
      lastUpAt: r.lastUpAt,
      notes: r.notes,
      createdAt: r.createdAt,
    }))
    .sort((a, b) => {
      const sa = STATUS_SORT_ORDER[a.status] ?? 99;
      const sb = STATUS_SORT_ORDER[b.status] ?? 99;
      if (sa !== sb) return sa - sb;
      return a.url.localeCompare(b.url);
    });
}

export async function getDomainStats(): Promise<DomainStats> {
  const now = new Date();
  const in14Days = new Date(now.getTime() + 14 * 86_400_000);

  const [domains, sslExpiring, domainExpiring] = await Promise.all([
    prisma.domain.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    prisma.domain.count({
      where: {
        sslExpiry: { lte: in14Days, gt: now },
      },
    }),
    prisma.domain.count({
      where: {
        domainExpiry: { lte: in14Days, gt: now },
      },
    }),
  ]);

  const statusMap: Record<string, number> = {};
  for (const row of domains) {
    statusMap[row.status] = row._count.status;
  }

  const total = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const up = statusMap.UP ?? 0;
  const down =
    (statusMap.DOWN ?? 0) +
    (statusMap.SSL_ERROR ?? 0) +
    (statusMap.DNS_ERROR ?? 0) +
    (statusMap.BANNED ?? 0) +
    (statusMap.EXPIRED ?? 0);

  return { total, up, down, sslExpiring, domainExpiring };
}
