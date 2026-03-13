-- Add country (GEO) field to campaign_links for Keitaro leads matching
ALTER TABLE "campaign_links" ADD COLUMN "country" TEXT;
