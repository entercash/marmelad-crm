/**
 * Shared types for the sync orchestration layer.
 * These are internal to services/ and not exported to the rest of the app.
 */

// ─── Sync input ───────────────────────────────────────────────────────────────

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface TaboolaSyncParams {
  accountId: string;    // Taboola advertiser account ID (externalId)
  dateRange?: DateRange; // required for stats syncs
}

export interface KeitaroSyncParams {
  dateRange: DateRange;
}

// ─── Sync result ──────────────────────────────────────────────────────────────

/** Returned by every sync service after completion */
export interface SyncResult {
  syncLogId: string;
  recordsFetched: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsFailed: number;
}

/** Incrementally accumulated during a sync run */
export class SyncCounter {
  fetched = 0;
  inserted = 0;
  updated = 0;
  skipped = 0;
  failed = 0;

  add(other: Partial<Omit<SyncCounter, "add" | "toResult">>): void {
    if (other.fetched) this.fetched += other.fetched;
    if (other.inserted) this.inserted += other.inserted;
    if (other.updated) this.updated += other.updated;
    if (other.skipped) this.skipped += other.skipped;
    if (other.failed) this.failed += other.failed;
  }

  toResult(): Omit<SyncResult, "syncLogId"> {
    return {
      recordsFetched: this.fetched,
      recordsInserted: this.inserted,
      recordsUpdated: this.updated,
      recordsSkipped: this.skipped,
      recordsFailed: this.failed,
    };
  }
}
