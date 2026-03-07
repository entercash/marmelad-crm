# Deployment Guide

How to run Marmelad CRM locally and in a Docker Compose production environment.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  Docker Compose (or bare Linux server)                   │
│                                                          │
│   ┌─────────────────┐    ┌──────────────────────────┐   │
│   │  marmelad-app   │    │  marmelad-worker         │   │
│   │  Next.js 14     │    │  BullMQ sync worker      │   │
│   │  port 3000      │    │  (no HTTP port)          │   │
│   └────────┬────────┘    └──────────┬───────────────┘   │
│            │                        │                    │
│            └──────────┬─────────────┘                    │
│                       │                                  │
│   ┌───────────────────▼──────────────────────────────┐   │
│   │  marmelad-redis          marmelad-postgres        │   │
│   │  Redis 7-alpine          PostgreSQL 16-alpine     │   │
│   │  port 6379 (internal)    port 5432 (internal)    │   │
│   └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

- **app** — Next.js standalone server. Handles all HTTP requests and enqueues BullMQ jobs.
- **worker** — Standalone BullMQ worker process. Pulls jobs from Redis and runs sync services.
- **postgres** — Primary data store (all normalized CRM data, sync logs, raw batches).
- **redis** — Job queue broker (BullMQ) and optional cache.

The `app` and `worker` containers share the same `.env` file and database. They communicate only through Redis queues — there is no direct inter-process HTTP.

---

## Local Development (app on host, infra in Docker)

This is the recommended flow for development: run Postgres and Redis in Docker, run the Next.js app and worker directly on your machine for fast iteration.

### Prerequisites

- Node.js ≥ 20
- Docker + Docker Compose
- `npm` (v9+)

### First-time setup

```bash
# 1. Clone and install dependencies
git clone <repo>
cd marmelad-crm
npm install            # also generates package-lock.json if missing

# 2. Copy environment template and fill in values
cp .env.example .env
# Edit .env — keep localhost URLs for DATABASE_URL and REDIS_URL (local dev mode)

# 3. Start Postgres + Redis (background)
docker compose up -d postgres redis

# 4. Apply database migrations (creates all tables)
npm run db:migrate:prod   # prisma migrate deploy — applies pending migrations

# 5. Seed reference data (TrafficSources, ExpenseCategories)
#    Only needed once — idempotent but no need to repeat on each restart
npm run db:seed

# 6. Start the Next.js dev server
npm run dev
```

App is available at: http://localhost:3000

### Running the worker (separate terminal)

```bash
npm run worker:dev     # tsx watch — restarts on file changes
```

Or in production mode locally:
```bash
npm run worker
```

---

## Docker Compose Deployment (Linux server)

This is the production-like deployment: all four services run in containers.

### Prerequisites on the server

- Docker Engine ≥ 24
- Docker Compose plugin v2 (`docker compose`, not `docker-compose`)
- Git

### First-time deployment

```bash
# 1. Pull the code
git clone <repo>
cd marmelad-crm

# 2. Create the .env file for Docker
cp .env.example .env
```

Edit `.env` — **critical**: use Docker service names, not localhost:

```env
# DATABASE_URL must use the postgres service name, not localhost
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/marmelad_crm?schema=public"

# REDIS_URL must use the redis service name, not localhost
REDIS_URL="redis://redis:6379"

# Fill in Taboola and Keitaro credentials
TABOOLA_CLIENT_ID=...
TABOOLA_CLIENT_SECRET=...
TABOOLA_ACCOUNT_ID=...
KEITARO_API_URL=https://track.yourdomain.com
KEITARO_API_KEY=...
```

```bash
# 3. Build and start all services
docker compose up -d --build

# 4. Apply database migrations
#    prisma migrate deploy applies all pending migrations in order.
#    It is safe to run on every deployment — it is a no-op if already up-to-date.
docker compose exec app npx prisma migrate deploy

# 5. Seed reference data
#    Only needed once. The seed is idempotent but there is no reason to re-run
#    it on every deployment — it does not create new data on subsequent runs.
docker compose exec app npm run db:seed
```

App is available at: http://<server-ip>:3000

### Subsequent deployments

```bash
git pull
docker compose up -d --build

# Always run migrate deploy after pulling — it is a no-op if no new migrations.
docker compose exec app npx prisma migrate deploy
```

