# Data Pipeline

How Marmelad CRM pulls, normalises, and stores data from Taboola (spend) and Keitaro (conversions).

---

## Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                       External APIs                              │
│                                                                  │
│   Taboola Backstage API          Keitaro Tracker API             │
│   (OAuth2, REST/JSON)            (API Key, POST reports)         │
└──────────────┬───────────────────────────┬───────────────────────┘
               │                           │
               ▼                           ▼
┌──────────────────────────────────────────────────────────────────┐
│              Integration Layer  (src/integrations/)              │
│                                                                  │
│   TaboolaClient                  KeitaroClient                   │
│   • OAuth2 token mgmt            • API-Key header auth           │
│   • getCampaigns()               • buildReport()                 │
│   • getCampaignItems()           • getConversionStatsDaily()     │
│   • getCampaignStatsDaily()                                      │
│   • getItemStatsDaily()                                          │
│   • getPublisherStatsDaily()                                     │
└──────────────┬───────────────────────────┬───────────────────────┘
               │                           │
               ▼                           ▼
┌──────────────────────────────────────────────────────────────────┐
│              Sync Orchestration  (src/services/sync/)            │
│                                                                  │
│   taboola.sync.ts                keitaro.sync.ts                 │
│   • syncTaboolaCampaigns()       • syncKeitaroConversionStats    │
│   • syncTaboolaCampaignStats()     Daily()                       │
│   • syncTaboolaItemStats()                                       │
│   • syncTaboolaPublisherStats()                                  │
│                                                                  │
│   Every function follows this pipeline:                          │
│   1. Open SyncLog (status=RUNNING)                               │
│   2. Fetch raw data from integration client                      │
│   3. Persist raw JSON to RawImportBatch                          │
│   4. Call upsert service (normalise + write)                     │
│   5. Close SyncLog (status=SUCCESS / FAILED)                     │
└──────────────┬───────────────────────────┬───────────────────────┘
               │                           │
               ▼                           ▼
┌──────────────────────────────────────────────────────────────────┐
│              Upsert / Normalisation  (src/services/upsert/)      │
│                                                                  │
│   campaigns.upsert.ts            conversion-stats.upsert.ts     │
│   campaign-items.upsert.ts       (Keitaro)                      │
│   publishers.upsert.ts                                           │
│   campaign-stats.upsert.ts       All upserts are idempotent:    │
│   item-stats.upsert.ts           prisma.upsert() on composite   │
│   publisher-stats.upsert.ts      unique keys. Safe to re-run.   │
└──────────────┬───────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────┐
│              PostgreSQL  (via Prisma)                            │
│                                                                  │
│   campaigns                      conversion_stats_daily          │
│   campaign_items                 sync_logs                       │
│   publishers                     raw_import_batches              │
│   campaign_stats_daily                                           │
│   campaign_item_stats_daily                                      │
│   publisher_stats_daily                                          │
└──────────────────────────────────────────────────────────────────┘
```

Jobs are dispatched via BullMQ. The sync orchestrators and upsert services can also be called directly (e.g. from scripts or tests).

---

## Integration Clients

### Taboola (`src/integrations/taboola/`)

**Auth:** OAuth2 client-credentials flow.

- `TaboolaClient` requests a token from `https://backstage.taboola.com/backstage/oauth/token`.
- Tokens are cached in-process and refreshed 2 minutes before expiry — no Redis round-trip on every API call.
- All data requests go to `https://backstage.taboola.com/backstage/api/1.0/{accountId}/`.

**Key env vars:** `TABOOLA_CLIENT_ID`, `TABOOLA_CLIENT_SECRET`, `TABOOLA_ACCOUNT_ID`

**Methods:**

| Method | Endpoint | Returns |
|--------|----------|---------|
| `getCampaigns()` | `GET campaigns/` | All campaigns for the account |
| `getCampaignItems(campaignId)` | `GET campaigns/{id}/items/` | All creatives for a campaign |
| `getCampaignStatsDaily(params)` | `GET reports/campaign-summary/dimensions/by_date/` | Spend/clicks/impressions per campaign per day |
| `getItemStatsDaily(params)` | `GET reports/campaign-item-summary/dimensions/by_date/` | Stats per creative per day |
| `getPublisherStatsDaily(params)` | `GET reports/campaign-site-day-breakdown/dimensions/by_site_breakdown/` | Stats per publisher × campaign × day |

