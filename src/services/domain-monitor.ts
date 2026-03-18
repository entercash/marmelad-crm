/**
 * Domain Monitor — Orchestrator
 *
 * Checks all domains in the database for health and sends
 * Telegram alerts on status changes (UP→DOWN, SSL expiring, etc.).
 *
 * Redis deduplication:
 *  - `telegram:alert:domain:{id}:{status}` — one alert per status, cleared on recovery
 */

import { prisma } from "@/lib/prisma";
import { checkDomain } from "./domain-checker";
import { sendAlert } from "./notifications/telegram-alerts";
import type { DomainStatus } from "@prisma/client";

// ─── Redis helpers ────────────────────────────────────────────────────────────

async function getRedis() {
  const { redis } = await import("@/lib/redis");
  return redis;
}

function alertKey(domainId: string, status: string): string {
  return `telegram:alert:domain:${domainId}:${status}`;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SSL_EXPIRY_WARNING_DAYS = 14;

const STATUS_EMOJIS: Record<DomainStatus, string> = {
  UP: "🟢",
  DOWN: "🔴",
  SSL_ERROR: "🔒",
  DNS_ERROR: "🌐",
  BANNED: "🚫",
  EXPIRED: "⏰",
  UNKNOWN: "❓",
};

// ─── Alert formatting ─────────────────────────────────────────────────────────

function formatDownAlert(
  url: string,
  httpStatus: number | null,
  responseMs: number | null,
): string {
  const lines = [
    `🔴 <b>Domain Down</b>`,
    url,
  ];
  if (httpStatus) lines.push(`HTTP: ${httpStatus}`);
  if (responseMs) lines.push(`Response: ${responseMs}ms`);
  return lines.join("\n");
}

function formatRecoveryAlert(
  url: string,
  lastUpAt: Date | null,
): string {
  const lines = [
    `🟢 <b>Domain Recovered</b>`,
    url,
  ];
  if (lastUpAt) {
    const downMs = Date.now() - lastUpAt.getTime();
    const hours = Math.floor(downMs / 3_600_000);
    const minutes = Math.floor((downMs % 3_600_000) / 60_000);
    if (hours > 0) {
      lines.push(`Was down for: ${hours}h ${minutes}m`);
    } else {
      lines.push(`Was down for: ${minutes}m`);
    }
  }
  return lines.join("\n");
}

function formatSslExpiryAlert(
  url: string,
  sslExpiry: Date,
): string {
  const daysLeft = Math.ceil((sslExpiry.getTime() - Date.now()) / 86_400_000);
  const dateStr = sslExpiry.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return [
    `⚠️ <b>SSL Expiring Soon</b>`,
    url,
    `Expires: ${dateStr} (${daysLeft} days left)`,
  ].join("\n");
}

function formatStatusAlert(
  url: string,
  status: DomainStatus,
): string {
  const emoji = STATUS_EMOJIS[status] ?? "❓";
  return [
    `${emoji} <b>Domain ${status.replace("_", " ")}</b>`,
    url,
  ].join("\n");
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export async function checkAllDomains(): Promise<number> {
  const domains = await prisma.domain.findMany();
  if (domains.length === 0) return 0;

  let alertsSent = 0;
  let redis;
  try {
    redis = await getRedis();
  } catch {
    // Redis unavailable — still run checks, just no alert dedup
  }

  for (const domain of domains) {
    try {
      const result = await checkDomain(domain.url);
      const previousStatus = domain.status;
      const now = new Date();

      // Update the domain in DB
      await prisma.domain.update({
        where: { id: domain.id },
        data: {
          status: result.status,
          httpStatus: result.httpStatus,
          responseMs: result.responseMs,
          sslExpiry: result.sslExpiry,
          sslIssuer: result.sslIssuer,
          dnsResolves: result.dnsResolves,
          registrar: result.registrar,
          domainExpiry: result.domainExpiry,
          lastCheckedAt: now,
          ...(result.status === "UP" ? { lastUpAt: now } : {}),
        },
      });

      // ── Status change alerts ────────────────────────────────────────────

      // Recovery: was not UP → now UP
      if (previousStatus !== "UP" && previousStatus !== "UNKNOWN" && result.status === "UP") {
        if (redis) {
          // Clear all problem alert keys for this domain
          const keys = await redis.keys(`telegram:alert:domain:${domain.id}:*`);
          if (keys.length > 0) await redis.del(...keys);
        }
        await sendAlert(formatRecoveryAlert(domain.url, domain.lastUpAt));
        alertsSent++;
        continue;
      }

      // Problem: status changed to a bad state
      if (result.status !== "UP" && result.status !== "UNKNOWN") {
        const key = redis ? alertKey(domain.id, result.status) : null;
        const alreadySent = key ? await redis!.get(key) : null;

        if (!alreadySent) {
          let text: string;
          if (result.status === "DOWN") {
            text = formatDownAlert(domain.url, result.httpStatus, result.responseMs);
          } else {
            text = formatStatusAlert(domain.url, result.status);
          }
          const ok = await sendAlert(text);
          if (ok && key && redis) {
            await redis.set(key, "1");
            alertsSent++;
          }
        }
      }

      // ── SSL expiry warning ────────────────────────────────────────────

      if (result.sslExpiry) {
        const daysLeft = Math.ceil(
          (result.sslExpiry.getTime() - Date.now()) / 86_400_000,
        );
        if (daysLeft > 0 && daysLeft <= SSL_EXPIRY_WARNING_DAYS) {
          const sslKey = redis ? `telegram:alert:domain:${domain.id}:ssl-expiry` : null;
          const alreadySent = sslKey ? await redis!.get(sslKey) : null;
          if (!alreadySent) {
            const ok = await sendAlert(formatSslExpiryAlert(domain.url, result.sslExpiry));
            if (ok && sslKey && redis) {
              // Re-alert daily (TTL 24h)
              await redis.set(sslKey, "1", "EX", 86_400);
              alertsSent++;
            }
          }
        } else if (redis) {
          // SSL not expiring soon — clear warning key
          await redis.del(`telegram:alert:domain:${domain.id}:ssl-expiry`);
        }
      }
    } catch (err) {
      console.error(`[domain-monitor] Error checking ${domain.url}:`, err);
    }
  }

  if (alertsSent > 0) {
    console.log(`[domain-monitor] Sent ${alertsSent} domain alerts`);
  }

  return alertsSent;
}
