/**
 * Publisher upsert service.
 * Auto-creates Publisher records from Taboola publisher stat rows.
 * Publishers are discovered dynamically from stats — there is no separate
 * "publisher list" endpoint in Taboola's API.
 */

import { prisma } from "@/lib/prisma";
import type { TaboolaPublisherStatRow } from "@/integrations/taboola";
import type { SyncCounter } from "@/services/sync/types";

// ─── Domain normalization ─────────────────────────────────────────────────────

/**
 * Extract the root domain from a publisher name for display purposes.
 * Taboola site names often look like "site.com" or "subdomain.site.com".
 * This is best-effort — not all names are domains.
 */
function extractDomain(siteName: string): string | null {
  try {
    const cleaned = siteName.trim().toLowerCase();
    // If it looks like a hostname, normalize it
    if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(cleaned)) {
      const parts = cleaned.split(".");
      if (parts.length >= 2) {
        // Return the last two parts as the root domain
        return parts.slice(-2).join(".");
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

/**
 * Upsert Publisher records discovered from publisher stat rows.
 * De-duplicates on (trafficSourceId, externalId) before upserting.
 * Only updates the `name` and `domain` — does not touch stats.
 */
export async function upsertPublishers(
  rows: TaboolaPublisherStatRow[],
  trafficSourceId: string,
): Promise<Partial<SyncCounter>> {
  if (rows.length === 0) return {};

  // De-duplicate publishers from stat rows (same publisher in multiple rows)
  const uniquePublishers = new Map<string, { name: string; domain: string | null }>();
  for (const row of rows) {
    if (!uniquePublishers.has(row.site)) {
      uniquePublishers.set(row.site, {
        name: row.site_name || row.site,
        domain: extractDomain(row.site_name || row.site),
      });
    }
  }

  const publisherList = Array.from(uniquePublishers.entries()).map(
    ([externalId, { name, domain }]) => ({ externalId, name, domain }),
  );

  // Batch upsert in chunks of 50 to avoid oversized transactions
  const CHUNK_SIZE = 50;
  let updated = 0;

  for (let i = 0; i < publisherList.length; i += CHUNK_SIZE) {
    const chunk = publisherList.slice(i, i + CHUNK_SIZE);

    await prisma.$transaction(
      chunk.map((pub) =>
        prisma.publisher.upsert({
          where: {
            trafficSourceId_externalId: {
              trafficSourceId,
              externalId: pub.externalId,
            },
          },
          update: {
            name: pub.name,
            domain: pub.domain,
          },
          create: {
            externalId: pub.externalId,
            trafficSourceId,
            name: pub.name,
            domain: pub.domain,
          },
          select: { id: true },
        }),
      ),
      { timeout: 30_000 },
    );

    updated += chunk.length;
  }

  return { updated };
}
