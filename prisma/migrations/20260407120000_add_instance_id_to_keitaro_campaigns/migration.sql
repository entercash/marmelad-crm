-- Add instanceId to support multiple Keitaro instances
ALTER TABLE "keitaro_campaigns" ADD COLUMN "instanceId" TEXT NOT NULL DEFAULT 'default';

-- Drop old single-column unique constraint
DROP INDEX IF EXISTS "keitaro_campaigns_externalId_key";

-- Create composite unique
CREATE UNIQUE INDEX "keitaro_campaigns_instanceId_externalId_key" ON "keitaro_campaigns"("instanceId", "externalId");

-- Index on instanceId for filtering
CREATE INDEX "keitaro_campaigns_instanceId_idx" ON "keitaro_campaigns"("instanceId");
