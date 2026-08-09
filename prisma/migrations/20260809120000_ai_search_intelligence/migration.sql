-- CreateEnum
CREATE TYPE "PromptFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "CitationType" AS ENUM ('EDITORIAL', 'COMPARISON', 'REVIEW', 'DOCS', 'FORUM', 'SOCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('PUBLISHER', 'VENDOR', 'MARKETPLACE', 'COMMUNITY', 'DOCS', 'SOCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('CONTENT_GAP', 'CITATION_OPPORTUNITY', 'WEAK_ASSOCIATION', 'NEGATIVE_SENTIMENT', 'STRUCTURED_DATA', 'ENTITY_SIGNAL', 'AUTHORITY_SIGNAL', 'HIGH_VALUE_PROMPT');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'DISMISSED', 'STALE');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'INCONCLUSIVE', 'ABANDONED');

-- AlterTable
ALTER TABLE "brand_profiles" ADD COLUMN     "country" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingEvidence" JSONB;

-- AlterTable
ALTER TABLE "mention_analyses" ADD COLUMN     "attributes" JSONB,
ADD COLUMN     "firstPosition" INTEGER,
ADD COLUMN     "prominenceScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quarantineReason" TEXT,
ADD COLUMN     "quarantinedAt" TIMESTAMP(3),
ADD COLUMN     "recommendationPosition" INTEGER;

-- AlterTable
ALTER TABLE "prompt_runs" ADD COLUMN     "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
ADD COLUMN     "inputTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "latencyMs" INTEGER,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "normalizedResponse" TEXT,
ADD COLUMN     "outputTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "persona" TEXT,
ADD COLUMN     "rawResponse" TEXT,
ADD COLUMN     "responseHash" TEXT;

-- AlterTable
ALTER TABLE "tracked_prompts" ADD COLUMN     "commercialValue" INTEGER,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "importanceWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "trackingFrequency" "PromptFrequency" NOT NULL DEFAULT 'WEEKLY';

