-- Rename USER → BUYER and add ANALYST to UserRole enum.
-- Existing users with role 'USER' will become 'BUYER'.

-- Step 1: Add the new values (IF NOT EXISTS is built-in)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BUYER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ANALYST';

-- Step 2: Migrate existing USER rows to BUYER (safe to re-run)
UPDATE "users" SET "role" = 'BUYER' WHERE "role" = 'USER';

-- Step 3: Change default from USER to BUYER (idempotent)
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'BUYER'::"UserRole";

-- Note: PostgreSQL does not support removing enum values.
-- 'USER' will remain in the enum type but is no longer used.
-- The Prisma schema no longer references it.
