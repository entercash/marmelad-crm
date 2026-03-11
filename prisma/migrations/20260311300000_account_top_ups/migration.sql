-- CreateTable
CREATE TABLE "account_top_ups" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_top_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_top_ups_accountId_idx" ON "account_top_ups"("accountId");

-- CreateIndex
CREATE INDEX "account_top_ups_date_idx" ON "account_top_ups"("date");

-- AddForeignKey
ALTER TABLE "account_top_ups" ADD CONSTRAINT "account_top_ups_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
