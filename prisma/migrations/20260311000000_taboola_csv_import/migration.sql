-- CreateTable: taboola_csv_rows
-- Stores raw Taboola performance data from Dartmatics CSV exports.
-- Granularity: one row per Ad × Site × Day × Country.

CREATE TABLE IF NOT EXISTS "taboola_csv_rows" (
    "id"                  TEXT NOT NULL,
    "day"                 DATE NOT NULL,
    "campaignExternalId"  TEXT NOT NULL,
    "adExternalId"        TEXT NOT NULL,
    "siteExternalId"      TEXT NOT NULL,
    "countryCode"         TEXT NOT NULL,
    "accountName"         TEXT NOT NULL,
    "accountExternalId"   TEXT NOT NULL,
    "campaignName"        TEXT NOT NULL,
    "campaignStatus"      TEXT NOT NULL,
    "campaignBid"         DECIMAL(10,4),
    "campaignBidStrategy" TEXT,
    "campaignStartDate"   TEXT,
    "conversionGoal"      TEXT,
    "campaignBudgetType"  TEXT,
    "campaignBudget"      DECIMAL(12,2),
    "spendingLimit"       DECIMAL(12,2),
    "spendingLimitType"   TEXT,
    "adTitle"             TEXT NOT NULL,
    "adDescription"       TEXT,
    "adStatus"            TEXT NOT NULL,
    "siteName"            TEXT NOT NULL,
    "siteUrl"             TEXT,
    "country"             TEXT NOT NULL,
    "currency"            TEXT NOT NULL DEFAULT 'USD',
    "inventoryType"       TEXT,
    "spent"               DECIMAL(12,2) NOT NULL DEFAULT 0,
    "clicks"              INTEGER NOT NULL DEFAULT 0,
    "impressions"         INTEGER NOT NULL DEFAULT 0,
    "conversions"         DECIMAL(10,2) NOT NULL DEFAULT 0,
    "conversionsValue"    DECIMAL(12,2) NOT NULL DEFAULT 0,
    "servedAds"           INTEGER NOT NULL DEFAULT 0,
    "actualCpc"           DECIMAL(10,6),
    "actualCpa"           DECIMAL(10,6),
    "cpm"                 DECIMAL(10,6),
    "ctr"                 DECIMAL(10,6),
    "conversionRate"      DECIMAL(10,6),
    "roas"                DECIMAL(10,6),
    "syncLogId"           TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taboola_csv_rows_pkey" PRIMARY KEY ("id")
);

-- Unique constraint for upsert dedup
DO $$ BEGIN
  ALTER TABLE "taboola_csv_rows"
    ADD CONSTRAINT "taboola_csv_rows_day_campaignExternalId_adExternalId_siteEx_key"
    UNIQUE ("day", "campaignExternalId", "adExternalId", "siteExternalId", "countryCode");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "taboola_csv_rows_day_idx"
  ON "taboola_csv_rows"("day");

CREATE INDEX IF NOT EXISTS "taboola_csv_rows_campaignExternalId_day_idx"
  ON "taboola_csv_rows"("campaignExternalId", "day");

CREATE INDEX IF NOT EXISTS "taboola_csv_rows_syncLogId_idx"
  ON "taboola_csv_rows"("syncLogId");
