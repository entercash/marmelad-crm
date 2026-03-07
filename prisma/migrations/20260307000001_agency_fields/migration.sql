-- Migration: 20260307000001_agency_fields
-- Adds contact, financial-terms, and website fields to the agencies table.
-- All columns are nullable — no DEFAULT value required.

ALTER TABLE "agencies"
  ADD COLUMN "website"              TEXT,
  ADD COLUMN "contact"              TEXT,
  ADD COLUMN "accountCostUsd"       DECIMAL(12,2),
  ADD COLUMN "commissionPercent"    DECIMAL(8,4),
  ADD COLUMN "cryptoPaymentPercent" DECIMAL(8,4);
