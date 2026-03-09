-- Migration: 20260308000000_white_pages
-- Adds the WhitePageStatus enum and white_pages table.

-- ── Enum (idempotent) ───────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "WhitePageStatus" AS ENUM (
    'PREMODERATION',
    'ACCOUNT_ISSUED',
    'WARMUP_STARTED',
    'IN_PROGRESS',
    'PREMODERATION_FAILED',
    'ACCOUNT_BANNED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Table (idempotent) ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "white_pages" (
  "id"              TEXT              NOT NULL,
  "transferDate"    DATE              NOT NULL,
  "geo"             TEXT              NOT NULL,
  "url"             TEXT              NOT NULL,
  "topic"           TEXT,
  "zohoEmail"       TEXT,
  "password"        TEXT,
  "legalEntityData" TEXT,
  "taxNumber"       TEXT,
  "status"          "WhitePageStatus" NOT NULL,
  "createdAt"       TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)      NOT NULL,

  CONSTRAINT "white_pages_pkey" PRIMARY KEY ("id")
);

-- ── Indexes (idempotent) ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "white_pages_status_idx" ON "white_pages"("status");
CREATE INDEX IF NOT EXISTS "white_pages_transferDate_idx" ON "white_pages"("transferDate");