All stat endpoints accept `start_date` and `end_date` in `YYYY-MM-DD` format.

---

### Keitaro (`src/integrations/keitaro/`)

**Auth:** Static API key sent as `Api-Key` request header.

- `KeitaroClient` POSTs to `/api/v1/report/build` on your self-hosted Keitaro instance.
- Reports are defined by a `KeitaroReportRequest` — grouping dimensions, date range, filters.

**Key env vars:** `KEITARO_API_URL`, `KEITARO_API_KEY`

**Methods:**

| Method | Groups by | Returns |
|--------|-----------|---------|
| `getConversionStatsDaily(params)` | `day`, `campaign_id`, `sub_id` | Leads, sales, rejected, revenue per day |

> Keitaro numeric fields may be returned as `string` or `number` depending on API version. The upsert layer handles both via `toInt()` / `toDecimal()` helpers.

---

## Sync Orchestration (`src/services/sync/`)

### Shared pipeline (every sync function follows this)

```
createSyncLog(source, jobType)     ← opens audit record, status=RUNNING
    ↓
fetch from integration client      ← API call
    ↓
writeRawBatch(syncLogId, payload)  ← persist raw JSON BEFORE normalisation
    ↓
upsert service(rows)               ← normalise + write to normalised tables
    ↓
completeSyncLog(id, counters)      ← status=SUCCESS, record counts
   OR
failSyncLog(id, error)             ← status=FAILED, error message
```

Raw batches are written **before** normalisation so that any normalisation bug can be fixed and the batch re-processed without hitting the API again.

### Taboola sync functions (`taboola.sync.ts`)

#### `syncTaboolaCampaigns({ accountId })`

1. Fetches all campaigns via `getCampaigns()`.
2. Calls `upsertCampaigns(rows, trafficSourceId)`.
3. Returns `SyncResult` with `recordsFetched`, `recordsUpdated`, `recordsFailed`.

The campaign sync is the **prerequisite** for all stat syncs — campaign rows must exist before stats can reference them.

#### `syncTaboolaCampaignStatsDaily({ accountId, dateRange })`

1. Fetches campaign-level daily stats.
2. Resolves internal campaign IDs from `externalId` lookup.
3. Calls `upsertCampaignStats(rows, campaignIdMap)`.

#### `syncTaboolaItemStatsDaily({ accountId, dateRange })`

1. Fetches item-level daily stats.
2. Resolves internal `CampaignItem` IDs.
3. Calls `upsertItemStats(rows, itemIdMap)`.

#### `syncTaboolaPublisherStatsDaily({ accountId, dateRange })`

This is the highest-volume sync. For each date range:

1. Fetches publisher × campaign × day breakdown.
2. Auto-creates `Publisher` records for any new site names (via `upsertPublishers`).
3. Resolves `publisherIdMap` and `campaignIdMap`.
4. Calls `upsertPublisherStats(rows, publisherIdMap, campaignIdMap)`.

Publisher records are created from stat rows if they don't exist yet — no separate publisher-discovery step is needed.

### Keitaro sync functions (`keitaro.sync.ts`)

#### `syncKeitaroConversionStatsDaily({ dateRange })`

1. Fetches conversion report grouped by `day × campaign_id × sub_id`.
2. Calls `upsertConversionStats(rows)`.

Conversion data is stored independently in `ConversionStatsDaily`. It is **not** joined to Taboola at this layer. The join happens in `PnlDaily` via `CampaignMapping`.

---

## Upsert / Normalisation (`src/services/upsert/`)

All upsert services are **idempotent** — running them twice with the same data produces the same result. This means syncs are safe to re-run after failures or for backfill.

### Chunked transactions

Prisma has no native bulk-upsert-with-conflict-resolution. We use:

```typescript
await prisma.$transaction(
  chunk.map((row) => prisma.someModel.upsert({ where, update, create }))
);
```

Chunks are sized to keep transaction duration short:

| Service | Chunk size |
|---------|-----------|
| campaigns | 50 |
| campaign items | 50 |
| publishers | 50 |
| campaign stats | 100 |
| item stats | 100 |
| publisher stats | 50 (high-volume, GEO fan-out) |
| conversion stats | 100 |

### Key normalisation rules

