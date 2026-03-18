/**
 * Domain Health Checker
 *
 * Checks a single domain's health:
 *  - HTTP: fetch with 10s timeout → status code, response time
 *  - SSL:  tls.connect → cert expiry, issuer
 *  - DNS:  dns.resolve → resolves true/false
 *  - WHOIS: whois-json → domain expiry, registrar
 *  - Google Safe Browsing: v4 Lookup API → malware/phishing/unwanted software
 *
 * Returns a result object ready to be written to the DB.
 */

import tls from "tls";
import dns from "dns/promises";
import type { DomainStatus } from "@prisma/client";

// ─── Result type ──────────────────────────────────────────────────────────────

export interface DomainCheckResult {
  status: DomainStatus;
  httpStatus: number | null;
  responseMs: number | null;
  sslExpiry: Date | null;
  sslIssuer: string | null;
  dnsResolves: boolean | null;
  registrar: string | null;
  domainExpiry: Date | null;
  safeBrowsing: string | null; // "SAFE", or threat type e.g. "MALWARE", "SOCIAL_ENGINEERING"
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0];
  }
}

function extractRootDomain(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join(".");
}

// ─── HTTP check ──────────────────────────────────────────────────────────────

async function checkHttp(url: string): Promise<{
  httpStatus: number | null;
  responseMs: number | null;
}> {
  try {
    const start = Date.now();
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent": "MarmeladCRM-Monitor/1.0",
      },
    });
    return {
      httpStatus: res.status,
      responseMs: Date.now() - start,
    };
  } catch {
    return { httpStatus: null, responseMs: null };
  }
}

// ─── SSL check ───────────────────────────────────────────────────────────────

async function checkSsl(hostname: string): Promise<{
  sslExpiry: Date | null;
  sslIssuer: string | null;
}> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ sslExpiry: null, sslIssuer: null });
    }, 10_000);

    try {
      const socket = tls.connect(
        443,
        hostname,
        { servername: hostname, rejectUnauthorized: false },
        () => {
          try {
            const cert = socket.getPeerCertificate();
            const sslExpiry = cert.valid_to ? new Date(cert.valid_to) : null;
            const rawIssuer = cert.issuer?.O || cert.issuer?.CN || null;
            const sslIssuer = Array.isArray(rawIssuer) ? rawIssuer[0] : rawIssuer;
            socket.destroy();
            clearTimeout(timeout);
            resolve({ sslExpiry, sslIssuer });
          } catch {
            socket.destroy();
            clearTimeout(timeout);
            resolve({ sslExpiry: null, sslIssuer: null });
          }
        },
      );
      socket.on("error", () => {
        clearTimeout(timeout);
        resolve({ sslExpiry: null, sslIssuer: null });
      });
    } catch {
      clearTimeout(timeout);
      resolve({ sslExpiry: null, sslIssuer: null });
    }
  });
}

// ─── DNS check ───────────────────────────────────────────────────────────────

async function checkDns(hostname: string): Promise<boolean | null> {
  try {
    const records = await dns.resolve(hostname);
    return records.length > 0;
  } catch {
    return false;
  }
}

// ─── WHOIS check ─────────────────────────────────────────────────────────────

async function checkWhois(hostname: string): Promise<{
  registrar: string | null;
  domainExpiry: Date | null;
}> {
  try {
    const whois = await import("whois-json");
    const rootDomain = extractRootDomain(hostname);
    const result = await whois.default(rootDomain);
    const data = Array.isArray(result) ? result[0] : result;

    const registrar = data?.registrar ?? data?.registrarName ?? null;
    const expiryStr =
      data?.registryExpiryDate ??
      data?.registrarRegistrationExpirationDate ??
      data?.expirationDate ??
      null;
    const domainExpiry = expiryStr ? new Date(expiryStr) : null;

    return {
      registrar: typeof registrar === "string" ? registrar : null,
      domainExpiry:
        domainExpiry && !isNaN(domainExpiry.getTime()) ? domainExpiry : null,
    };
  } catch {
    return { registrar: null, domainExpiry: null };
  }
}

