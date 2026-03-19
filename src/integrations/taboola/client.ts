/**
 * Taboola Backstage API — HTTP Client
 *
 * Responsibilities:
 *  - OAuth2 client_credentials authentication
 *  - In-process token caching with expiry buffer
 *  - Typed HTTP GET wrapper with error surfacing
 *  - One method per API endpoint used by the MVP
 *
 * This module has ZERO business logic. It only translates between
 * HTTP and TypeScript types. All normalization happens upstream.
 *
 * Note: Uses Node.js built-in `fetch` (requires Node 18+).
 */

import { ProxyAgent } from "undici";
import { TaboolaError, ConfigurationError } from "@/lib/errors";
import type {
  TaboolaTokenResponse,
  TaboolaCampaignsResponse,
  TaboolaCampaignItemsResponse,
  TaboolaCampaignStatsResponse,
  TaboolaItemStatsResponse,
  TaboolaPublisherStatsResponse,
  TaboolaDateRangeParams,
} from "./types";

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_URL = "https://backstage.taboola.com/backstage/api/1.0";
const AUTH_URL = "https://backstage.taboola.com/backstage/oauth/token";

/** Refresh the token this many ms before it actually expires (2-minute buffer) */
const TOKEN_EXPIRY_BUFFER_MS = 120_000;

// ─── Config ──────────────────────────────────────────────────────────────────

export interface TaboolaConfig {
  clientId: string;
  clientSecret: string;
  accountId: string;
  proxyUrl?: string;
}

export function loadTaboolaConfig(): TaboolaConfig {
  const clientId = process.env.TABOOLA_CLIENT_ID;
  const clientSecret = process.env.TABOOLA_CLIENT_SECRET;
  const accountId = process.env.TABOOLA_ACCOUNT_ID;

  if (!clientId) throw new ConfigurationError("TABOOLA_CLIENT_ID is not set");
  if (!clientSecret) throw new ConfigurationError("TABOOLA_CLIENT_SECRET is not set");
  if (!accountId) throw new ConfigurationError("TABOOLA_ACCOUNT_ID is not set");

  return { clientId, clientSecret, accountId };
}

// ─── Token cache (in-process, per worker instance) ───────────────────────────

interface TokenCache {
  accessToken: string;
  expiresAt: number; // Unix ms timestamp
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class TaboolaClient {
  private readonly config: TaboolaConfig;
  private tokenCache: TokenCache | null = null;
  private readonly dispatcher: ProxyAgent | undefined;

  constructor(config: TaboolaConfig) {
    this.config = config;
    this.dispatcher = config.proxyUrl
      ? new ProxyAgent(config.proxyUrl)
      : undefined;
  }

  /** Proxy-aware fetch wrapper. */
  private proxyFetch(url: string, init?: RequestInit): Promise<Response> {
    if (this.dispatcher) {
      return fetch(url, { ...init, dispatcher: this.dispatcher } as RequestInit);
    }
    return fetch(url, init);
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + TOKEN_EXPIRY_BUFFER_MS) {
      return this.tokenCache.accessToken;
    }
    return this.fetchFreshToken();
  }

  private async fetchFreshToken(): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: "client_credentials",
    });

    let res: Response;
    try {
      res = await this.proxyFetch(AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
    } catch (err) {
      throw new TaboolaError(
        "Cannot reach Taboola auth endpoint — network error",
        undefined,
        err,
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new TaboolaError(
        `Token request failed [${res.status}]: ${text}`,
        res.status,
      );
    }

    const data: TaboolaTokenResponse = await res.json();
    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return this.tokenCache.accessToken;
  }

  // ── HTTP helper ───────────────────────────────────────────────────────────

  private async get<T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<T> {
    const token = await this.getAccessToken();
    const url = new URL(`${BASE_URL}/${this.config.accountId}${path}`);

    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    let res: Response;
    try {
      res = await this.proxyFetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      throw new TaboolaError(
        `Network error on GET ${path}`,
        undefined,
        err,
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new TaboolaError(
        `API error on GET ${path} [${res.status}]: ${text}`,
        res.status,
      );
    }

    return res.json() as Promise<T>;
  }

  // ── API Methods ───────────────────────────────────────────────────────────

  /**
   * Fetch all campaigns for the configured account.
   * Taboola returns all campaigns in a single response (no pagination for accounts
   * with < ~10k campaigns).
   */
  async getCampaigns(): Promise<TaboolaCampaignsResponse> {
    return this.get<TaboolaCampaignsResponse>("/campaigns");
  }

  /**
   * Fetch all items (creatives) for a specific campaign.
   */
  async getCampaignItems(campaignId: string): Promise<TaboolaCampaignItemsResponse> {
    return this.get<TaboolaCampaignItemsResponse>(
      `/campaigns/${campaignId}/items`,
    );
  }

  /**
   * Fetch daily campaign performance stats for a date range.
   * Returns one row per campaign per day within the range.
   */
  async getCampaignStatsDaily(
    params: TaboolaDateRangeParams,
  ): Promise<TaboolaCampaignStatsResponse> {
    return this.get<TaboolaCampaignStatsResponse>(
      "/reports/campaign-summary/dimensions/campaign_day_breakdown",
      { start_date: params.start_date, end_date: params.end_date },
    );
  }

  /**
   * Fetch item (creative) performance stats for a date range.
   * Returns aggregated data per item (top 1000), NOT daily breakdown.
   * Optionally filtered to a single campaign via campaign param.
   */
  async getItemStats(
    params: TaboolaDateRangeParams & { campaign_id?: string },
  ): Promise<TaboolaItemStatsResponse> {
    const queryParams: Record<string, string> = {
      start_date: params.start_date,
      end_date: params.end_date,
    };
    if (params.campaign_id) queryParams.campaign = params.campaign_id;

    return this.get<TaboolaItemStatsResponse>(
      "/reports/top-campaign-content/dimensions/item_breakdown",
      queryParams,
    );
  }

  /**
   * Fetch daily publisher/site performance stats for a date range.
   * Returns one row per publisher × campaign × day × country.
   * This is the primary input for blacklist/whitelist analysis.
   */
  async getPublisherStatsDaily(
    params: TaboolaDateRangeParams,
  ): Promise<TaboolaPublisherStatsResponse> {
    return this.get<TaboolaPublisherStatsResponse>(
      "/reports/campaign-summary/dimensions/campaign_site_day_breakdown",
      { start_date: params.start_date, end_date: params.end_date },
    );
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createTaboolaClient(config?: TaboolaConfig): TaboolaClient {
  return new TaboolaClient(config ?? loadTaboolaConfig());
}
