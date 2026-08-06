-- CreateEnum
CREATE TYPE "CheckupStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CAPPED');

-- CreateEnum
CREATE TYPE "PromptSource" AS ENUM ('SUGGESTED', 'CUSTOM', 'EDITED');

-- AlterTable
ALTER TABLE "prompt_runs" ADD COLUMN     "checkupId" TEXT,
ADD COLUMN     "repetition" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "tracked_prompts" ADD COLUMN     "audience" TEXT,
ADD COLUMN     "brandProfileId" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "intent" TEXT,
ADD COLUMN     "language" TEXT DEFAULT 'en',
ADD COLUMN     "market" TEXT,
ADD COLUMN     "relevanceScore" INTEGER,
ADD COLUMN     "selected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source" "PromptSource";

-- CreateTable
CREATE TABLE "brand_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "industry" TEXT,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "competitors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "markets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audiences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "trackingActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandProfileId" TEXT NOT NULL,
    "status" "CheckupStatus" NOT NULL DEFAULT 'QUEUED',
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "providers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "promptCount" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 1,
    "visibilityScore" DOUBLE PRECISION,
    "repeatabilityScore" DOUBLE PRECISION,
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "stoppedReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mention_analyses" (
    "id" TEXT NOT NULL,
    "promptRunId" TEXT NOT NULL,
    "brandMentioned" BOOLEAN NOT NULL,
    "mentionCount" INTEGER NOT NULL DEFAULT 0,
    "listPosition" INTEGER,
    "competitorNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "citedOwnDomain" BOOLEAN NOT NULL DEFAULT false,
    "citedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contextSnippets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommended" BOOLEAN,
    "recommendationStrength" DOUBLE PRECISION,
    "sentiment" TEXT,
    "quotedDescription" TEXT,
    "factualClaims" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "possibleInaccuracies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DOUBLE PRECISION,
    "visibilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mention_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkup_trends" (
    "id" TEXT NOT NULL,
    "brandProfileId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "visibilityScore" DOUBLE PRECISION NOT NULL,
    "repeatabilityScore" DOUBLE PRECISION,
    "mentionRate" DOUBLE PRECISION,
    "byProvider" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkup_trends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider_calls" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "checkupId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'answer',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(10,6) NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_provider_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_profiles_tenantId_idx" ON "brand_profiles"("tenantId");

-- CreateIndex
CREATE INDEX "checkups_brandProfileId_completedAt_idx" ON "checkups"("brandProfileId", "completedAt");

-- CreateIndex
CREATE INDEX "checkups_tenantId_createdAt_idx" ON "checkups"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "mention_analyses_promptRunId_key" ON "mention_analyses"("promptRunId");

-- CreateIndex
CREATE INDEX "checkup_trends_brandProfileId_day_idx" ON "checkup_trends"("brandProfileId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "checkup_trends_brandProfileId_day_key" ON "checkup_trends"("brandProfileId", "day");

-- CreateIndex
CREATE INDEX "ai_provider_calls_tenantId_createdAt_idx" ON "ai_provider_calls"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_provider_calls_checkupId_provider_idx" ON "ai_provider_calls"("checkupId", "provider");

-- CreateIndex
CREATE INDEX "prompt_runs_checkupId_engine_idx" ON "prompt_runs"("checkupId", "engine");

-- CreateIndex
CREATE INDEX "tracked_prompts_brandProfileId_selected_idx" ON "tracked_prompts"("brandProfileId", "selected");

-- AddForeignKey
ALTER TABLE "tracked_prompts" ADD CONSTRAINT "tracked_prompts_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_runs" ADD CONSTRAINT "prompt_runs_checkupId_fkey" FOREIGN KEY ("checkupId") REFERENCES "checkups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkups" ADD CONSTRAINT "checkups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkups" ADD CONSTRAINT "checkups_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mention_analyses" ADD CONSTRAINT "mention_analyses_promptRunId_fkey" FOREIGN KEY ("promptRunId") REFERENCES "prompt_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkup_trends" ADD CONSTRAINT "checkup_trends_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_provider_calls" ADD CONSTRAINT "ai_provider_calls_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_provider_calls" ADD CONSTRAINT "ai_provider_calls_checkupId_fkey" FOREIGN KEY ("checkupId") REFERENCES "checkups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

