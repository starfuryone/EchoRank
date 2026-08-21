-- Blog agent run ledger.
--
-- ORDERING: this migration creates its own table and two enums and ALTERS
-- NOTHING. Per the 2026-08-15 incident (a migration that altered a table a
-- later-sorting migration created), the check before adding one is "does the
-- migration that creates each table I touch sort earlier" — here there are no
-- such tables, so it is safe at any position.
--
-- GUARDED THROUGHOUT: every statement is IF NOT EXISTS, and the enums use a DO
-- block because CREATE TYPE has no IF NOT EXISTS. A partially applied run
-- leaves _prisma_migrations rows behind that block `migrate deploy` until they
-- are resolved by hand; writing it this way makes a re-apply a no-op instead.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BlogAgentStage') THEN
    CREATE TYPE "BlogAgentStage" AS ENUM ('DISCOVER', 'RESEARCH', 'DRAFT', 'GATE', 'LAND');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BlogAgentStatus') THEN
    CREATE TYPE "BlogAgentStatus" AS ENUM (
      'DISCOVERED', 'DRAFTED', 'GATED_FAIL', 'AWAITING_REVIEW',
      'APPROVED', 'PUBLISHED', 'REJECTED'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "blog_agent_runs" (
  "id"         TEXT NOT NULL,
  "stage"      "BlogAgentStage" NOT NULL,
  "status"     "BlogAgentStatus" NOT NULL,
  "topicHash"  TEXT NOT NULL,
  "topicTitle" TEXT NOT NULL,
  "sourceId"   TEXT NOT NULL,
  "sourceUrls" JSONB NOT NULL,
  "slug"       TEXT,
  "costUsd"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "error"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "blog_agent_runs_pkey" PRIMARY KEY ("id")
);

-- The 30-day dedupe lookback.
CREATE INDEX IF NOT EXISTS "blog_agent_runs_topicHash_createdAt_idx"
  ON "blog_agent_runs" ("topicHash", "createdAt" DESC);

-- The daily spend cap.
CREATE INDEX IF NOT EXISTS "blog_agent_runs_createdAt_idx"
  ON "blog_agent_runs" ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "blog_agent_runs_status_idx"
  ON "blog_agent_runs" ("status");
