-- AlterTable
ALTER TABLE "ad_accounts" ADD COLUMN "accountId" TEXT;

-- CreateIndex
CREATE INDEX "ad_accounts_accountId_idx" ON "ad_accounts"("accountId");

-- AddForeignKey
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: populate accountId from integration_settings bridge
UPDATE "ad_accounts" aa
SET "accountId" = sub."accountId"
FROM (
  SELECT iset."value" AS "externalId",
         SUBSTRING(iset."key" FROM 'taboola\.(.+)\.taboolaAccountId') AS "accountId"
  FROM "integration_settings" iset
  WHERE iset."key" LIKE 'taboola.%.taboolaAccountId'
) sub
WHERE aa."externalId" = sub."externalId"
  AND aa."accountId" IS NULL;
