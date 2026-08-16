-- Pro AI Assistant: saved conversations and their turns.
--
-- ADDITIVE ONLY. Two new tables, two foreign keys, three indexes. No enum, no
-- column dropped, renamed or retyped, so `migrate deploy` needs no window.
--
-- ── DATED 20260816120000, AFTER EVERYTHING IT TOUCHES ───────────────────────
-- Filenames here are hand-written and apply in lexical order, so a migration
-- can sort before the one that creates a table it references. Checked against
-- every table this file names:
--
--   "tenants"                  0_init
--   "assistant_conversations"  created here
--   "assistant_messages"       created here
--
-- and against the tables the FEATURE reads but this file does not touch,
-- because the tools fail at run time if they are absent:
--
--   "ai_api_calls"                       20260803025217_marketing_studio
--   "tracked_prompts" / "prompt_runs"    20260703103029_answer_tracking
--   "gsc_query_stats"                    20260724180703_gsc_insights
--   "crawl_jobs"/"crawl_pages"/"crawl_issues"  20260805053721_site_crawler
--   "ai_lens_analyses"                   20260729200000_ai_lens_analyses
--   "citations" / "competitor_mentions"  20260809120000_ai_search_intelligence
--   "SerpCheck"                          20260728192659_serp_checks
--   "RankProject"/"RankKeyword"/"RankSnapshot"  20260728210140_rank_tracker
--   "Competitor" / "CompetitorSnapshot"  0_init
--   "AlertEvent"                         0_init
--   "VisibilityAudit"                    predates the replayable history — it
--                                        exists in the database but no
--                                        migration file creates it (see
--                                        docs/agents/BLOCKERS.md §5).
--
-- The latest migration in the tree when this was written was
-- 20260816040000_ai_action_agent, so 20260816120000 sorts last.
--
-- ── TABLE NAMES ARE @@map NAMES, NOT MODEL NAMES ────────────────────────────
-- Both models carry @@map, matching their neighbours ("action_items",
-- "notifications", "ai_api_calls"), so the tables are "assistant_conversations"
-- and "assistant_messages". Columns are unmapped camelCase, matching the
-- models, so they are quoted.
--
-- ── EVERY STATEMENT IS GUARDED ──────────────────────────────────────────────
-- IF NOT EXISTS throughout, DO blocks for ADD CONSTRAINT (the one thing
-- Postgres gives no such clause). A half-applied run re-applies as a no-op
-- instead of needing the surviving objects dropped by hand.

-- CreateTable
-- "userId" is NOT a foreign key to "users", deliberately. It records who
-- started the conversation for display; a hard FK would cascade-delete a
-- tenant's history when a seat is removed, and the history belongs to the
-- tenant rather than to the person who happened to type first.
CREATE TABLE IF NOT EXISTS "assistant_conversations" (
    "id"        TEXT NOT NULL,
    "tenantId"  TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "title"     TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- "toolSummary" is a summary, never the tool payload: results can carry the
-- tenant's crawler page text and Search Console queries, and a second copy
-- would double that surface without adding an answer.
CREATE TABLE IF NOT EXISTS "assistant_messages" (
    "id"             TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role"           TEXT NOT NULL,
    "content"        TEXT NOT NULL,
    "toolSummary"    JSONB,
    "inputTokens"    INTEGER NOT NULL DEFAULT 0,
    "outputTokens"   INTEGER NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The history list's only order: this tenant's conversations, most recently
-- used first. Leading on "tenantId" is what makes the tenant scope an index
-- seek rather than a filter over everybody's rows.
CREATE INDEX IF NOT EXISTS "assistant_conversations_tenantId_updatedAt_idx"
  ON "assistant_conversations" ("tenantId", "updatedAt" DESC);

-- CreateIndex
-- Transcript replay: one conversation, oldest first.
CREATE INDEX IF NOT EXISTS "assistant_messages_conversationId_createdAt_idx"
  ON "assistant_messages" ("conversationId", "createdAt");

-- AddForeignKey
-- ADD CONSTRAINT has no IF NOT EXISTS, so this is a catalog check. Named
-- exactly as Prisma would name it, so a later `migrate diff` sees no drift.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assistant_conversations_tenantId_fkey'
  ) THEN
    ALTER TABLE "assistant_conversations"
      ADD CONSTRAINT "assistant_conversations_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- AddForeignKey
-- CASCADE is what makes the delete endpoint a single statement: removing a
-- conversation removes its turns, and there is no orphan sweep to forget.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assistant_messages_conversationId_fkey'
  ) THEN
    ALTER TABLE "assistant_messages"
      ADD CONSTRAINT "assistant_messages_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "assistant_conversations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
