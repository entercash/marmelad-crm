/**
 * Keitaro Admin API — HTTP Client
 *
 * Responsibilities:
 *  - API key authentication (simpler than OAuth2)
 *  - POST-based report query builder
 *  - Typed response handling
 *
 * Keitaro is a self-hosted tracker — the base URL comes from env.
 * Auth uses a static "Api-Key" header (no token refresh needed).
 *
 * Note: Uses Node.js built-in `fetch` (requires Node 18+).
 */

import { KeitaroError, ConfigurationError } from "@/lib/errors";
import type {
  KeitaroReportRequest,
  KeitaroReportResponse,
  KeitaroDateRange,
  KeitaroMetric,
  KeitaroGroupingField,
  KeitaroCampaign,
  KeitaroConversion,
} from "./types";

// ─── Config ──────────────────────────────────────────────────────────────────

export interface KeitaroConfig {
  apiUrl: string; // e.g. "https://tracker.yourdomain.com"
  apiKey: string;
}

export function loadKeitaroConfig(): KeitaroConfig {
  const apiUrl = process.env.KEITARO_API_URL;
  const apiKey = process.env.KEITARO_API_KEY;

  if (!apiUrl) throw new ConfigurationError("KEITARO_API_URL is not set");
  if (!apiKey) throw new ConfigurationError("KEITARO_API_KEY is not set");

  // Strip trailing slash so we can safely append paths
  return { apiUrl: apiUrl.replace(/\/$/, ""), apiKey };
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class KeitaroClient {
  private readonly config: KeitaroConfig;

  constructor(config: KeitaroConfig) {
    this.config = config;
  }

  // ── HTTP helper ───────────────────────────────────────────────────────────

  private async post<TBody, TResponse>(
    path: string,
    body: TBody,
  ): Promise<TResponse> {
    const url = `${this.config.apiUrl}/admin_api/v1${path}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": this.config.apiKey,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new KeitaroError(
        `Network error on POST ${path}`,
        undefined,
        err,
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new KeitaroError(
        `Keitaro API error on POST ${path} [${res.status}]: ${text}`,
        res.status,
      );
    }

    return res.json() as Promise<TResponse>;
  }

  private async get<TResponse>(path: string): Promise<TResponse> {
    const url = `${this.config.apiUrl}/admin_api/v1${path}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: {
          "Api-Key": this.config.apiKey,
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      throw new KeitaroError(
        `Network error on GET ${path}`,
        undefined,
        err,
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new KeitaroError(
        `Keitaro API error on GET ${path} [${res.status}]: ${text}`,
        res.status,
      );
    }

    return res.json() as Promise<TResponse>;
  }

  // ── Report Builder ────────────────────────────────────────────────────────

  /**
   * Execute a flexible Keitaro report query.
   * Low-level — prefer the typed methods below for common use cases.
   */
  async buildReport(request: KeitaroReportRequest): Promise<KeitaroReportResponse> {
    return this.post<KeitaroReportRequest, KeitaroReportResponse>(
      "/report/build",
      request,
    );
  }

  // ── Campaign List ───────────────────────────────────────────────────────

  /**
   * Fetch all campaigns from Keitaro.
   * Returns a flat array of campaign objects.
   */
  async getCampaigns(): Promise<KeitaroCampaign[]> {
    return this.get<KeitaroCampaign[]>("/campaigns");
  }

  // ── Typed API Methods ─────────────────────────────────────────────────────

  /**
   * Fetch daily conversion stats grouped by campaign × country × day.
   * This is the primary Keitaro sync for MVP P&L.
   *
   * Returns: leads (total), sales (approved), revenue per campaign per GEO per day.
   */
  async getConversionStatsDaily(
    range: KeitaroDateRange,
  ): Promise<KeitaroReportResponse> {
    const grouping: KeitaroGroupingField[] = ["campaign_id", "country", "day"];
    const metrics: KeitaroMetric[] = ["clicks", "leads", "sales", "rejected", "revenue"];

    return this.buildReport({
      range,
      grouping,
      metrics,
      filters: [],
      limit: 10_000,
      offset: 0,
    });
  }

  /**
   * Fetch daily revenue stats for all campaigns in a date range.
   * Same underlying query as getConversionStatsDaily — kept as a separate method
   * for clarity and future independent configuration (e.g. different filters).
   */
  async getRevenueStatsDaily(
    range: KeitaroDateRange,
  ): Promise<KeitaroReportResponse> {
    return this.getConversionStatsDaily(range);
  }

  // ── Individual Conversions ─────────────────────────────────────────────

  /**
   * Fetch individual conversion records from Keitaro.
   * Uses the /conversions endpoint with date filters.
   * Returns newest-first, limited to `limit` records.
   */
  async getConversions(params: {
    dateFrom: string;   // YYYY-MM-DD
    dateTo: string;     // YYYY-MM-DD
    limit?: number;
  }): Promise<KeitaroConversion[]> {
    const body = {
      range: { from: params.dateFrom, to: params.dateTo },
      columns: [
        "conversion_id", "click_id", "campaign_id", "click_datetime", "status", "revenue",
        "country", "sub_id_1", "sub_id_2", "sub_id_3", "sub_id_4",
        "sub_id_5", "sub_id_6", "sub_id_7", "sub_id_8", "sub_id_9", "sub_id_10",
      ],
      sort: [{ name: "click_datetime", order: "desc" }],
      limit: params.limit ?? 100,
    };
    const resp = await this.post<typeof body, { rows: KeitaroConversion[] }>(
      "/conversions/log",
      body,
    );
    return resp.rows ?? [];
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createKeitaroClient(config?: KeitaroConfig): KeitaroClient {
  return new KeitaroClient(config ?? loadKeitaroConfig());
}
