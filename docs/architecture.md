# Marmelad CRM — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                    Browser / UI                     │
│              Next.js 14 App Router                  │
│         (React Server + Client Components)          │
└───────────────────────┬─────────────────────────────┘
                        │ HTTP / Server Actions
┌───────────────────────▼─────────────────────────────┐
│                   API Layer                         │
│          Next.js Route Handlers (/api/*)             │
│         Server Actions (mutations)                  │
└──────────┬────────────────────────┬─────────────────┘
           │                        │
┌──────────▼──────────┐  ┌──────────▼──────────────┐
│   Business Logic    │  │    Job Queue (BullMQ)   │
│   (src/lib/*)       │  │    (src/jobs/*)          │
└──────────┬──────────┘  └──────────┬──────────────┘
           │                        │
┌──────────▼──────────┐  ┌──────────▼──────────────┐
│   Data Layer        │  │    Integrations          │
│   Prisma ORM        │  │  (src/integrations/*)    │
│   PostgreSQL        │  │  Taboola | Keitaro       │
└─────────────────────┘  └─────────────────────────┘
           │                        │
┌──────────▼──────────┐  ┌──────────▼──────────────┐
│    PostgreSQL        │  │        Redis             │
│  (persistent store) │  │  (job queue + cache)     │
└─────────────────────┘  └─────────────────────────┘
```

## Layer Responsibilities

### UI Layer (`src/app/`)
- Next.js App Router with route groups
- Server Components for data fetching (no client waterfalls)
- Client Components only where interactivity is required
- Route group `(dashboard)` provides shared sidebar layout

### API Layer (`src/app/api/`)
- Thin REST handlers for external consumers (healthcheck, webhooks)
- Server Actions for form mutations (Phase 2)
- No business logic — delegates to `src/lib/`

### Business Logic (`src/lib/`)
- Framework-agnostic TypeScript modules
- Prisma client singleton (`lib/prisma.ts`)
- Redis client singleton (`lib/redis.ts`)
- Utility functions (`lib/utils.ts`)
- Future: `lib/pnl.ts`, `lib/analytics.ts`, etc.

### Integrations (`src/integrations/`)
- One directory per external system
- Each integration is a self-contained class with a factory function
- Zero UI imports — pure data layer
- Current: `taboola/`, `keitaro/`
- Future: `facebook/`, `google/`, `tiktok/`

### Jobs (`src/jobs/`)
- BullMQ queue definitions and worker logic
- Workers run as a separate process (not inside Next.js server)
- Job types are fully typed via discriminated unions
- Retry / backoff configured at queue level

## Data Flow: Sync Cycle

```
Cron trigger (BullMQ scheduler)
    → Enqueue SyncJob (e.g., taboola:publishers)
        → Worker picks up job
            → Call Taboola API via TaboolaClient
                → Upsert data into PostgreSQL
                    → Enqueue AggregateJob (pnl:aggregate)
                        → Recompute P&L snapshots
                            → UI reads fresh data
```

## Key Architectural Decisions

### Why Next.js 14 App Router?
Server Components allow data fetching at the component level without API round trips. This keeps the UI snappy and the code co-located. Server Actions will replace traditional REST endpoints for mutations in Phase 2.

### Why BullMQ + Redis?
External API syncs are slow, rate-limited, and can fail. Running them in background queues with automatic retry keeps the UI responsive. Redis also enables caching hot data (e.g., last-synced stats).

### Why Prisma?
Type-safe ORM with excellent migration tooling. The schema is the single source of truth for the data model. Prisma's introspection also makes it easy to onboard new team members.

### Why Isolated Integrations?
Each traffic source has a different API, auth model, and data shape. Keeping them in isolated modules means:
- Adding a new source (e.g., Facebook) doesn't touch existing code
- Connectors can be tested independently
- API credential rotation is contained

### Multi-Source Readiness
The `AdAccount.platform` field and integration directory structure are designed for N traffic sources from day 1. The job queue uses discriminated union types that can be extended per-source without breaking existing jobs.

## Folder Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Route group with sidebar layout
│   │   ├── layout.tsx      # Dashboard shell (sidebar + main)
│   │   ├── page.tsx        # / — Dashboard
│   │   ├── campaigns/
│   │   ├── publishers/
│   │   ├── expenses/
│   │   ├── agencies/
│   │   ├── ad-accounts/
│   │   └── settings/
│   ├── api/
│   │   └── health/         # GET /api/health
│   ├── layout.tsx          # Root HTML layout
│   └── globals.css         # Tailwind + CSS variables
│
├── components/
│   ├── layout/             # App shell components
│   │   └── sidebar.tsx
│   ├── shared/             # Reusable across pages
│   │   └── page-header.tsx
│   └── ui/                 # shadcn/ui component copies
│
├── lib/                    # Framework-agnostic utilities
│   ├── prisma.ts
│   ├── redis.ts
│   └── utils.ts
│
├── integrations/           # External API connectors
│   ├── taboola/
│   └── keitaro/
│
└── jobs/                   # BullMQ queues + workers
    └── index.ts
```

## Environment Configuration

All secrets are environment variables. See `.env.example` for the full list.

- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `TABOOLA_*` — Taboola OAuth2 credentials
- `KEITARO_*` — Keitaro API key and URL

## Deployment

Local dev: `docker-compose up` starts PostgreSQL + Redis.
Production: Docker image via multi-stage `Dockerfile`. Runs as `standalone` Next.js output.
