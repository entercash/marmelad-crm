# Marmelad CRM — Data Model Reference

## Overview

The data model is organized into **8 domains**. Each domain maps to a business concern and is designed to be extended without breaking existing queries.

The **central architectural concept** is the separation of:
- **Spend data** — sourced from Taboola (campaigns, items, publishers, daily spend stats)
- **Conversion data** — sourced from Keitaro (conversions, revenue, lead status)
- **Mapping layer** — the explicit link that makes cross-system P&L possible

---

## How Taboola and Keitaro Connect

Taboola and Keitaro operate independently. They are joined through the `campaign_mappings` table.

```
Taboola Campaign  ──────┐
(stored in `campaigns`) │
                         ├── CampaignMapping ──── ConversionStatsDaily
Keitaro Campaign  ───────┘                         (source = "keitaro",
(external ID only)                                  externalCampaignId = Keitaro ID)
```

**The join for P&L** (executed at query time or by the aggregation job):

```sql
SELECT
  cm.id                       AS mapping_id,
  cs.date,
  cs.spend,
  cvs.net_revenue,
  cvs.net_revenue - cs.spend  AS gross_profit
FROM campaign_mappings cm
JOIN campaign_stats_daily  cs  ON cs.campaign_id = cm.spend_campaign_id
JOIN conversion_stats_daily cvs
  ON  cvs.source               = cm.conversion_source
  AND cvs.external_campaign_id = cm.conversion_external_id
  AND cvs.date                 = cs.date
```

**Key design rule:** Keitaro campaigns are NOT stored in the `campaigns` table. The `Campaign` model is for spend-side entities (Taboola) only. This avoids conflating two very different operational concepts.

---

## Source-Specific vs Source-Agnostic Tables

| Table | Type | Notes |
|-------|------|-------|
| `traffic_sources` | Agnostic | Defines all platforms |
| `agencies` | Agnostic | Platform-independent |
| `ad_accounts` | Agnostic | Has `trafficSourceId` FK |
| `campaigns` | **Spend-source specific** | Taboola only in MVP |
| `campaign_items` | **Spend-source specific** | Taboola items/creatives |
| `publishers` | **Spend-source specific** | Has `trafficSourceId` FK |
| `campaign_mappings` | Agnostic bridge | Links spend ↔ conversion |
| `campaign_stats_daily` | **Spend-source specific** | Taboola stats |
| `campaign_item_stats_daily` | **Spend-source specific** | Taboola item stats |
| `publisher_stats_daily` | **Spend-source specific** | Taboola publisher stats |
| `conversion_stats_daily` | **Conversion-source specific** | Keitaro stats |
| `publisher_lists` | Agnostic (scoped by source) | Has `trafficSourceId` |
| `publisher_list_entries` | Agnostic | Via `publisher` FK |
| `publisher_quality_scores` | Agnostic | Computed cross-source |
| `expense_categories` | Agnostic | |
| `expenses` | Agnostic | |
| `pnl_daily` | Agnostic | Computed from both sides |
| `sync_logs` | Agnostic | |
| `raw_import_batches` | Agnostic | |

---

## Domain 1 — Traffic Sources & Accounts

### `traffic_sources`
**Why it exists:** The root anchor for multi-source architecture. Every campaign, publisher, and sync operation references a traffic source. Adding a new platform (Facebook, Google) means inserting one row here — nothing else changes in the schema.

Seeded at startup: `taboola` (SPEND_SOURCE), `keitaro` (CONVERSION_SOURCE).

### `agencies`
**Why it exists:** Advertisers often run multiple ad accounts through one or more agencies. This model tracks those relationships for spend attribution and account management. Fully optional — an `AdAccount` can exist without an agency.

### `ad_accounts`
**Why it exists:** Campaigns live inside ad accounts on the platform. Tracking accounts separately allows us to:
- Filter performance by account
- Attribute spend to an agency
- Manage multiple accounts per platform
- Store the platform's external account ID for API calls

**Unique constraint:** `[trafficSourceId, externalId]` — prevents importing the same account twice.

