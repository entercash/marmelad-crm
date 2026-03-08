-- Rename `date` → `spendDate` (preserves all existing data)
ALTER TABLE "expenses" RENAME COLUMN "date" TO "spendDate";

-- Rename the existing index on the renamed column
ALTER INDEX "expenses_date_idx" RENAME TO "expenses_spendDate_idx";

-- Add new optional fields
ALTER TABLE "expenses" ADD COLUMN "source"    TEXT;
ALTER TABLE "expenses" ADD COLUMN "campaign"  TEXT;
ALTER TABLE "expenses" ADD COLUMN "comment"   TEXT;
ALTER TABLE "expenses" ADD COLUMN "createdBy" TEXT;
