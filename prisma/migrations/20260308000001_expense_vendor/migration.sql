-- AlterTable: add optional vendor column to expenses (idempotent)
DO $$ BEGIN
  ALTER TABLE "expenses" ADD COLUMN "vendor" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
