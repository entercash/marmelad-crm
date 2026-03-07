/**
 * Keitaro Integration — Public API
 *
 * Import from here, not from internal modules directly.
 */

export { KeitaroClient, createKeitaroClient, loadKeitaroConfig } from "./client";
export type { KeitaroConfig } from "./client";
export type {
  KeitaroReportRequest,
  KeitaroReportResponse,
  KeitaroReportRow,
  KeitaroDateRange,
  KeitaroGroupingField,
  KeitaroMetric,
  KeitaroFilter,
} from "./types";
