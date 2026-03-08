-- CreateEnum
CREATE TYPE "AccountPlatform" AS ENUM ('TABOOLA', 'FACEBOOK', 'GOOGLE', 'TIKTOK', 'OTHER');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('AGENCY', 'AGENCY_FARM', 'FARM');

-- AlterTable: add new columns with safe defaults for existing rows
ALTER TABLE "accounts"
  ADD COLUMN "platform"    "AccountPlatform" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "accountType" "AccountType"     NOT NULL DEFAULT 'FARM';