// ─── Google Safe Browsing check ──────────────────────────────────────────────

/**
 * Checks a URL against Google Safe Browsing v4 Lookup API.
 * Requires API key stored in integration settings as `google.safeBrowsingApiKey`.
 * Returns: null if no API key, "SAFE" if clean, or threat type string if flagged.
 */
async function checkSafeBrowsing(url: string): Promise<string | null> {
  try {
    // Dynamic import to avoid pulling in Prisma on every check when not needed
    const { getSetting } = await import("@/features/integration-settings/queries");
    const apiKey = await getSetting("google.safeBrowsingApiKey");
    if (!apiKey) return null; // No API key configured — skip

    const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`;

    const body = {
      client: {
        clientId: "marmelad-crm",
        clientVersion: "1.0.0",
      },
      threatInfo: {
        threatTypes: [
          "MALWARE",
          "SOCIAL_ENGINEERING",
          "UNWANTED_SOFTWARE",
          "POTENTIALLY_HARMFUL_APPLICATION",
        ],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: [{ url }],
      },
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error(`[safe-browsing] API error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();

    // Empty matches = safe
    if (!data.matches || data.matches.length === 0) return "SAFE";

    // Return the most severe threat type
    const threats: string[] = data.matches.map(
      (m: { threatType?: string }) => m.threatType ?? "UNKNOWN",
    );

    // Priority: MALWARE > SOCIAL_ENGINEERING > UNWANTED_SOFTWARE > other
    const priority = [
      "MALWARE",
      "SOCIAL_ENGINEERING",
      "UNWANTED_SOFTWARE",
      "POTENTIALLY_HARMFUL_APPLICATION",
    ];
    for (const t of priority) {
      if (threats.includes(t)) return t;
    }
    return threats[0];
  } catch (err) {
    console.error("[safe-browsing] Check failed:", err);
    return null;
  }
}

// ─── Status determination ────────────────────────────────────────────────────

function determineStatus(result: {
  httpStatus: number | null;
  dnsResolves: boolean | null;
  sslExpiry: Date | null;
  safeBrowsing: string | null;
}): DomainStatus {
  // DNS failure
  if (result.dnsResolves === false) return "DNS_ERROR";

  // No HTTP response (timeout/connection refused)
  if (result.httpStatus === null) return "DOWN";

  // SSL expired
  if (result.sslExpiry && result.sslExpiry < new Date()) return "SSL_ERROR";

  // Google Safe Browsing flagged → BANNED
  if (
    result.safeBrowsing &&
    result.safeBrowsing !== "SAFE"
  ) {
    return "BANNED";
  }

  // Blocked / banned patterns
  if (result.httpStatus === 403 || result.httpStatus === 451) return "BANNED";

  // Server responds (any non-5xx) — domain is UP.
  // 404 is normal for cloaked landing pages, 401/302/etc. also mean server is alive.
  if (result.httpStatus < 500) return "UP";

  // 5xx — server error, domain is effectively down
  return "DOWN";
}

// ─── Main check function ─────────────────────────────────────────────────────

export async function checkDomain(url: string): Promise<DomainCheckResult> {
  const hostname = extractHostname(url);

  // Run all checks in parallel
  const [httpResult, sslResult, dnsResult, whoisResult, safeBrowsingResult] =
    await Promise.all([
      checkHttp(url),
      checkSsl(hostname),
      checkDns(hostname),
      checkWhois(hostname),
      checkSafeBrowsing(url),
    ]);

  const status = determineStatus({
    httpStatus: httpResult.httpStatus,
    dnsResolves: dnsResult,
    sslExpiry: sslResult.sslExpiry,
    safeBrowsing: safeBrowsingResult,
  });

  return {
    status,
    httpStatus: httpResult.httpStatus,
    responseMs: httpResult.responseMs,
    sslExpiry: sslResult.sslExpiry,
    sslIssuer: sslResult.sslIssuer,
    dnsResolves: dnsResult,
    registrar: whoisResult.registrar,
    domainExpiry: whoisResult.domainExpiry,
    safeBrowsing: safeBrowsingResult,
  };
}
