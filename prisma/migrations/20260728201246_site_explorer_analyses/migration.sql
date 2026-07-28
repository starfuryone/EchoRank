-- CreateTable
CREATE TABLE "SiteExplorerAnalysis" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL,
    "languageCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "overview" JSONB,
    "rankedKeywords" JSONB,
    "competitors" JSONB,
    "backlinks" JSONB,
    "failedSections" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteExplorerAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteExplorerAnalysis_tenantId_domain_locationCode_languageC_idx" ON "SiteExplorerAnalysis"("tenantId", "domain", "locationCode", "languageCode", "createdAt");

-- CreateIndex
CREATE INDEX "SiteExplorerAnalysis_tenantId_createdAt_idx" ON "SiteExplorerAnalysis"("tenantId", "createdAt");