---

## Domain 2 — Campaign Structure

### `campaigns`
**Why it exists:** The primary entity synced from Taboola. Holds the campaign metadata (name, status, budget, bid) and acts as the anchor for all spend stats and publisher stats.

**Important:** Only spend-side campaigns live here. Keitaro campaigns are tracked by external ID only (in `campaign_mappings` and `conversion_stats_daily`).

**Unique constraint:** `[trafficSourceId, externalId]` — supports safe upserts on every sync.

### `campaign_items`
**Why it exists:** Taboola campaigns contain individual ad units (items) with their own title, image, and URL. Item-level stats enable creative performance analysis: which headline converts best, which thumbnail drives the lowest CPC.

### `publishers`
**Why it exists:** The site/placement where an ad appears. Publisher records are created as they appear in Taboola's publisher stats API. Publishers are source-specific (`trafficSourceId`), because the same domain may be a Taboola "site" and a future Facebook placement — different systems, different IDs.

The `domain` field (e.g. `"example.com"`) is a normalized root domain for cross-source deduplication in the UI.

---

## Domain 3 — Mapping Layer

### `campaign_mappings`
**Why it exists:** This is the most important table in the system. Without it, there is no P&L — only spend data on one side and conversion data on the other.

A mapping declares: *"This Taboola campaign corresponds to this Keitaro campaign."*

**Design decisions:**
- `spendCampaignId` → FK to `campaigns` (our internal ID)
- `conversionExternalId` → the Keitaro campaign ID as a string (no FK, because Keitaro campaigns are not stored in our DB)
- `conversionSource` → "keitaro" (allows future trackers)
- The triple `[spendCampaignId, conversionExternalId, conversionSource]` is unique — one Taboola campaign maps to exactly one Keitaro campaign per tracker (MVP constraint)

**MVP assumption:** Mapping is always 1:1 and created manually by the user. Auto-matching by URL parameter is a Phase 2 feature.

---

## Domain 4 — Spend Stats (Taboola)

### `campaign_stats_daily`
Daily aggregate spend/traffic metrics per campaign. One row per campaign per calendar day. Upserted (not appended) on every sync.

Derived metrics (`cpc`, `cpm`, `ctr`) are stored rather than computed at query time to support fast aggregations across large date ranges.

### `campaign_item_stats_daily`
Same structure as campaign stats, but at the item (creative) level. Enables creative A/B analysis without adding complexity to the campaign table.

### `publisher_stats_daily`
**The most query-intensive table in the system.** Stores per-publisher spend broken down by GEO. Used for:
- Publisher quality ranking
- GEO-level ROI analysis
- Blacklist/whitelist decision support

**Unique key:** `[publisherId, campaignId, date, geo]`

**GEO sentinel:** `"XX"` is used when GEO is not reported by the API. This avoids nullable GEO in a composite unique key (NULL != NULL in PostgreSQL unique indexes).

---

## Domain 5 — Conversion Stats (Keitaro)

### `conversion_stats_daily`
Daily aggregate conversion and revenue data from Keitaro. **Stored completely independently** from spend stats. Joined at query time via `campaign_mappings`.

**Lead status breakdown:**
- `conversions` = total received
- `approvedConversions` = confirmed/paid leads
- `pendingConversions` = awaiting approval
- `rejectedConversions` = declined/cancelled

**Revenue fields:**
- `grossRevenue` = revenue before rejections (optimistic)
- `netRevenue` = revenue after rejections (realistic — used for P&L)

**Why separate from campaigns:** Keitaro's data model is fundamentally different from a traffic source — it's a tracker, not a buying platform. Conflating the two would make the schema brittle.

---

## Domain 6 — Publisher Decision Layer

### `publisher_lists`
Named collections used to blacklist or whitelist publishers on a platform. Lists are scoped to a `trafficSource` and optionally to an `adAccount` (for account-specific lists).

### `publisher_list_entries`
Individual publisher entries within a list. Soft-delete pattern: entries are never hard-deleted — they get `status = REMOVED` and a `removedAt` timestamp. This preserves the audit trail of why a publisher was added and when it was removed.