| Concern | Rule |
|---------|------|
| **GEO code** | Taboola may return `""` for unknown country. Normalised to `"XX"` (sentinel). Unique constraint on `(publisherId, campaignId, date, geo)` requires a non-null stable value. |
| **Decimal money** | All spend / revenue / CPC / CTR stored as `Prisma.Decimal`. Avoids IEEE 754 drift in aggregation. |
| **Dates** | Taboola returns `"YYYY-MM-DD"` strings. Converted to `Date` objects via `fromApiDate()` which sets time to `00:00:00 UTC`. Stored as `@db.Date` (date-only). |
| **Campaign status** | Taboola `RUNNING/PAUSED/STOPPED` mapped to our `CampaignStatus` enum. Unknown values fall back to `PAUSED`. |
| **Item status** | Taboola `CRAWLING/RUNNING/PAUSED/STOPPED/WITH_ERRORS` mapped to `CampaignItemStatus`. |
| **Publisher domain** | `extractDomain()` strips `http://`, `www.`, trailing slashes. Stored normalised in `Publisher.domain`. |
| **Keitaro numerics** | `number \| string` union from API. `toInt()` and `toDecimal()` coerce safely. |
| **Conversion pending** | `pending = leads - sales - rejected`. Computed at upsert time, not stored from API. |

### Skipped rows

A row is skipped (counted in `recordsSkipped`, not written) when a required foreign key cannot be resolved:

- Publisher stat row whose `site` has no entry in `publisherIdMap` → skipped.
- Publisher stat row whose `campaign_id` has no entry in `campaignIdMap` → skipped.
- Item stat row whose `item_id` has no entry in `itemIdMap` → skipped.

Skipped counts are surfaced in the `SyncResult` and `SyncLog` for observability.

---

## Job Queue Layer (`src/jobs/`)

### Architecture

```
Next.js (API routes / Server Actions)
   └─ imports from src/jobs/index.ts
        └─ re-exports from queues.ts (Queue instances + enqueue helpers)
        └─ re-exports from types.ts  (payload types)

Standalone worker process (npm run worker)
   └─ imports from src/jobs/worker.ts
        └─ creates BullMQ Worker for "data-sync" queue
        └─ routes by job type prefix ("taboola:" / "keitaro:")
        └─ delegates to handlers/taboola.handlers.ts
                       handlers/keitaro.handlers.ts
```

> **Rule:** Never import `Worker` or `worker.ts` from within Next.js. Only queue instances and enqueue helpers cross that boundary.

### Queues

| Queue name | Payload type | Purpose |
|------------|--------------|---------|
| `data-sync` | `SyncJobPayload` | All Taboola + Keitaro data imports |
| `pnl-aggregate` | `AggregateJobPayload` | P&L re-computation after syncs (Phase 3) |

Default job options: **3 attempts**, exponential backoff starting at 10 s. Completed jobs retained for 200, failed for 100.

### Job types

| Type string | Handler | Payload fields |
|-------------|---------|----------------|
| `taboola:campaigns` | `handleCampaigns` | `accountId` |
| `taboola:campaign-stats-daily` | `handleCampaignStats` | `accountId`, `startDate`, `endDate` |
| `taboola:item-stats-daily` | `handleItemStats` | `accountId`, `startDate`, `endDate` |
| `taboola:publisher-stats-daily` | `handlePublisherStats` | `accountId`, `startDate`, `endDate` |
| `keitaro:conversion-stats-daily` | `handleConversionStats` | `startDate`, `endDate` |

### Handlers (`src/jobs/handlers/`)

Handlers are intentionally thin:

