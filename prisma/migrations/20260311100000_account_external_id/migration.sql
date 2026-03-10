-- AlterTable: add externalId to accounts
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
