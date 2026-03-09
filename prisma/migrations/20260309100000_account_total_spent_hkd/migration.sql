-- Add totalSpentUsd column to accounts (denormalized spend total, populated by sync jobs)
DO $$ BEGIN
  ALTER TABLE "accounts" ADD COLUMN "totalSpentUsd" DECIMAL(14,2) NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
