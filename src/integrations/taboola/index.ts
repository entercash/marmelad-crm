/**
 * Taboola Integration — Public API
 *
 * Import from here, not from internal modules directly.
 */

export { TaboolaClient, createTaboolaClient, loadTaboolaConfig } from "./client";
export type { TaboolaConfig } from "./client";
export type {
  TaboolaCampaign,
  TaboolaCampaignItem,
  TaboolaCampaignStatRow,
  TaboolaItemStatRow,
  TaboolaPublisherStatRow,
  TaboolaCampaignsResponse,
  TaboolaCampaignItemsResponse,
  TaboolaCampaignStatsResponse,
  TaboolaItemStatsResponse,
  TaboolaPublisherStatsResponse,
  TaboolaDateRangeParams,
  TaboolaCampaignStatus,
  TaboolaCampaignItemStatus,
} from "./types";
