-- Payment model enum
CREATE TYPE "PaymentModel" AS ENUM ('CPL', 'CPA');

-- Campaign links: Taboola ↔ Keitaro mapping with payment model
CREATE TABLE "campaign_links" (
    "id"                        TEXT NOT NULL,
    "taboolaCampaignExternalId" TEXT NOT NULL,
    "taboolaCampaignName"       TEXT NOT NULL,
    "keitaroCampaignId"         TEXT NOT NULL,
    "paymentModel"              "PaymentModel" NOT NULL,
    "cplRate"                   DECIMAL(12, 4),
    "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                 TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "campaign_links_taboolaCampaignExternalId_keitaroCampaignId_key"
    ON "campaign_links"("taboolaCampaignExternalId", "keitaroCampaignId");

CREATE INDEX "campaign_links_keitaroCampaignId_idx"
    ON "campaign_links"("keitaroCampaignId");

ALTER TABLE "campaign_links"
    ADD CONSTRAINT "campaign_links_keitaroCampaignId_fkey"
    FOREIGN KEY ("keitaroCampaignId")
    REFERENCES "keitaro_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
