-- Integration settings (key-value store for API credentials)
CREATE TABLE "integration_settings" (
    "id"        TEXT NOT NULL,
    "key"       TEXT NOT NULL,
    "value"     TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_settings_key_key" ON "integration_settings"("key");

-- Keitaro campaigns (synced from Keitaro Admin API)
CREATE TABLE "keitaro_campaigns" (
    "id"         TEXT NOT NULL,
    "externalId" INTEGER NOT NULL,
    "name"       TEXT NOT NULL,
    "alias"      TEXT NOT NULL,
    "state"      TEXT NOT NULL,
    "groupId"    INTEGER,
    "syncLogId"  TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keitaro_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "keitaro_campaigns_externalId_key" ON "keitaro_campaigns"("externalId");
CREATE INDEX "keitaro_campaigns_state_idx" ON "keitaro_campaigns"("state");