### Checking service health

```bash
docker compose ps              # all services and health status
docker compose logs app        # Next.js server logs
docker compose logs worker     # BullMQ worker logs
docker compose logs postgres   # Postgres logs
docker compose logs redis      # Redis logs

# Follow logs in real time
docker compose logs -f worker
```

---

## Environment Variables Reference

All variables are read from `.env` by the `app` and `worker` containers (via `env_file: .env` in docker-compose.yml).

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string. Use `@postgres:5432` in Docker, `@localhost:5432` on host. |
| `REDIS_URL` | ✅ | — | Redis URL. Use `redis://redis:6379` in Docker, `redis://localhost:6379` on host. |
| `TABOOLA_CLIENT_ID` | Phase 2 | — | Taboola OAuth2 client ID (from Backstage API Connect settings) |
| `TABOOLA_CLIENT_SECRET` | Phase 2 | — | Taboola OAuth2 client secret |
| `TABOOLA_ACCOUNT_ID` | Phase 2 | — | Taboola numeric account ID (visible in Backstage URL) |
| `KEITARO_API_URL` | Phase 2 | — | Base URL of your self-hosted Keitaro instance (no trailing slash) |
| `KEITARO_API_KEY` | Phase 2 | — | Keitaro API key with "Reports" read access |
| `WORKER_CONCURRENCY` | optional | `2` | Max simultaneous BullMQ jobs per worker process |
| `WORKER_STALLED_INTERVAL` | optional | `30000` | Stalled job check interval in ms |
| `NODE_ENV` | optional | `development` | Set to `production` in Docker (handled automatically by Dockerfiles) |
| `NEXT_PUBLIC_APP_URL` | optional | `http://localhost:3000` | Public URL of the app (used for absolute links) |

---

## Database Migrations

Migrations are managed by Prisma Migrate. The initial migration (`20260307000000_init`) is committed at `prisma/migrations/` and covers the full v1 schema (all 19 tables, 8 enums, all indexes).

| Command | When to use |
|---------|-------------|
| `npm run db:migrate:prod` | **All environments** — applies all pending migrations in order. Safe to run on every deployment (no-op if up to date). Equivalent to `npx prisma migrate deploy`. |
| `npm run db:migrate` | **Local dev only** — creates a new migration file from schema changes and applies it. Never run in production. |
| `npm run db:push` | **Local dev only** — pushes schema without creating a migration file. Use only for rapid prototyping. ⚠️ Do not use in production or on any database that uses `migrate deploy`. |
| `npm run db:seed` | One-time — seeds TrafficSources and ExpenseCategories. Safe to re-run (idempotent upserts), but not needed after the first run. |

### Baselining an existing database (already created with `db push`)

The production database was initially set up with `prisma db push` before migrations existed. To register the current migration as already applied **without re-running the SQL** (which would fail because the tables already exist):

```bash
# On the server, inside the running app container:
docker compose exec app npx prisma migrate resolve --applied "20260307000000_init"

# Verify — should show the migration as "applied":
docker compose exec app npx prisma migrate status
```

After baselining, all future migrations will use `prisma migrate deploy` normally.

### Adding a new migration (future schema changes)

```bash
# 1. Edit prisma/schema.prisma
# 2. Generate and apply the migration locally
npm run db:migrate          # prisma migrate dev --name <description>
# 3. Commit the new migration file
git add prisma/migrations/
git commit -m "feat(db): add <description>"
# 4. Deploy
docker compose exec app npx prisma migrate deploy
```

**Rule:** `prisma migrate deploy` runs on every deployment. It is always safe — if there are no new migrations it is a no-op.

---

## Common Failures and Fixes

The following issues were encountered during the first Linux deployment and have been resolved in the current codebase.

### 1. `next.config.ts` causes build failure on Linux

**Symptom:** `next build` fails with "Invalid next.config.ts" or silently uses wrong config.

**Root cause:** Next.js 14 does not support TypeScript config files. Only `.js` and `.mjs` are supported. The `.ts` extension was added in Next.js 15.

**Fix:** Renamed `next.config.ts` → `next.config.mjs`. The file uses ES module `export default` syntax, which is required for `.mjs`.

---

### 2. `npm ci` fails — package-lock.json missing

**Symptom:** `npm ci` in Docker fails with "npm ci can only install packages when your package.json and package-lock.json are in sync".

