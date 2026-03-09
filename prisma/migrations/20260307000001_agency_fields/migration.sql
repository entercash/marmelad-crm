-- Migration: 20260307000001_agency_fields
-- Adds contact, financial-terms, and website fields to the agencies table.
-- All columns are nullable — no DEFAULT value required.

DO $$ BEGIN
  ALTER TABLE "agencies" ADD COLUMN "website" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "agencies" ADD COLUMN "contact" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "agencies" ADD COLUMN "accountCostUsd" DECIMAL(12,2);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "agencies" ADD COLUMN "commissionPercent" DECIMAL(8,4);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "agencies" ADD COLUMN "cryptoPaymentPercent" DECIMAL(8,4);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
