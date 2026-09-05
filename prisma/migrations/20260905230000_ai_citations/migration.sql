-- AI Citations — which pages AI platforms cite for a target, and the brand's
-- share of voice against competitors. One row per lookup; the row is also the
-- 24h cache.
--
-- ADDITIVE ONLY. One new table, two indexes, no change to any existing object.
--
-- APPLIED BY HAND, like every migration on this box — the database user cannot
-- create the shadow database `prisma migrate dev` needs
-- (docs/agents/BLOCKERS.md):
--
--   psql "$DATABASE_URL" -f prisma/migrations/20260905230000_ai_citations/migration.sql
--   npx prisma migrate resolve --applied 20260905230000_ai_citations
--
-- SAFE TO APPLY BEFORE THE FEATURE IS ENABLED, and that is the intent: nothing
-- writes to this table until AI_CITATIONS_VERIFIED is set, so applying it now
-- means flipping the feature live later is an env change and a redeploy rather
-- than a second migration window.

CREATE TABLE IF NOT EXISTS "ai_citations_analyses" (
    "id"              TEXT NOT NULL,
    "tenantId"        TEXT NOT NULL,
    "target"          TEXT NOT NULL,
    "scope"           TEXT NOT NULL,
    "cacheKey"        TEXT NOT NULL,
    "platforms"       JSONB NOT NULL,
    "competitors"     JSONB NOT NULL,
    "status"          TEXT NOT NULL,
    "costUsd"         DECIMAL(10,6) NOT NULL DEFAULT 0,
    "totals"          JSONB,
    "sources"         JSONB,
    "shareOfVoice"    JSONB,
    "failedPlatforms" JSONB NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_citations_analyses_pkey" PRIMARY KEY ("id")
);

-- The cache probe: one tenant, one exact key, newest first.
CREATE INDEX IF NOT EXISTS "ai_citations_analyses_tenantId_cacheKey_createdAt_idx"
    ON "ai_citations_analyses" ("tenantId", "cacheKey", "createdAt");

-- History list and the MCP read.
CREATE INDEX IF NOT EXISTS "ai_citations_analyses_tenantId_createdAt_idx"
    ON "ai_citations_analyses" ("tenantId", "createdAt");
