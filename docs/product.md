# Marmelad CRM — Product Overview

## What Is It

Marmelad CRM is an internal operational system for a media buying / performance marketing team. It is not a reporting dashboard — it is a tool for making decisions, controlling costs, and managing publishing relationships across traffic sources.

## Core Problem

Media buyers running campaigns on native ad networks (Taboola, etc.) and tracking conversions through trackers (Keitaro) face a fragmented workflow:

- Spend data lives in the ad platform
- Revenue and conversion data lives in the tracker
- Custom costs (tools, staff, freelancers) live in spreadsheets
- Publisher blacklist/whitelist decisions are made ad hoc
- There is no unified view of P&L at campaign or publisher level

Marmelad CRM solves this by centralizing all of the above into a single operational interface.

## Target Users

| Role | Usage |
|------|-------|
| Media Buyer | Daily campaign monitoring, publisher decisions, expense tracking |
| Team Lead | P&L overview, agency/account management |
| (Future) Analyst | Trend analysis, GEO breakdowns, custom reports |

MVP: 1 user. Expected to grow to 5 within 6 months.

## Key Capabilities

### 1. P&L Dashboard
- Total spend vs. total revenue
- ROI by campaign, publisher, GEO
- Breakdown by traffic source (extensible)

### 2. Campaign Management
- Sync active campaigns from Taboola
- View spend, clicks, conversions, revenue per campaign
- Cross-reference with Keitaro conversion data

### 3. Publisher Analytics
- Performance breakdown by site/publisher
- GEO-level analysis
- ROI-based ranking to support blacklist/whitelist decisions

### 4. Blacklist / Whitelist Workflows
- Create and manage named publisher lists (per platform)
- One-click push to ad platform API
- Audit log of list changes

### 5. Custom Expenses
- Record non-traffic costs: SaaS tools, staff, services
- Include in P&L calculation for accurate net ROI

### 6. Agency & Ad Account Management
- Link ad accounts to agencies
- Track spend attribution by agency
- Support for multiple platforms (Taboola, future: Facebook, Google, TikTok)

### 7. Settings & Integrations
- Connect Taboola via OAuth2
- Connect Keitaro via API key
- Configure sync schedule (cron-based via BullMQ)

## User Flows (MVP)

### Daily Operations
1. Open Dashboard → see yesterday's P&L snapshot
2. Go to Campaigns → review ROI per campaign
3. Go to Publishers → identify underperforming sites
4. Create blacklist entry → push to platform
5. Log a new expense → reflected in P&L

### Weekly Review
1. Export P&L report by date range
2. Review agency-level spend attribution
3. Adjust sync schedule if needed

## Out of Scope (MVP)
- Multi-user authentication / roles
- Automated alerting / anomaly detection
- Facebook / Google / TikTok integrations
- Automated bidding or campaign control
- Customer-facing portal
