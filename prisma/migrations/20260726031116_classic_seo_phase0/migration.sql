-- CreateTable
CREATE TABLE "SeoApiCall" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "costUsd" DECIMAL(10,6) NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoApiCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoDomainSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL,
    "languageCode" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoDomainSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoKeywordOverviewCache" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL,
    "languageCode" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoKeywordOverviewCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeoApiCall_tenantId_createdAt_idx" ON "SeoApiCall"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SeoDomainSnapshot_tenantId_target_locationCode_languageCode_key" ON "SeoDomainSnapshot"("tenantId", "target", "locationCode", "languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "SeoKeywordOverviewCache_tenantId_keyword_locationCode_langu_key" ON "SeoKeywordOverviewCache"("tenantId", "keyword", "locationCode", "languageCode");

