-- Keyword Opportunity Finder: analyses, opportunities, prompts, results,
-- and a credit pool of its own.
--
-- ADDITIVE ONLY. One new enum, five new tables, seven new foreign keys.
-- Nothing is dropped, renamed or retyped, so `migrate deploy` needs no window
-- and no existing row changes meaning.
--
-- ── DATED 20260817060000, AFTER EVERYTHING IT REFERENCES ────────────────────
-- Filenames here are hand-written and apply in lexical order, so a migration
-- can easily sort before the one that creates a table it references. Checked
-- against every table this file names:
--
--   "tenants"                            0_init
--   "brand_profiles"                     20260809120000_ai_search_intelligence
--   "keyword_opportunity_analyses"       created here
--   "keyword_opportunities"              created here
--   "opportunity_prompts"                created here
--
-- and against the enum this file REUSES rather than creates:
--
--   "CreditReason"                       20260815190000_credit_packs
--
-- The latest migration in the tree when this was written was
-- 20260816120000_assistant_pro, so 20260817060000 sorts last.
--
-- ── THE CREDIT POOL IS A SECOND TABLE, NOT A COLUMN ON credit_ledger ────────
-- credit_ledger holds prepaid Places lookups for the Agency Opportunity
-- Scanner. Its balance is SUM(delta) over every row a tenant has and /billing
-- renders that sum, so a `pool` column there would silently change what every
-- existing balance read means. "keyword_opportunity_credits" costs one table
-- and keeps both balances honest.
--
-- The CreditReason ENUM is reused deliberately — the five movements are the
-- same five, and a parallel enum with identical members is two vocabularies for
-- one idea. Only `ref` differs in meaning, which the schema documents.
--
-- ── TABLE NAMES ARE @@map NAMES ─────────────────────────────────────────────
-- Every model here carries an @@map, so the tables are the snake_case names
-- below and not the model names.

-- CreateEnum
CREATE TYPE "KeywordOpportunityStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "keyword_opportunity_analyses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "brandProfileId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" "KeywordOpportunityStatus" NOT NULL DEFAULT 'QUEUED',
    "currentStep" TEXT,
    "scoreVersion" INTEGER NOT NULL DEFAULT 1,
    "dateBucket" TEXT NOT NULL,
    "fromCache" BOOLEAN NOT NULL DEFAULT false,
    "keywordCount" INTEGER NOT NULL DEFAULT 0,
    "aiTestedCount" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "dataforseoCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "aiCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "allowanceConsumed" BOOLEAN NOT NULL DEFAULT false,
    "fundingSource" TEXT,
    "stoppedReason" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_opportunity_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_opportunities" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "monthlyVolume" INTEGER NOT NULL,
    "cpcUsd" DECIMAL(10,2) NOT NULL,
    "competition" DOUBLE PRECISION NOT NULL,
    "trendPercent" DOUBLE PRECISION NOT NULL,
    "googleRank" INTEGER,
    "rankSource" TEXT,
    "intent" TEXT NOT NULL,
    "componentScores" JSONB NOT NULL,
    "opportunityScore" INTEGER NOT NULL,
    "severity" TEXT NOT NULL,
    "aiTested" BOOLEAN NOT NULL DEFAULT false,
    "aiMentioned" BOOLEAN,
    "aiMentionRate" DOUBLE PRECISION,
    "aiAveragePosition" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_prompts" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "intent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_prompt_results" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "brandMentioned" BOOLEAN NOT NULL,
    "brandPosition" INTEGER,
    "answerSnapshot" TEXT NOT NULL,
    "competitors" JSONB NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_prompt_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_opportunity_credits" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "CreditReason" NOT NULL,
    "ref" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_opportunity_credits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "keyword_opportunity_analyses_tenantId_createdAt_idx" ON "keyword_opportunity_analyses"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "keyword_opportunity_analyses_domain_dateBucket_idx" ON "keyword_opportunity_analyses"("domain", "dateBucket");

-- CreateIndex
CREATE INDEX "keyword_opportunity_analyses_status_startedAt_idx" ON "keyword_opportunity_analyses"("status", "startedAt");

-- CreateIndex
CREATE INDEX "keyword_opportunities_analysisId_opportunityScore_idx" ON "keyword_opportunities"("analysisId", "opportunityScore" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "keyword_opportunities_analysisId_keyword_key" ON "keyword_opportunities"("analysisId", "keyword");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_prompts_opportunityId_key" ON "opportunity_prompts"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_prompt_results_promptId_key" ON "opportunity_prompt_results"("promptId");

-- CreateIndex
CREATE INDEX "keyword_opportunity_credits_tenantId_createdAt_idx" ON "keyword_opportunity_credits"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "keyword_opportunity_credits_tenantId_reason_ref_key" ON "keyword_opportunity_credits"("tenantId", "reason", "ref");

-- AddForeignKey
ALTER TABLE "keyword_opportunity_analyses" ADD CONSTRAINT "keyword_opportunity_analyses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_opportunity_analyses" ADD CONSTRAINT "keyword_opportunity_analyses_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_opportunities" ADD CONSTRAINT "keyword_opportunities_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "keyword_opportunity_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_prompts" ADD CONSTRAINT "opportunity_prompts_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "keyword_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_prompt_results" ADD CONSTRAINT "opportunity_prompt_results_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "opportunity_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_opportunity_credits" ADD CONSTRAINT "keyword_opportunity_credits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
