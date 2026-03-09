-- Step 2: Migrate existing USER rows to BUYER (safe to re-run)
UPDATE "users" SET "role" = 'BUYER' WHERE "role" = 'USER';

-- Step 3: Change default from USER to BUYER (idempotent)
DO $$ BEGIN
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'BUYER'::"UserRole";
EXCEPTION WHEN others THEN NULL;
END $$;

-- Note: PostgreSQL does not support removing enum values.
-- 'USER' will remain in the enum type but is no longer used.
