-- AlterTable
ALTER TABLE "accounts" ADD COLUMN "accountCostUsd" DECIMAL(12,2),
ADD COLUMN "commissionPercent" DECIMAL(8,4),
ADD COLUMN "cryptoPaymentPercent" DECIMAL(8,4);