**Re-adding a publisher:** update `status` back to `ACTIVE` and clear `removedAt`.

### `publisher_quality_scores`
A precomputed summary per publisher over a rolling time window (`windowDays`). Populated by background aggregation jobs. Empty at launch — included in MVP schema to avoid a disruptive migration when Phase 2 jobs are built.

---

## Domain 7 — Expenses & P&L

### `expense_categories`
Flexible taxonomy for custom expenses. Six categories are seeded at startup (system categories, `isSystem = true`). Users can create custom categories at runtime.

System categories: `traffic`, `tools`, `staff`, `infrastructure`, `services`, `other`.

### `expenses`
Manually entered operational costs. These are **global** (not per-campaign). They are included in net P&L by deducting them from the sum of campaign-level gross profits.

Supports recurring expenses (`recurrence` field) — but MVP only records them as one-time entries. Recurring generation is a Phase 2 automation.

### `pnl_daily`
Materialized P&L snapshot per campaign mapping per day. Populated/refreshed by the `pnl:aggregate` BullMQ job after every sync.

**What it is NOT:** This is not a view — it's a cached/materialized table. It may lag by up to one sync cycle. Use `computedAt` to detect stale rows.

**Global P&L:** Computed by summing all `pnl_daily` rows for a date range, then subtracting total `expenses.amount` for that period.

**Unmapped campaigns:** Campaigns without a `CampaignMapping` have no `pnl_daily` row. They appear in a separate "unmatched spend" report showing only spend data.

---

## Domain 8 — Sync Infrastructure

### `sync_logs`
One record per BullMQ job execution. Written at job start (`status = PENDING`), updated when the job completes. Provides:
- Operational visibility ("when was the last successful sync?")
- Error logging
- Record-count metrics for monitoring

### `raw_import_batches`
Stores the raw API response JSON from Taboola/Keitaro, linked to a `SyncLog`.

**Justification:** Both APIs are rate-limited. During Phase 2 development, bugs in the ingestion pipeline will occur. Having the raw payload allows re-processing without re-calling the API. It also enables full audit of what data was received.

**Production consideration:** Implement a retention policy — prune rows older than 30 days. The `[source, entityType, createdAt]` index supports efficient range-deletes.

---

## Index Strategy

| Table | Key Indexes | Purpose |
|-------|------------|---------|
| `campaign_stats_daily` | `[date]` | Date-range aggregations |
| `publisher_stats_daily` | `[campaignId, date]`, `[date, geo]` | Publisher by campaign; GEO analysis |
| `conversion_stats_daily` | `[source, externalCampaignId]`, `[date]` | Keitaro campaign lookup; date range |
| `campaign_mappings` | `[conversionExternalId, conversionSource]` | Reverse lookup from Keitaro ID |
| `publisher_list_entries` | `[publisherId]` | "Is publisher X in any list?" |
| `pnl_daily` | `[campaignMappingId]` | All P&L history for one mapping |
| `sync_logs` | `[source, status]`, `[startedAt]` | Monitoring queries |
| `raw_import_batches` | `[source, entityType, createdAt]` | Retention pruning |

---

## Entity Relationship Summary

```
TrafficSource
  ├── AdAccount (via trafficSourceId)
  │     └── Campaign
  │           ├── CampaignItem
  │           │     └── CampaignItemStatsDaily
  │           ├── CampaignStatsDaily
  │           ├── PublisherStatsDaily (also via Publisher)
  │           └── CampaignMapping (spendCampaign)
  │                 └── PnlDaily
  ├── Publisher (via trafficSourceId)
  │     ├── PublisherStatsDaily
  │     ├── PublisherListEntry → PublisherList
  │     └── PublisherQualityScore
  ├── PublisherList (via trafficSourceId)
  └── SyncLog (via trafficSourceId)

Agency
  └── AdAccount

ExpenseCategory
  └── Expense

ConversionStatsDaily (joined via CampaignMapping at query time)
```
