-- CreateEnum
CREATE TYPE "GscConnectionStatus" AS ENUM ('ACTIVE', 'NEEDS_REAUTH');

-- CreateTable
CREATE TABLE "gsc_connections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "googleEmail" TEXT,
    "siteUrl" TEXT,
    "status" "GscConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gsc_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gsc_query_stats" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "query" TEXT NOT NULL,
    "page" TEXT NOT NULL DEFAULT '',
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "gsc_query_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gsc_connections_tenantId_key" ON "gsc_connections"("tenantId");

-- CreateIndex
CREATE INDEX "gsc_query_stats_tenantId_query_date_idx" ON "gsc_query_stats"("tenantId", "query", "date");

-- CreateIndex
CREATE INDEX "gsc_query_stats_tenantId_date_idx" ON "gsc_query_stats"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "gsc_query_stats_tenantId_date_query_page_key" ON "gsc_query_stats"("tenantId", "date", "query", "page");

-- AddForeignKey
ALTER TABLE "gsc_connections" ADD CONSTRAINT "gsc_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gsc_query_stats" ADD CONSTRAINT "gsc_query_stats_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

