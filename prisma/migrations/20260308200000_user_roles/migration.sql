-- Rename USER → BUYER and add ANALYST to UserRole enum.
-- Step 1: Add the new enum values.
-- NOTE: ADD VALUE cannot run inside a transaction in PostgreSQL.
-- Prisma will run this file without a transaction wrapper.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BUYER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ANALYST';
