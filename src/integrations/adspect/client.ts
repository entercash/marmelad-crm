/**
 * Adspect REST API — HTTP Client
 *
 * Responsibilities:
 *  - HTTP Basic authentication (API key as username, empty password)
 *  - Stream listing for configuration UI
 *  - Funnel report fetching for bot-traffic analysis
 *
 * Adspect is a cloud service — base URL is always https://api.adspect.net/v1.
 * Auth uses HTTP Basic: base64(apiKey + ":").
 *
 * Note: The /reports/funnel endpoint returns array-of-arrays format.
 *       Column order = group_by[] columns + metrics[] columns.
 */

import { AdspectError } from "@/lib/errors";
import type {
  AdspectStream,
  AdspectFunnelRow,
  AdspectDailyFunnelRow,
  AdspectFunnelParams,
} from "./types";

// ─── Config ──────────────────────────────────────────────────────────────────

export interface AdspectConfig {
  apiKey: string;
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class AdspectClient {
  private static readonly BASE_URL = "https://api.adspect.net/v1";
  private readonly config: AdspectConfig;

  constructor(config: AdspectConfig) {
    this.config = config;
  }

  // ── HTTP helper ──────────────────────────────────────────────────────────

  private async get<T>(path: string, params?: URLSearchParams): Promise<T> {
    const url = new URL(`${AdspectClient.BASE_URL}${path}`);
    if (params) {
      params.forEach((v, k) => {
        url.searchParams.append(k, v);
      });
    }

    const auth = Buffer.from(`${this.config.apiKey}:`).toString("base64");

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: "GET",
        headers: { Authorization: `Basic ${auth}` },
      });
    } catch (err) {
      throw new AdspectError(
        `Network error on GET ${path}`,
        undefined,
        err,
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new AdspectError(
        `Adspect API error on GET ${path} [${res.status}]: ${text}`,
        res.status,
      );
    }

    const text = await res.text();

    // Empty response → return empty array (valid for report endpoints)
    if (!text.trim()) {
      return [] as unknown as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      // Might be NDJSON (newline-delimited JSON) — parse line by line
      const lines = text.trim().split("\n").filter(Boolean);
      if (lines.length > 1) {
        const parsed = lines.map((line) => JSON.parse(line));
        return parsed as T;
      }
      throw new SyntaxError(`Invalid JSON from Adspect: ${text.slice(0, 200)}`);
    }
  }

  // ── Streams ──────────────────────────────────────────────────────────────

  /**
   * Fetch all streams from the Adspect account.
   * Used to populate the stream dropdown in CampaignLink form.
   */
  async getStreams(): Promise<AdspectStream[]> {
    return this.get<AdspectStream[]>("/streams");
  }

  // ── Funnel Report ────────────────────────────────────────────────────────

  /**
   * Fetch funnel report grouped by sub_id for the given streams.
   * sub_id = Taboola site_id (passed via UTM src_id={site_id}).
   *
   * The API returns array-of-arrays. We request:
   *   group_by: [sub_id]
   *   metrics:  [clicks, money_hits, quality]
   *
   * So each raw row is: [sub_id, clicks, money_hits, quality]
   *                       idx 0    idx 1   idx 2      idx 3
   */
  async getFunnelBySite(params: AdspectFunnelParams): Promise<AdspectFunnelRow[]> {
    const searchParams = new URLSearchParams();

    // Breakdown
    searchParams.append("group_by[]", "sub_id");

    // Metrics (order matters — determines array index)
    for (const m of ["clicks", "money_hits", "quality"]) {
      searchParams.append("metrics[]", m);
    }

    // Stream filter
    for (const sid of params.streamIds) {
      searchParams.append("stream_id[]", sid);
    }

    // Date range
    searchParams.append("date_from", params.dateFrom);
    searchParams.append("date_to", params.dateTo);

    const raw = await this.get<unknown[][]>("/reports/funnel", searchParams);

    // Parse array-of-arrays → typed objects
    return raw.map((row) => ({
      sub_id:     String(row[0] ?? ""),
      clicks:     Number(row[1] ?? 0),
      money_hits: Number(row[2] ?? 0),
      quality:    Number(row[3] ?? 0),
    }));
  }

  // ── Daily Funnel Report ─────────────────────────────────────────────────

  /**
   * Fetch funnel report grouped by date + sub_id for sparkline trends.
   *
   * group_by: [date, sub_id]
   * metrics:  [clicks, money_hits, quality]
   *
   * Each raw row: [date, sub_id, clicks, money_hits, quality]
   *                idx 0  idx 1   idx 2   idx 3      idx 4
   */
  async getFunnelBySiteAndDate(params: AdspectFunnelParams): Promise<AdspectDailyFunnelRow[]> {
    const searchParams = new URLSearchParams();

    searchParams.append("group_by[]", "date");
    searchParams.append("group_by[]", "sub_id");

    for (const m of ["clicks", "money_hits", "quality"]) {
      searchParams.append("metrics[]", m);
    }

    for (const sid of params.streamIds) {
      searchParams.append("stream_id[]", sid);
    }

    searchParams.append("date_from", params.dateFrom);
    searchParams.append("date_to", params.dateTo);

    const raw = await this.get<unknown[][]>("/reports/funnel", searchParams);

    return raw.map((row) => ({
      date:       String(row[0] ?? ""),
      sub_id:     String(row[1] ?? ""),
      clicks:     Number(row[2] ?? 0),
      money_hits: Number(row[3] ?? 0),
      quality:    Number(row[4] ?? 0),
    }));
  }
}
