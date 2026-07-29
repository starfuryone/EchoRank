-- CreateTable
CREATE TABLE "BacklinksAnalysis" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "summary" JSONB,
    "history" JSONB,
    "referringDomains" JSONB,
    "anchors" JSONB,
    "pages" JSONB,
    "failedSections" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BacklinksAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BacklinksAnalysis_tenantId_target_mode_createdAt_idx" ON "BacklinksAnalysis"("tenantId", "target", "mode", "createdAt");

-- CreateIndex
CREATE INDEX "BacklinksAnalysis_tenantId_createdAt_idx" ON "BacklinksAnalysis"("tenantId", "createdAt");
