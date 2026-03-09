-- Deprecate email and password (make nullable for backward compat)
DO $$ BEGIN
  ALTER TABLE "accounts" ALTER COLUMN "email" DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "accounts" ALTER COLUMN "password" DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Add currency column with default USD (idempotent)
DO $$ BEGIN
  ALTER TABLE "accounts" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
