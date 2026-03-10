/**
 * FX Rates — fetches live and historical exchange rates, converts to USD.
 *
 * Live rates:  open.er-api.com (no API key, cached 1 hour)
 * Historical:  frankfurter.app (no API key, supports date ranges)
 *
 * Falls back to hardcoded rates if APIs are unreachable.
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

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Format Date as "YYYY-MM-DD". */
function dateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

// ─── Live rates ─────────────────────────────────────────────────────────────

async function fetchRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });

    if (!res.ok) throw new Error(`FX API responded with ${res.status}`);

    const data = await res.json();
    if (data.result !== "success" || !data.rates) {
      throw new Error("Unexpected FX API response format");
    }

    return data.rates as Record<string, number>;
  } catch (err) {
    console.warn("[fx-rates] Live API fetch failed, using fallback:", err);
    return FALLBACK_RATES;
  }
}

/**
 * Returns a map of currency codes → rate per 1 USD (live/today).
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

// ─── Historical rates ───────────────────────────────────────────────────────

/**
 * Fetches historical FX rates for a date range from frankfurter.app.
 *
 * Returns a map: "YYYY-MM-DD" → { CUR: rate_per_1_USD, ... }
 * For dates not in the response (weekends/holidays), the nearest
 * previous business day's rate is used.
 *
 * @param startDate  First date (inclusive)
 * @param endDate    Last date (inclusive)
 */
export async function getHistoricalRates(
  startDate: Date,
  endDate: Date,
): Promise<Record<string, Record<string, number>>> {
  const start = dateStr(startDate);
  const end = dateStr(endDate);

  try {
    // frankfurter.app returns rates relative to base currency for each business day
    const url = `https://api.frankfurter.app/${start}..${end}?from=USD`;
    const res = await fetch(url, { cache: "force-cache" });

    if (!res.ok) throw new Error(`Historical FX API responded with ${res.status}`);

    const data = await res.json();

    if (!data.rates || typeof data.rates !== "object") {
      throw new Error("Unexpected historical FX API response format");
    }

    return data.rates as Record<string, Record<string, number>>;
  } catch (err) {
    console.warn("[fx-rates] Historical API fetch failed, using fallback:", err);
    // Return a single entry with fallback rates for all dates
    const result: Record<string, Record<string, number>> = {};
    result[start] = FALLBACK_RATES;
    return result;
  }
}

/**
 * Given historical rates (from getHistoricalRates), finds the rate
 * for a specific date. If the exact date isn't available (weekend/holiday),
 * uses the nearest previous business day.
 */
export function findRateForDate(
  dateKey: string,
  currency: string,
  historicalRates: Record<string, Record<string, number>>,
): number {
  if (currency === "USD") return 1;

  // Try exact date first
  if (historicalRates[dateKey]?.[currency]) {
    return historicalRates[dateKey][currency];
  }

  // Find nearest previous date
  const sortedDates = Object.keys(historicalRates).sort();
  let bestDate: string | null = null;
  for (const d of sortedDates) {
    if (d <= dateKey) bestDate = d;
    else break;
  }

  if (bestDate && historicalRates[bestDate]?.[currency]) {
    return historicalRates[bestDate][currency];
  }

  // If no previous date, try any available date
  if (sortedDates.length > 0) {
    const firstDate = sortedDates[0];
    if (historicalRates[firstDate]?.[currency]) {
      return historicalRates[firstDate][currency];
    }
  }

  // Ultimate fallback
  const fallback = FALLBACK_RATES[currency];
  if (fallback) return fallback;

  console.warn(`[fx-rates] No rate found for ${currency} on ${dateKey}`);
  return 1; // Can't convert, return as-is
}

// ─── Conversion ─────────────────────────────────────────────────────────────

/**
 * Converts an amount from `fromCurrency` to USD.
 *
 * @param amount        The amount in the source currency
 * @param fromCurrency  ISO currency code (e.g. "HKD", "EUR")
 * @param rates         Pre-fetched rates map (from getRates())
 * @returns             The equivalent amount in USD
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
