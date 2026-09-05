-- Backlink overview snapshots, for the Full tier's history sparkline.
--
-- ADDITIVE ONLY. One new table, one index, no change to any existing object.
--
-- APPLIED BY HAND, like every migration on this box — the database user cannot
-- create the shadow database `prisma migrate dev` needs
-- (docs/agents/BLOCKERS.md):
--
--   psql "$DATABASE_URL" -f prisma/migrations/20260905240000_backlink_snapshots/migration.sql
--   npx prisma migrate resolve --applied 20260905240000_backlink_snapshots
--
-- WRITES FAIL SOFT until this is applied (see src/lib/backlinks/snapshots.ts),
-- so a backlinks lookup keeps working and simply records no history point. The
-- customer is already charged by the time the write happens; failing their
-- lookup over a chart would be the wrong trade.

CREATE TABLE IF NOT EXISTS "backlink_snapshots" (
    "id"               TEXT NOT NULL,
    "tenantId"         TEXT NOT NULL,
    "target"           TEXT NOT NULL,
    "mode"             TEXT NOT NULL,
    "backlinks"        INTEGER NOT NULL,
    "referringDomains" INTEGER NOT NULL,
    "rank"             INTEGER,
    "brokenBacklinks"  INTEGER,
    "dofollowDomains"  INTEGER,
    "capturedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backlink_snapshots_pkey" PRIMARY KEY ("id")
);

-- The sparkline query: one tenant, one target+scope, oldest first.
CREATE INDEX IF NOT EXISTS "backlink_snapshots_tenantId_target_mode_capturedAt_idx"
    ON "backlink_snapshots" ("tenantId", "target", "mode", "capturedAt");
