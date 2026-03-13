-- CreateTable
CREATE TABLE "seo_brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_leads" (
    "id" TEXT NOT NULL,
    "seoBrandId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "country" TEXT NOT NULL,
    "paymentModel" "PaymentModel" NOT NULL,
    "rate" DECIMAL(12,4) NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seo_leads_seoBrandId_date_country_key" ON "seo_leads"("seoBrandId", "date", "country");

-- AddForeignKey
ALTER TABLE "seo_leads" ADD CONSTRAINT "seo_leads_seoBrandId_fkey" FOREIGN KEY ("seoBrandId") REFERENCES "seo_brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;
