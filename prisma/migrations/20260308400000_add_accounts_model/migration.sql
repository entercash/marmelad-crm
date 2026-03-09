-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "AccountStatus" AS ENUM ('EMPTY', 'UNDER_MODERATION', 'ACTIVE', 'BANNED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "agencyId" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'EMPTY',
    "accountCountry" TEXT,
    "trafficCountry" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "accounts_agencyId_idx" ON "accounts"("agencyId");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "accounts" ADD CONSTRAINT "accounts_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "agencies"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
