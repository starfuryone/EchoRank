-- CreateTable
CREATE TABLE "RankProject" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "locationCode" INTEGER NOT NULL,
    "languageCode" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "overCap" BOOLEAN NOT NULL DEFAULT false,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankKeyword" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankSnapshot" (
    "id" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "position" INTEGER,
    "url" TEXT,
    "serpFeatures" JSONB,
    "dataforseoTaskId" TEXT,
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "error" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RankSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RankProject_tenantId_createdAt_idx" ON "RankProject"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "RankProject_active_frequency_idx" ON "RankProject"("active", "frequency");

-- CreateIndex
CREATE INDEX "RankKeyword_projectId_idx" ON "RankKeyword"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "RankKeyword_projectId_keyword_key" ON "RankKeyword"("projectId", "keyword");

-- CreateIndex
CREATE UNIQUE INDEX "RankSnapshot_dataforseoTaskId_key" ON "RankSnapshot"("dataforseoTaskId");

-- CreateIndex
CREATE INDEX "RankSnapshot_keywordId_runDate_idx" ON "RankSnapshot"("keywordId", "runDate");

-- CreateIndex
CREATE INDEX "RankSnapshot_status_runDate_idx" ON "RankSnapshot"("status", "runDate");

-- AddForeignKey
ALTER TABLE "RankKeyword" ADD CONSTRAINT "RankKeyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RankProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankSnapshot" ADD CONSTRAINT "RankSnapshot_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "RankKeyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
