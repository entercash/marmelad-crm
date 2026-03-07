# Marmelad CRM — Development Roadmap

## Phase 1 — Foundation (Current)
> Goal: Production-ready project skeleton. Zero placeholder code in the critical path.

- [x] Next.js 14 + TypeScript + App Router
- [x] Tailwind CSS + shadcn/ui
- [x] Prisma schema (extensible base)
- [x] BullMQ + Redis queue system (placeholder workers)
- [x] Docker Compose for local dev (PostgreSQL + Redis)
- [x] Dockerfile for production deployment
- [x] Base layout: sidebar + page structure
- [x] Placeholder pages: Dashboard, Campaigns, Publishers, Expenses, Agencies, Ad Accounts, Settings
- [x] Integration stubs: Taboola, Keitaro
- [x] Healthcheck API route
- [x] Project documentation

---

## Phase 2 — Data Integration
> Goal: Real data flowing from Taboola and Keitaro into the database.

### Taboola Connector
- [ ] OAuth2 authentication flow (client credentials)
- [ ] Ad account discovery
- [ ] Campaign list sync
- [ ] Daily campaign performance stats sync
- [ ] Publisher/site performance stats sync

### Keitaro Connector
- [ ] API key authentication
- [ ] Campaign list sync
- [ ] Conversion data pull (by date range)
- [ ] Revenue reporting pull

### Sync Infrastructure
- [ ] BullMQ workers: implement job handlers
- [ ] Scheduled sync via cron expressions
- [ ] SyncLog records written per sync
- [ ] Error alerting on repeated failures

### Data Model Expansion
- [ ] Campaign, CampaignStat, PublisherStat models
- [ ] Conversion model (Keitaro)
- [ ] Prisma migrations for all new tables

---

## Phase 3 — Analytics & Operations
> Goal: Core CRM value — P&L visibility and publisher management.

### P&L Engine
- [ ] ROI calculation: (revenue - spend - expenses) / spend
- [ ] Daily P&L snapshots stored in DB
- [ ] Campaign-level P&L view
- [ ] Publisher-level P&L view

### Dashboard
- [ ] Live stat cards (spend, revenue, ROI, clicks)
- [ ] Date range picker
- [ ] Trend charts (spend vs. revenue over time)

### Campaigns Page
- [ ] Campaign table with sortable columns
- [ ] Per-campaign P&L, spend, clicks, conversions
- [ ] Campaign status badges

### Publishers Page
- [ ] Publisher table with performance metrics
- [ ] GEO breakdown per publisher
- [ ] ROI-ranked publisher list
- [ ] One-click blacklist action

### Blacklist / Whitelist
- [ ] Create and name lists
- [ ] Add/remove publishers
- [ ] Push list to Taboola API
- [ ] Change audit log

### Expenses Page
- [ ] Add/edit/delete expense entries
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
| Add input validation (Zod) on Server Actions | High | 2 |
| Rate limiting for API routes | Medium | 3 |
| Structured logging (Pino) | Low | 3 |
