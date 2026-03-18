-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('UP', 'DOWN', 'SSL_ERROR', 'DNS_ERROR', 'BANNED', 'EXPIRED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "domains" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "status" "DomainStatus" NOT NULL DEFAULT 'UNKNOWN',
    "httpStatus" INTEGER,
    "responseMs" INTEGER,
    "sslExpiry" TIMESTAMP(3),
    "sslIssuer" TEXT,
    "dnsResolves" BOOLEAN,
    "registrar" TEXT,
    "domainExpiry" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastUpAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "domains_url_key" ON "domains"("url");

-- CreateIndex
CREATE INDEX "domains_status_idx" ON "domains"("status");