**Root cause:** `package-lock.json` was not committed to the repository. `npm ci` strictly requires it.

**Fix:** Always run `npm install` locally and commit `package-lock.json`. It is NOT in `.gitignore`. Never delete it from the repo.

**Prevention:** If you see this error, run `npm install` locally, commit the lockfile, and rebuild.

---

### 3. Docker COPY fails — `/app/public` not found in builder stage

**Symptom:** `docker build` fails with "COPY failed: file not found in build context or excluded by .dockerignore: stat app/public: file does not exist".

**Root cause:** The `public/` directory did not exist in the repository. The `COPY --from=builder /app/public ./public` instruction fails when the source path doesn't exist.

**Fix:**
- Added `public/.gitkeep` to create the directory in the repository.
- Added `RUN mkdir -p /app/public` in the builder stage of the Dockerfile as a safety net.

---

### 4. BullMQ + ioredis TypeScript type mismatch causes build failure

**Symptom:** `npm run build` fails with TypeScript errors like "Argument of type 'Redis' is not assignable to parameter of type 'ConnectionOptions'".

**Root cause:** BullMQ's `Queue` and `Worker` constructors expect a `ConnectionOptions` object (plain host/port/password options), not a live `ioredis` `Redis` instance. Passing the shared ioredis singleton directly causes a type mismatch.

**Fix:** Created `src/lib/bullmq-connection.ts` which parses `REDIS_URL` into a `ConnectionOptions` object. `queues.ts` and `worker.ts` now call `getBullMQConnection()` instead of importing the ioredis singleton.

BullMQ creates and manages its own Redis connections internally using these options. The shared ioredis singleton (`lib/redis.ts`) is kept separate for any direct Redis operations outside of BullMQ.

---

### 5. PostgreSQL healthcheck fails

**Symptom:** The `postgres` container never becomes healthy; `app` and `worker` containers don't start (they depend on `service_healthy`).

**Root cause:** The original healthcheck was `pg_isready -U postgres` without specifying the database. In some Postgres images the command exits non-zero if the database isn't ready even when the server is running.

**Fix:** Changed to `pg_isready -U postgres -d marmelad_crm` — explicitly checks both the user and the target database. Also added `start_period: 10s` to give Postgres time to initialize before the first health check.

---

### 6. Docker build context too large (slow builds, accidental secret inclusion)

**Symptom:** `docker build` sends hundreds of MB to the daemon because `node_modules` and `.next` are included in the build context.

**Root cause:** No `.dockerignore` file existed.

**Fix:** Created `.dockerignore` excluding: `node_modules`, `.next`, `.git`, `*.log`, `logs/`, all `.env.*` files (except `.env.example`), OS junk (`.DS_Store`, `Thumbs.db`), editor files (`.vscode`, `.idea`), TypeScript incremental cache, and test coverage files.

---

### 7. App container cannot reach Postgres/Redis (connection refused)

**Symptom:** App starts but crashes with "Connection refused to localhost:5432" or "redis connect ECONNREFUSED".

**Root cause:** `.env` file has `@localhost` in `DATABASE_URL` and `REDIS_URL`. Inside Docker, `localhost` refers to the container itself, not the host. Postgres and Redis run in separate containers named `postgres` and `redis`.

**Fix:** In the `.env` file used for Docker, use service names as hostnames:
```env
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/marmelad_crm?schema=public"
REDIS_URL="redis://redis:6379"
```

---

## Prisma Studio (database browser)

For local inspection of the database:

```bash
npm run db:studio
# Opens at http://localhost:5555
```

From inside Docker:
```bash
docker compose exec app npx prisma studio
# Note: port forwarding may be needed — easier to run studio on the host against @localhost
```

---

## Useful One-Liners

```bash
# Restart a single service without rebuilding
docker compose restart worker

# Rebuild and restart only the worker (faster than full rebuild)
docker compose up -d --build worker

# Check worker is processing jobs
docker compose logs -f worker --tail=50

# Connect to Postgres directly
docker compose exec postgres psql -U postgres -d marmelad_crm

# Connect to Redis
docker compose exec redis redis-cli

# View BullMQ queue stats (requires redis-cli)
docker compose exec redis redis-cli info keyspace

# Hard reset (⚠️ destroys all data)
docker compose down -v
docker compose up -d --build
```
