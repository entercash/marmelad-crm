-- Marmelad CRM — Initial Migration
-- Generated from prisma/schema.prisma using:
--   prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
--
-- BASELINING NOTE:
-- The production database was initially created with `prisma db push`.
-- Run the following on any database that already has this schema:
--   npx prisma migrate resolve --applied "20260307000000_init"
-- Run this migration normally on fresh databases:
--   npx prisma migrate deploy

-- CreateEnum
CREATE TYPE "TrafficSourceType" AS ENUM ('SPEND_SOURCE', 'CONVERSION_SOURCE', 'BOTH');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'STOPPED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CampaignItemStatus" AS ENUM ('ACTIVE', 'PAUSED', 'STOPPED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PublisherListType" AS ENUM ('BLACKLIST', 'WHITELIST');

-- CreateEnum
CREATE TYPE "ListEntryStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "MappingType" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "ExpenseRecurrence" AS ENUM ('ONE_TIME', 'WEEKLY', 'MONTHLY', 'ANNUAL');

-- CreateTable
CREATE TABLE "traffic_sources" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TrafficSourceType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traffic_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agencies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "trafficSourceId" TEXT NOT NULL,
    "agencyId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "trafficSourceId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dailyBudget" DECIMAL(12,2),
    "cpcBid" DECIMAL(10,6),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_items" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT,
    "thumbnailUrl" TEXT,
    "status" "CampaignItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishers" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "trafficSourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publishers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_mappings" (
    "id" TEXT NOT NULL,
    "spendCampaignId" TEXT NOT NULL,
    "conversionExternalId" TEXT NOT NULL,
    "conversionSource" TEXT NOT NULL,
    "mappingType" "MappingType" NOT NULL DEFAULT 'MANUAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_stats_daily" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "spend" DECIMAL(12,2) NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "cpc" DECIMAL(10,6),
    "cpm" DECIMAL(10,6),
    "ctr" DECIMAL(10,6),
    "currency" TEXT NOT NULL DEFAULT 'USD',

    CONSTRAINT "campaign_stats_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_item_stats_daily" (
    "id" TEXT NOT NULL,
    "campaignItemId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "spend" DECIMAL(12,2) NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "cpc" DECIMAL(10,6),
    "ctr" DECIMAL(10,6),
    "currency" TEXT NOT NULL DEFAULT 'USD',

    CONSTRAINT "campaign_item_stats_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publisher_stats_daily" (
    "id" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "geo" CHAR(2) NOT NULL DEFAULT 'XX',
    "spend" DECIMAL(12,2) NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "cpc" DECIMAL(10,6),
    "ctr" DECIMAL(10,6),
    "currency" TEXT NOT NULL DEFAULT 'USD',

    CONSTRAINT "publisher_stats_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversion_stats_daily" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalCampaignId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "geo" CHAR(2) NOT NULL DEFAULT 'XX',
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "approvedConversions" INTEGER NOT NULL DEFAULT 0,
    "pendingConversions" INTEGER NOT NULL DEFAULT 0,
    "rejectedConversions" INTEGER NOT NULL DEFAULT 0,
    "grossRevenue" DECIMAL(12,2) NOT NULL,
    "netRevenue" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',

    CONSTRAINT "conversion_stats_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publisher_lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PublisherListType" NOT NULL,
    "trafficSourceId" TEXT NOT NULL,
    "adAccountId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publisher_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publisher_list_entries" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "status" "ListEntryStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,
    "removedAt" TIMESTAMP(3),
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publisher_list_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publisher_quality_scores" (
    "id" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "scoreDate" DATE NOT NULL,
    "windowDays" INTEGER NOT NULL DEFAULT 14,
    "totalSpend" DECIMAL(12,2) NOT NULL,
    "totalClicks" INTEGER NOT NULL,
    "totalConversions" INTEGER NOT NULL,
    "netRevenue" DECIMAL(12,2) NOT NULL,
    "roi" DECIMAL(10,4),
    "ctr" DECIMAL(10,6),
    "cvr" DECIMAL(10,6),
    "qualityLabel" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publisher_quality_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "categoryId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "recurrence" "ExpenseRecurrence" NOT NULL DEFAULT 'ONE_TIME',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pnl_daily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "campaignMappingId" TEXT NOT NULL,
    "spend" DECIMAL(12,2) NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "grossRevenue" DECIMAL(12,2) NOT NULL,
    "netRevenue" DECIMAL(12,2) NOT NULL,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "grossProfit" DECIMAL(12,2) NOT NULL,
    "roi" DECIMAL(10,4),
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pnl_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "recordsFetched" INTEGER,
    "recordsInserted" INTEGER,
    "recordsUpdated" INTEGER,
    "recordsSkipped" INTEGER,
    "recordsFailed" INTEGER,
    "errorMessage" TEXT,
    "meta" JSONB,
    "trafficSourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_import_batches" (
    "id" TEXT NOT NULL,
    "syncLogId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "traffic_sources_slug_key" ON "traffic_sources"("slug");

-- CreateIndex
CREATE INDEX "ad_accounts_agencyId_idx" ON "ad_accounts"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "ad_accounts_trafficSourceId_externalId_key" ON "ad_accounts"("trafficSourceId", "externalId");

-- CreateIndex
CREATE INDEX "campaigns_adAccountId_idx" ON "campaigns"("adAccountId");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_trafficSourceId_externalId_key" ON "campaigns"("trafficSourceId", "externalId");

-- CreateIndex
CREATE INDEX "campaign_items_campaignId_idx" ON "campaign_items"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_items_campaignId_externalId_key" ON "campaign_items"("campaignId", "externalId");

-- CreateIndex
CREATE INDEX "publishers_trafficSourceId_idx" ON "publishers"("trafficSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "publishers_trafficSourceId_externalId_key" ON "publishers"("trafficSourceId", "externalId");

-- CreateIndex
CREATE INDEX "campaign_mappings_conversionExternalId_conversionSource_idx" ON "campaign_mappings"("conversionExternalId", "conversionSource");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_mappings_spendCampaignId_conversionExternalId_conv_key" ON "campaign_mappings"("spendCampaignId", "conversionExternalId", "conversionSource");

-- CreateIndex
CREATE INDEX "campaign_stats_daily_date_idx" ON "campaign_stats_daily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_stats_daily_campaignId_date_key" ON "campaign_stats_daily"("campaignId", "date");

-- CreateIndex
CREATE INDEX "campaign_item_stats_daily_date_idx" ON "campaign_item_stats_daily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_item_stats_daily_campaignItemId_date_key" ON "campaign_item_stats_daily"("campaignItemId", "date");

-- CreateIndex
CREATE INDEX "publisher_stats_daily_campaignId_date_idx" ON "publisher_stats_daily"("campaignId", "date");

-- CreateIndex
CREATE INDEX "publisher_stats_daily_date_geo_idx" ON "publisher_stats_daily"("date", "geo");

-- CreateIndex
CREATE UNIQUE INDEX "publisher_stats_daily_publisherId_campaignId_date_geo_key" ON "publisher_stats_daily"("publisherId", "campaignId", "date", "geo");

-- CreateIndex
CREATE INDEX "conversion_stats_daily_source_externalCampaignId_idx" ON "conversion_stats_daily"("source", "externalCampaignId");

-- CreateIndex
CREATE INDEX "conversion_stats_daily_date_idx" ON "conversion_stats_daily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "conversion_stats_daily_source_externalCampaignId_date_geo_key" ON "conversion_stats_daily"("source", "externalCampaignId", "date", "geo");

-- CreateIndex
CREATE INDEX "publisher_lists_trafficSourceId_idx" ON "publisher_lists"("trafficSourceId");

-- CreateIndex
CREATE INDEX "publisher_list_entries_publisherId_idx" ON "publisher_list_entries"("publisherId");

-- CreateIndex
CREATE UNIQUE INDEX "publisher_list_entries_listId_publisherId_key" ON "publisher_list_entries"("listId", "publisherId");

-- CreateIndex
CREATE INDEX "publisher_quality_scores_scoreDate_idx" ON "publisher_quality_scores"("scoreDate");

-- CreateIndex
CREATE UNIQUE INDEX "publisher_quality_scores_publisherId_scoreDate_windowDays_key" ON "publisher_quality_scores"("publisherId", "scoreDate", "windowDays");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_slug_key" ON "expense_categories"("slug");

-- CreateIndex
CREATE INDEX "expenses_categoryId_idx" ON "expenses"("categoryId");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "pnl_daily_campaignMappingId_idx" ON "pnl_daily"("campaignMappingId");

-- CreateIndex
CREATE UNIQUE INDEX "pnl_daily_date_campaignMappingId_key" ON "pnl_daily"("date", "campaignMappingId");

-- CreateIndex
CREATE INDEX "sync_logs_source_status_idx" ON "sync_logs"("source", "status");

-- CreateIndex
CREATE INDEX "sync_logs_startedAt_idx" ON "sync_logs"("startedAt");

-- CreateIndex
CREATE INDEX "raw_import_batches_syncLogId_idx" ON "raw_import_batches"("syncLogId");

-- CreateIndex
CREATE INDEX "raw_import_batches_source_entityType_createdAt_idx" ON "raw_import_batches"("source", "entityType", "createdAt");

-- AddForeignKey
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_trafficSourceId_fkey" FOREIGN KEY ("trafficSourceId") REFERENCES "traffic_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_trafficSourceId_fkey" FOREIGN KEY ("trafficSourceId") REFERENCES "traffic_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "ad_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_items" ADD CONSTRAINT "campaign_items_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishers" ADD CONSTRAINT "publishers_trafficSourceId_fkey" FOREIGN KEY ("trafficSourceId") REFERENCES "traffic_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_mappings" ADD CONSTRAINT "campaign_mappings_spendCampaignId_fkey" FOREIGN KEY ("spendCampaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_stats_daily" ADD CONSTRAINT "campaign_stats_daily_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_item_stats_daily" ADD CONSTRAINT "campaign_item_stats_daily_campaignItemId_fkey" FOREIGN KEY ("campaignItemId") REFERENCES "campaign_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publisher_stats_daily" ADD CONSTRAINT "publisher_stats_daily_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "publishers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publisher_stats_daily" ADD CONSTRAINT "publisher_stats_daily_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publisher_lists" ADD CONSTRAINT "publisher_lists_trafficSourceId_fkey" FOREIGN KEY ("trafficSourceId") REFERENCES "traffic_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publisher_list_entries" ADD CONSTRAINT "publisher_list_entries_listId_fkey" FOREIGN KEY ("listId") REFERENCES "publisher_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publisher_list_entries" ADD CONSTRAINT "publisher_list_entries_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "publishers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publisher_quality_scores" ADD CONSTRAINT "publisher_quality_scores_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "publishers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pnl_daily" ADD CONSTRAINT "pnl_daily_campaignMappingId_fkey" FOREIGN KEY ("campaignMappingId") REFERENCES "campaign_mappings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_trafficSourceId_fkey" FOREIGN KEY ("trafficSourceId") REFERENCES "traffic_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_import_batches" ADD CONSTRAINT "raw_import_batches_syncLogId_fkey" FOREIGN KEY ("syncLogId") REFERENCES "sync_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
