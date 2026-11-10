-- The free AI Readiness Audit's benchmark ("higher than X% of sites checked",
-- ECHORANK-AI-VISIBILITY-PAGES.md Phase 2): one row per successful free audit,
-- the score and its scoreVersion only. No domain, no IP. Read by
-- src/lib/free-audit/benchmark.ts once per UTC day.
-- Hand-written, additive, guarded so a retried deploy is a no-op. Applied by
-- `prisma migrate deploy` (sudo echorank360-deploy), never by hand.

CREATE TABLE IF NOT EXISTS "free_audit_scores" (
    "id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "scoreVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "free_audit_scores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "free_audit_scores_scoreVersion_createdAt_idx" ON "free_audit_scores"("scoreVersion", "createdAt");
