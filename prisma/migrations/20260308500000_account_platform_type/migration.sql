-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "AccountPlatform" AS ENUM ('TABOOLA', 'FACEBOOK', 'GOOGLE', 'TIKTOK', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "AccountType" AS ENUM ('AGENCY', 'AGENCY_FARM', 'FARM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: add new columns with safe defaults for existing rows (idempotent)
DO $$ BEGIN
  ALTER TABLE "accounts" ADD COLUMN "platform" "AccountPlatform" NOT NULL DEFAULT 'OTHER';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "accounts" ADD COLUMN "accountType" "AccountType" NOT NULL DEFAULT 'FARM';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