1. Validate payload fields (throw `ValidationError` → BullMQ marks job as failed, no retry if it's a data error).
2. Delegate to sync service.
3. Log result counters.

`ValidationError` is a non-retryable signal. Infrastructure errors (network, DB) are ordinary thrown errors — BullMQ retries them per the backoff config.

### Worker process (`src/jobs/worker.ts`)

- Runs standalone: `npm run worker` (production) / `npm run worker:dev` (watch mode).
- Concurrency: 2 simultaneous jobs (configurable via `WORKER_CONCURRENCY`).
- Stalled job threshold: 30 s — jobs that don't heartbeat are re-queued (up to `maxStalledCount: 2`).
- Graceful shutdown: SIGTERM / SIGINT → `worker.close()` → `process.exit(0)`. In-flight jobs complete before exit.

---

## Sync Audit (`SyncLog` + `RawImportBatch`)

Every sync run creates a `SyncLog` record:

| Field | Description |
|-------|-------------|
| `source` | `"taboola"` or `"keitaro"` |
| `jobType` | e.g. `"taboola:publisher-stats-daily"` |
| `status` | `RUNNING → SUCCESS / FAILED` |
| `startedAt` / `finishedAt` | Wall-clock duration |
| `recordsFetched` | Rows returned by the API |
| `recordsUpdated` | Rows written to the DB |
| `recordsSkipped` | Rows with unresolvable FK |
| `recordsFailed` | Rows that errored during upsert |
| `errorMessage` | Set only on `FAILED` |

Every sync also writes a `RawImportBatch` before any normalisation:

| Field | Description |
|-------|-------------|
| `syncLogId` | Links to the parent `SyncLog` |
| `source` | Same as SyncLog |
| `payload` | Raw API response as JSON |
| `processedAt` | Set after successful normalisation |

This allows re-processing stale or corrupt normalised data by replaying raw batches without re-hitting the API.

---

## What Is Implemented vs Stubbed

| Component | Status | Notes |
|-----------|--------|-------|
| Taboola OAuth2 client | ✅ Implemented | In-process token cache |
| Taboola campaign fetch | ✅ Implemented | |
| Taboola stats fetches (3 types) | ✅ Implemented | |
| Keitaro report client | ✅ Implemented | |
| Keitaro conversion fetch | ✅ Implemented | |
| Sync orchestrators (5 functions) | ✅ Implemented | |
| Upsert services (7 files) | ✅ Implemented | Chunked, idempotent |
| SyncLog + RawImportBatch | ✅ Implemented | |
| BullMQ queue definitions | ✅ Implemented | |
| BullMQ enqueue helpers | ✅ Implemented | |
| BullMQ worker process | ✅ Implemented | |
| Job handlers (Taboola + Keitaro) | ✅ Implemented | |
| P&L aggregation (`pnl:aggregate`) | 🔲 Stubbed | Queue exists, no handler yet |
| Keitaro revenue sync | 🔲 Stubbed | Client method exists, no job type |
| Scheduled job triggers | 🔲 Not started | Phase 3 — cron or BullMQ repeatable |
| Backfill UI / API route | 🔲 Not started | Phase 3 |
| Re-process raw batch endpoint | 🔲 Not started | Phase 3 |

---

## Running a Sync Manually

### Via enqueue helper (preferred in code)

```typescript
import { enqueueTaboolaPublisherStats } from "@/jobs";

await enqueueTaboolaPublisherStats("1234567", "2026-03-01", "2026-03-06");
```

### Via sync service directly (scripts / one-off runs)

```typescript
import { syncTaboolaPublisherStatsDaily } from "@/services/sync/taboola.sync";

const result = await syncTaboolaPublisherStatsDaily({
  accountId: "1234567",
  dateRange: { startDate: "2026-03-01", endDate: "2026-03-06" },
});
console.log(result);
// { recordsFetched: 8420, recordsUpdated: 8105, recordsSkipped: 315, recordsFailed: 0 }
```

### Via worker (normal operation)

```bash
# Terminal 1 — Next.js dev server
npm run dev

# Terminal 2 — BullMQ worker (watch mode for development)
npm run worker:dev

# Production — run worker as a separate process / container
npm run worker
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `TABOOLA_CLIENT_ID` | ✅ | Taboola OAuth2 client ID |
| `TABOOLA_CLIENT_SECRET` | ✅ | Taboola OAuth2 client secret |
| `TABOOLA_ACCOUNT_ID` | ✅ | Default Taboola account (numeric string) |
| `KEITARO_API_URL` | ✅ | Base URL of your Keitaro instance |
| `KEITARO_API_KEY` | ✅ | Keitaro API key with Reports access |
| `TABOOLA_BASE_URL` | optional | Override Taboola API base URL |
| `KEITARO_TIMEOUT_MS` | optional | HTTP timeout for Keitaro reports (default: 30 000) |
| `WORKER_CONCURRENCY` | optional | BullMQ worker concurrency (default: 2) |
| `WORKER_STALLED_INTERVAL` | optional | Stalled job interval in ms (default: 30 000) |
