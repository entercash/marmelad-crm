-- Rename `date` → `spendDate` (idempotent: only runs if old column exists)
DO $$ BEGIN
  ALTER TABLE "expenses" RENAME COLUMN "date" TO "spendDate";
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- Rename the existing index on the renamed column (idempotent)
DO $$ BEGIN
  ALTER INDEX "expenses_date_idx" RENAME TO "expenses_spendDate_idx";
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Add new optional fields (idempotent)
DO $$ BEGIN
  ALTER TABLE "expenses" ADD COLUMN "source" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "expenses" ADD COLUMN "campaign" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "expenses" ADD COLUMN "comment" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "expenses" ADD COLUMN "createdBy" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
