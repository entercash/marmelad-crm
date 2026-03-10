-- Add spentUsd column to store spend converted to USD at that day's FX rate
ALTER TABLE "taboola_csv_rows" ADD COLUMN IF NOT EXISTS "spentUsd" DECIMAL(12, 2) NOT NULL DEFAULT 0;
