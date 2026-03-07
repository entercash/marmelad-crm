# Marmelad CRM — Development Roadmap

## Phase 1 — Foundation ✅
> Goal: Production-ready project skeleton. Zero placeholder code in the critical path.

- [x] Next.js 14 + TypeScript + App Router
- [x] Tailwind CSS + shadcn/ui
- [x] Prisma schema (extensible base, 19 models, 8 enums)
- [x] BullMQ + Redis queue system (placeholder workers)
- [x] Docker Compose for local dev (PostgreSQL + Redis)
- [x] Dockerfile + Dockerfile.worker for production deployment
- [x] Base layout: sidebar + page structure
- [x] Placeholder pages: Dashboard, Campaigns, Publishers, Expenses, Agencies, Ad Accounts, Settings
- [x] Integration stubs: Taboola, Keitaro
- [x] Healthcheck API route
- [x] Project documentation

---

## Phase 2 — Data Integration ✅
> Goal: Real data flowing from Taboola and Keitaro into the database.

### Taboola Connector ✅
- [x] OAuth2 authentication (client credentials)
- [x] Ad account discovery
- [x] Campaign list sync
- [x] Daily campaign performance stats sync
- [x] Item (creative) stats sync
- [x] Publisher/site performance stats sync

### Keitaro Connector ✅
- [x] API key authentication
- [x] Conversion data pull (by date range)

### Sync Infrastructure ✅
- [x] BullMQ workers: job handlers for Taboola and Keitaro
- [x] SyncLog records written per sync job
- [x] RawImportBatch storage for debugging
- [x] Graceful worker shutdown (SIGTERM/SIGINT)

### Database ✅
- [x] Prisma migrations (`20260307000000_init` — full schema, 19 tables)
- [x] Switched from `db push` to `prisma migrate deploy` workflow
- [x] Seed data: TrafficSources + ExpenseCategories

---

## Phase 3 — Analytics & Operations (In Progress)
> Goal: Core CRM value — P&L visibility and publisher management.

### Read-Only CRM UI ✅
- [x] Dashboard stat cards with live DB queries (campaigns, publishers, accounts, expenses, last sync)
- [x] Campaigns page: server-rendered table with status/budget/source, URL-param filters
- [x] Publishers page: server-rendered table with list status, quality label, domain search
- [x] Feature query layer: `src/features/dashboard/queries.ts`, `campaigns/`, `publishers/`
- [x] Shared UI components: `StatCard`, `EmptyState`
- [x] Format helpers: `src/lib/format.ts` (dates, status labels, badge variants)

### Agencies CRUD ✅
- [x] Schema: 5 new Agency fields (website, contact, accountCostUsd, commissionPercent, cryptoPaymentPercent)
- [x] Migration: `20260307000001_agency_fields`
- [x] Server actions: create, update, delete with Zod validation and field-level errors
- [x] Delete guard: blocks deletion if linked ad accounts exist, with count in error message
- [x] Agencies list page: table with all fields, formatted currency/percent, action buttons
- [x] Create dialog: "New Agency" button opens form, saves, refreshes table
- [x] Edit dialog: pre-filled form per row, saves changes, refreshes table
- [x] Delete: two-step confirmation inline per row, handles constraint errors gracefully
- [x] New shared UI primitives: `Input`, `Label`, `Textarea`, `Dialog` (portal-based)

### White Pages CRUD ✅
- [x] Schema: new `WhitePage` model + `WhitePageStatus` enum (6 values)
- [x] Migration: `20260308000000_white_pages`
- [x] Server actions: create, update, delete with Zod validation and field-level errors
- [x] White Pages list page: table with all 9 data columns + actions
- [x] Status badge: colour-coded, Russian labels in UI (DB stores enum value)
- [x] Create dialog: "Add White Page" button opens form, saves, refreshes table
- [x] Edit dialog: pre-filled form per row (date, GEO, URL, topic, zoho email, password, legal entity, tax number, status)
- [x] Delete: two-step confirmation inline per row
- [x] Sidebar: "White Pages" link added to Operations group

### P&L Engine
- [ ] Campaign mapping UI (link Taboola campaign ↔ Keitaro campaign)
- [ ] ROI calculation: (netRevenue - spend) / spend × 100
- [ ] Daily P&L snapshots stored in PnlDaily
- [ ] Campaign-level P&L view
- [ ] Publisher-level P&L view

### Dashboard Enhancements
- [ ] Date range picker (filter stat cards by period)
- [ ] Trend sparklines (spend vs. revenue over time)
- [ ] Sync history log on dashboard

### Campaigns Page Enhancements
- [ ] Sortable columns (spend, ROI, clicks)
- [ ] Per-campaign P&L, spend, clicks, conversions columns
- [ ] Link to campaign detail / item breakdown

### Publishers Page Enhancements
- [ ] GEO breakdown per publisher
- [ ] ROI-ranked publisher list
- [ ] One-click blacklist / whitelist action

### Blacklist / Whitelist Management
- [ ] Create and name publisher lists
- [ ] Add/remove publisher entries
- [ ] Push list to Taboola API
- [ ] Change audit log

### Expenses CRUD ✅
- [x] Schema: added `vendor` field to Expense model
- [x] Migration: `20260308000001_expense_vendor`
- [x] Seed: 9 categories (Accounts, AI Services, Domains, Traffic, Tools, Staff, Infrastructure, Services, Other)
- [x] Server actions: create, update, delete with Zod validation and field-level errors
- [x] Expenses list page: table with Date, Category, Title, Vendor, Amount (USD), Recurrence, Notes, Actions
- [x] Summary block: real DB-based totals — total count, total spent, breakdown by category with colour dots
- [x] Category badge: colour-coded per category with dot indicator
- [x] Create dialog: "Add Expense" button opens form with date (defaults to today), category select, title, amount, recurrence, vendor, notes
- [x] Edit dialog: pre-filled form per row, saves changes, refreshes table
- [x] Delete: two-step confirmation inline per row
- [x] Amounts right-aligned, monospace, formatted as USD ($1,234.56)
- [x] Long notes/titles truncated with title tooltip
- [x] Empty values displayed as "—"
- [x] Graceful error handling — page renders empty state if DB is unreachable
- [ ] Category filter
- [ ] Monthly total included in P&L

---

## Phase 4 — Scaling & Multi-User
> Goal: Support a team of up to 5, with roles and better tooling.

### Authentication
- [ ] NextAuth.js integration (email + password or SSO)
- [ ] Role-based access: Admin, Analyst, Viewer

### Additional Traffic Sources
- [ ] Facebook Ads connector
- [ ] Google Ads connector
- [ ] TikTok Ads connector (optional)

### Reporting
- [ ] Export P&L to CSV / Excel
- [ ] Scheduled email reports
- [ ] Date-range comparison

### Performance
- [ ] Redis caching for dashboard stats
- [ ] Pagination for all data tables
- [ ] Background pre-aggregation jobs

---

## Technical Debt Tracking

| Item | Priority | Phase |
|------|----------|-------|
| Add unit tests for P&L calculation | High | 3 |
| Add integration tests for sync jobs | Medium | 2 |
| Set up CI/CD pipeline (GitHub Actions) | Medium | 2 |
| ~~Add input validation (Zod) on Server Actions~~ | ~~High~~ | ~~2~~ |
| Rate limiting for API routes | Medium | 3 |
| Structured logging (Pino) | Low | 3 |
| Pagination for campaigns/publishers tables (>200/300 rows) | Medium | 3 |