-- CreateTable
CREATE TABLE "ai_engines" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "supportsSearch" BOOLEAN NOT NULL DEFAULT false,
    "supportsCitations" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_engines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "promptRunId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT,
    "citationPosition" INTEGER,
    "supportsBrand" BOOLEAN NOT NULL DEFAULT false,
    "supportsCompetitor" TEXT,
    "citationType" "CitationType" NOT NULL DEFAULT 'OTHER',
    "verifiedAt" TIMESTAMP(3),
    "httpStatus" INTEGER,
    "titleMatches" BOOLEAN,
    "brandOnPage" BOOLEAN,
    "competitorOnPage" BOOLEAN,
    "verifyError" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_mentions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "promptRunId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mentionCount" INTEGER NOT NULL DEFAULT 0,
    "firstPosition" INTEGER,
    "recommendationPosition" INTEGER,
    "prominenceScore" INTEGER NOT NULL DEFAULT 0,
    "sentiment" TEXT,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitor_mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visibility_metrics" (
    "id" TEXT NOT NULL,
    "brandProfileId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "visibilityScore" DOUBLE PRECISION NOT NULL,
    "citationScore" DOUBLE PRECISION,
    "recommendationScore" DOUBLE PRECISION NOT NULL,
    "sentimentScore" DOUBLE PRECISION,
    "shareOfVoice" DOUBLE PRECISION,
    "averagePosition" DOUBLE PRECISION,
    "mentionRate" DOUBLE PRECISION NOT NULL,
    "top3Rate" DOUBLE PRECISION NOT NULL,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visibility_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandProfileId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "citationCount" INTEGER NOT NULL DEFAULT 0,
    "brandsSupported" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brandCitations" INTEGER NOT NULL DEFAULT 0,
    "competitorCitations" INTEGER NOT NULL DEFAULT 0,
    "distinctEngines" INTEGER NOT NULL DEFAULT 0,
    "commercialPromptCount" INTEGER NOT NULL DEFAULT 0,
    "authorityScore" DOUBLE PRECISION,
    "topicalCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceType" "SourceType" NOT NULL DEFAULT 'OTHER',
    "influenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandProfileId" TEXT NOT NULL,
    "type" "RecommendationType" NOT NULL,
    "title" TEXT NOT NULL,
    "suggestedAction" TEXT NOT NULL,
    "estimatedImpact" DOUBLE PRECISION NOT NULL,
    "effort" DOUBLE PRECISION NOT NULL,
    "priority" DOUBLE PRECISION NOT NULL,
    "priorityBand" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'OPEN',
    "promptId" TEXT,
    "sourceId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandProfileId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'RUNNING',
    "hypothesis" TEXT NOT NULL,
    "baseline" JSONB NOT NULL,
    "result" JSONB,
    "pValue" DOUBLE PRECISION,
    "successful" BOOLEAN,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "evaluatedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_engines_enabled_sortOrder_idx" ON "ai_engines"("enabled", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ai_engines_provider_modelName_key" ON "ai_engines"("provider", "modelName");

-- CreateIndex
CREATE INDEX "citations_tenantId_domain_createdAt_idx" ON "citations"("tenantId", "domain", "createdAt");

-- CreateIndex
CREATE INDEX "citations_sourceId_createdAt_idx" ON "citations"("sourceId", "createdAt");

-- CreateIndex
CREATE INDEX "citations_verifiedAt_idx" ON "citations"("verifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "citations_promptRunId_url_key" ON "citations"("promptRunId", "url");

-- CreateIndex
CREATE INDEX "competitor_mentions_tenantId_name_createdAt_idx" ON "competitor_mentions"("tenantId", "name", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_mentions_promptRunId_name_key" ON "competitor_mentions"("promptRunId", "name");

-- CreateIndex
CREATE INDEX "visibility_metrics_brandProfileId_day_idx" ON "visibility_metrics"("brandProfileId", "day" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "visibility_metrics_brandProfileId_engine_day_key" ON "visibility_metrics"("brandProfileId", "engine", "day");

-- CreateIndex
CREATE INDEX "sources_brandProfileId_influenceScore_idx" ON "sources"("brandProfileId", "influenceScore" DESC);

-- CreateIndex
CREATE INDEX "sources_tenantId_domain_idx" ON "sources"("tenantId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "sources_brandProfileId_domain_key" ON "sources"("brandProfileId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "recommendations_dedupeKey_key" ON "recommendations"("dedupeKey");

-- CreateIndex
CREATE INDEX "recommendations_brandProfileId_status_priority_idx" ON "recommendations"("brandProfileId", "status", "priority" DESC);

-- CreateIndex
CREATE INDEX "recommendations_tenantId_createdAt_idx" ON "recommendations"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "experiments_brandProfileId_status_idx" ON "experiments"("brandProfileId", "status");

-- CreateIndex
CREATE INDEX "experiments_tenantId_startedAt_idx" ON "experiments"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "mention_analyses_quarantinedAt_idx" ON "mention_analyses"("quarantinedAt");

-- CreateIndex
CREATE INDEX "prompt_runs_promptId_engine_createdAt_idx" ON "prompt_runs"("promptId", "engine", "createdAt");

-- CreateIndex
CREATE INDEX "tracked_prompts_active_trackingFrequency_nextRunAt_idx" ON "tracked_prompts"("active", "trackingFrequency", "nextRunAt");

-- AddForeignKey
ALTER TABLE "citations" ADD CONSTRAINT "citations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citations" ADD CONSTRAINT "citations_promptRunId_fkey" FOREIGN KEY ("promptRunId") REFERENCES "prompt_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citations" ADD CONSTRAINT "citations_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_mentions" ADD CONSTRAINT "competitor_mentions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_mentions" ADD CONSTRAINT "competitor_mentions_promptRunId_fkey" FOREIGN KEY ("promptRunId") REFERENCES "prompt_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visibility_metrics" ADD CONSTRAINT "visibility_metrics_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "tracked_prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "tracked_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

