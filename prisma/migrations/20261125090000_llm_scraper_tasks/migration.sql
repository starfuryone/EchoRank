-- ChatGPT and Gemini checks on DataForSEO's LLM Scraper standard queue
-- (src/lib/ai-monitor/runner/llm-scraper.ts). Additive; generated with
-- `prisma migrate diff`, the diff's two pre-existing drift statements left out.
-- Guarded, so a second apply is a no-op.

DO $$ BEGIN
  CREATE TYPE "LlmScraperTaskStatus" AS ENUM ('QUEUED', 'DONE', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "llm_scraper_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "checkupId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "promptCategory" TEXT,
    "repetition" INTEGER NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" "LlmScraperTaskStatus" NOT NULL DEFAULT 'QUEUED',
    "answer" TEXT,
    "sources" JSONB,
    "servedModel" TEXT,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "llm_scraper_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "llm_scraper_tasks_taskId_key" ON "llm_scraper_tasks"("taskId");
CREATE INDEX IF NOT EXISTS "llm_scraper_tasks_provider_status_createdAt_idx" ON "llm_scraper_tasks"("provider", "status", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "llm_scraper_tasks_checkupId_slotKey_key" ON "llm_scraper_tasks"("checkupId", "slotKey");

DO $$ BEGIN
  ALTER TABLE "llm_scraper_tasks" ADD CONSTRAINT "llm_scraper_tasks_checkupId_fkey" FOREIGN KEY ("checkupId") REFERENCES "checkups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
