-- CreateTable
CREATE TABLE "SerpCheck" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL,
    "languageCode" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "dataforseoTaskId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "results" JSONB,
    "serpFeatures" JSONB,
    "itemCount" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SerpCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SerpCheck_dataforseoTaskId_key" ON "SerpCheck"("dataforseoTaskId");

-- CreateIndex
CREATE INDEX "SerpCheck_tenantId_keyword_locationCode_languageCode_device_idx" ON "SerpCheck"("tenantId", "keyword", "locationCode", "languageCode", "device", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SerpCheck_tenantId_createdAt_idx" ON "SerpCheck"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "SerpCheck_status_createdAt_idx" ON "SerpCheck"("status", "createdAt");

