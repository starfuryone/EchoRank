-- Research Log — advisory record of paid research, so the next caller can find
-- a recent result before buying the same thing again.
--
-- ADDITIVE ONLY. One new table, two indexes, no change to any existing object.
--
-- HOW THIS IS APPLIED ON THIS BOX. The database user cannot create the shadow
-- database `prisma migrate dev` needs (docs/agents/BLOCKERS.md), so this file
-- is applied by hand and then marked:
--
--   psql "$DATABASE_URL" -f prisma/migrations/20260905220000_research_log/migration.sql
--   npx prisma migrate resolve --applied 20260905220000_research_log
--
-- IF NOT YET APPLIED. src/lib/research-log/store.ts swallows and logs write
-- failures on purpose, so an unapplied migration leaves the log empty and
-- leaves every analysis that would have written to it working normally. The
-- log is advisory; nothing reads it to decide whether a call may proceed.

CREATE TABLE IF NOT EXISTS "research_log" (
    "id"        TEXT NOT NULL,
    "tenantId"  TEXT NOT NULL,
    "feature"   TEXT NOT NULL,
    "target"    TEXT NOT NULL,
    "metrics"   JSONB,
    "costUsd"   DECIMAL(10,6) NOT NULL DEFAULT 0,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_log_pkey" PRIMARY KEY ("id")
);

-- The reuse question: has this workspace researched this target lately?
CREATE INDEX IF NOT EXISTS "research_log_tenantId_feature_target_createdAt_idx"
    ON "research_log" ("tenantId", "feature", "target", "createdAt");

-- The hub panel and the MCP tool: recent research, newest first.
CREATE INDEX IF NOT EXISTS "research_log_tenantId_createdAt_idx"
    ON "research_log" ("tenantId", "createdAt");
