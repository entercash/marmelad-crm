/**
 * FX Rates — fetches live exchange rates and converts to USD.
 *
 * Uses the free Open Exchange Rates API (no API key needed):
 *   https://open.er-api.com/v6/latest/USD
 *
 * Rates are cached in-memory for 1 hour to avoid hammering the API.
 * Falls back to hardcoded rates if the API is unreachable.
 */

// ─── Cache ──────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cachedRates: Record<string, number> | null = null;
let cachedAt = 0;

// ─── Hardcoded fallback rates (approximate, updated 2026-03-11) ──────────

const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  HKD: 7.78,
  ILS: 3.63,
  JPY: 148.5,
  CAD: 1.36,
  AUD: 1.54,
  CHF: 0.88,
  CNY: 7.24,
  BRL: 5.0,
};

// ─── Fetch ──────────────────────────────────────────────────────────────────

async function fetchRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 }, // Next.js fetch cache: 1 hour
    });

    if (!res.ok) {
      throw new Error(`FX API responded with ${res.status}`);
    }

    const data = await res.json();

    if (data.result !== "success" || !data.rates) {
      throw new Error("Unexpected FX API response format");
    }

    return data.rates as Record<string, number>;
  } catch (err) {
    console.warn("[fx-rates] API fetch failed, using fallback rates:", err);
    return FALLBACK_RATES;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns a map of currency codes → rate per 1 USD.
 * Cached in-memory for 1 hour.
 */
export async function getRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cachedRates && now - cachedAt < CACHE_TTL_MS) {
    return cachedRates;
  }

  const rates = await fetchRates();
  cachedRates = rates;
  cachedAt = now;
  return rates;
}

/**
 * Converts an amount from `fromCurrency` to USD.
 *
 * @param amount     The amount in the source currency
 * @param fromCurrency  ISO currency code (e.g. "HKD", "EUR")
 * @param rates      Pre-fetched rates map (from getRates())
 * @returns          The equivalent amount in USD
 */
export function toUsd(
  amount: number,
  fromCurrency: string,
  rates: Record<string, number>,
): number {
  if (fromCurrency === "USD") return amount;

  const rate = rates[fromCurrency];
  if (!rate || rate === 0) {
    console.warn(`[fx-rates] Unknown currency "${fromCurrency}", returning amount as-is`);
    return amount;
  }

  return amount / rate;
}
