# Marmelad CRM — Business Entities

## Entity Map

```
Agency
  └── AdAccount (many, per platform)

Campaign (synced from Taboola)
  └── CampaignStat (daily snapshots)
  └── PublisherStat (per publisher per day)

Publisher
  └── PublisherEntry (in lists)
      └── PublisherList (blacklist / whitelist)

Expense (manual, custom costs)

SyncLog (audit trail of all syncs)
```

---

## Agency

Represents an advertising agency that manages one or more ad accounts.

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | Primary key |
| name | string | Display name |
| adAccounts | AdAccount[] | Linked accounts |
| createdAt | DateTime | |
| updatedAt | DateTime | |

---

## AdAccount

A platform-specific advertising account. One agency can have multiple accounts across multiple platforms.

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | Primary key |
| name | string | Human-readable label |
| platform | string | `"taboola"`, `"facebook"`, etc. |
| accountId | string | External ID from the platform |
| agencyId | string? | Optional agency link |
| isActive | boolean | Soft disable without deleting |

**Unique constraint:** `[platform, accountId]` — prevents duplicate imports.

---

## Campaign _(Phase 2)_

Synced from a traffic source (initially Taboola). Represents an active or archived advertising campaign.

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | |
| externalId | string | Platform campaign ID |
| platform | string | Traffic source |
| adAccountId | string | Link to AdAccount |
| name | string | Campaign name |
| status | string | `"active"`, `"paused"`, `"stopped"` |
| budget | Decimal | Daily budget |
| currency | string | `"USD"` etc. |

---

## CampaignStat _(Phase 2)_

Daily performance snapshot for a campaign (spend side).

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | |
| campaignId | string | |
| date | DateTime | Day of stat |
| spend | Decimal | Traffic cost |
| clicks | int | |
| impressions | int | |

---

## PublisherStat _(Phase 2)_

Daily performance per publisher/site within a campaign. Used for blacklist/whitelist analysis.

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | |
| campaignId | string | |
| publisherId | string | Platform site ID |
| publisherName | string | Display name |
| geo | string | 2-letter country code |
| date | DateTime | |
| spend | Decimal | |
| clicks | int | |
| conversions | int | From Keitaro |
| revenue | Decimal | From Keitaro |

---

## Conversion _(Phase 2)_

Synced from Keitaro. Represents a tracked conversion event.

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | |
| keitaroCampaignId | string | |
| publisherId | string | |
| geo | string | |
| date | DateTime | |
| revenue | Decimal | Payout from Keitaro |
| leadStatus | string | `"approved"`, `"pending"`, `"rejected"` |

---

## Expense

Manually entered custom business expense. Included in P&L calculation.

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | |
| name | string | Description |
| amount | Decimal(12,2) | |
| currency | string | Default `"USD"` |
| category | string | `"tools"`, `"staff"`, `"services"`, `"other"` |
| date | DateTime | Expense date |
| notes | string? | Optional memo |

---

## PublisherList

A named collection of publisher IDs used as a blacklist or whitelist for a specific platform.

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | |
| name | string | e.g., `"Taboola Global Blacklist"` |
| type | enum | `BLACKLIST` or `WHITELIST` |
| platform | string | `"taboola"` etc. |
| entries | PublisherEntry[] | |

---

## PublisherEntry

A single publisher ID within a PublisherList.

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | |
| publisherId | string | Platform site/publisher ID |
| publisherName | string? | Human-readable label |
| listId | string | Parent list |
| addedAt | DateTime | Audit timestamp |

**Unique constraint:** `[listId, publisherId]` — no duplicates per list.

---

## SyncLog

Audit record for every background sync operation.

| Field | Type | Notes |
|-------|------|-------|
| id | cuid | |
| source | string | `"taboola"`, `"keitaro"` |
| type | string | `"campaigns"`, `"publishers"`, etc. |
| status | string | `"success"`, `"error"`, `"partial"` |
| startedAt | DateTime | |
| finishedAt | DateTime? | Null if still running or failed |
| error | string? | Error message if status = `"error"` |
| meta | Json? | Additional debug info |

---

## Glossary

| Term | Definition |
|------|-----------|
| **Traffic Source** | Ad platform where spend happens (Taboola, Facebook, etc.) |
| **Tracker** | Conversion tracking system (Keitaro) |
| **Publisher** | A website/app that shows your ads (also called site or placement) |
| **GEO** | Geographic target (country code, e.g., `"US"`, `"DE"`) |
| **ROI** | `(Revenue - Spend) / Spend * 100` |
| **P&L** | Profit & Loss — revenue minus all costs (spend + expenses) |
| **Blacklist** | List of publishers where ads are blocked |
| **Whitelist** | List of publishers where ads are exclusively shown |
| **CPC** | Cost per click |
| **CPL** | Cost per lead / conversion |
