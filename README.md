# Marmelad CRM

Internal CRM for media buying / performance marketing operations.

**Stack:** Next.js 14 · TypeScript · PostgreSQL · Prisma · Tailwind CSS · shadcn/ui · Redis · BullMQ · Docker

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your values (database URL, Redis URL, etc.).

### 3. Start infrastructure (PostgreSQL + Redis)

```bash
docker-compose up -d
```

### 4. Set up the database

```bash
npm run db:generate   # generate Prisma client
npm run db:migrate    # run migrations (creates tables)
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run pending migrations |
| `npm run db:migrate:prod` | Apply migrations in production |
| `npm run db:studio` | Open Prisma Studio (DB GUI) |
| `npm run db:push` | Push schema without migration file |

---

## Project Structure

```
marmelad-crm/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (dashboard)/        # Sidebar layout + all pages
│   │   │   ├── layout.tsx      # Dashboard shell
│   │   │   ├── page.tsx        # / Dashboard
│   │   │   ├── campaigns/
│   │   │   ├── publishers/
│   │   │   ├── expenses/
│   │   │   ├── agencies/
│   │   │   ├── ad-accounts/
│   │   │   └── settings/
│   │   ├── api/health/         # GET /api/health
│   │   ├── layout.tsx          # Root HTML layout
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── layout/             # Sidebar
│   │   ├── shared/             # PageHeader
│   │   └── ui/                 # shadcn/ui components
│   │
│   ├── lib/                    # Prisma, Redis, utils
│   ├── integrations/           # Taboola, Keitaro (Phase 2)
│   └── jobs/                   # BullMQ queues + workers
│
├── prisma/
│   └── schema.prisma           # Database schema
│
├── docs/
│   ├── product.md              # Product requirements
│   ├── architecture.md         # Technical architecture
│   ├── entities.md             # Data model reference
│   └── roadmap.md              # Development phases
│
├── docker-compose.yml          # PostgreSQL + Redis for local dev
├── Dockerfile                  # Production Docker image
├── .env.example                # Environment variable template
└── components.json             # shadcn/ui config
```

---

## API

| Route | Method | Description |
|-------|--------|-------------|
| `/api/health` | GET | Service healthcheck |

---

## Documentation

- [Product Overview](docs/product.md)
- [Architecture](docs/architecture.md)
- [Data Entities](docs/entities.md)
- [Roadmap](docs/roadmap.md)

---

## Docker (Production)

```bash
# Build image
docker build -t marmelad-crm .

# Run
docker run -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e REDIS_URL="..." \
  marmelad-crm
```

---

## Environment Variables

See [`.env.example`](.env.example) for the full list with descriptions.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `TABOOLA_CLIENT_ID` | Phase 2 | Taboola OAuth2 client ID |
| `TABOOLA_CLIENT_SECRET` | Phase 2 | Taboola OAuth2 client secret |
| `TABOOLA_ACCOUNT_ID` | Phase 2 | Taboola advertiser account ID |
| `KEITARO_API_URL` | Phase 2 | Keitaro instance URL |
| `KEITARO_API_KEY` | Phase 2 | Keitaro API key |
