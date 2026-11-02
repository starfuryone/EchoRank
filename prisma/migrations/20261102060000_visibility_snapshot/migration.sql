-- Free AI Visibility Check (2026-11-02): runs, scored answers, leads.
--
-- ADDITIVE ONLY: three new tables, nothing existing is touched. Every statement
-- is guarded so a partial apply re-runs as a no-op (docs/agents/gotchas.md,
-- "A failed migration leaves rows behind").

-- CreateTable
CREATE TABLE IF NOT EXISTS "visibility_snapshots" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "city" TEXT,
    "category" TEXT NOT NULL,
    "location" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "prompts" JSONB NOT NULL,
    "engines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'queued',
    "report" JSONB,
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "ipHash" TEXT NOT NULL,
    "shareToken" TEXT,
    "shareExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "visibility_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "visibility_snapshot_answers" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "promptIndex" INTEGER NOT NULL,
    "engine" TEXT NOT NULL,
    "model" TEXT,
    "mentioned" BOOLEAN NOT NULL DEFAULT false,
    "cited" BOOLEAN NOT NULL DEFAULT false,
    "competitors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "citedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excerpt" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "error" TEXT,
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visibility_snapshot_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "visibility_snapshot_leads" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visibility_snapshot_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "visibility_snapshots_shareToken_key" ON "visibility_snapshots"("shareToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "visibility_snapshots_domain_createdAt_idx" ON "visibility_snapshots"("domain", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "visibility_snapshots_createdAt_idx" ON "visibility_snapshots"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "visibility_snapshot_answers_snapshotId_promptIndex_engine_key" ON "visibility_snapshot_answers"("snapshotId", "promptIndex", "engine");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "visibility_snapshot_leads_createdAt_idx" ON "visibility_snapshot_leads"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "visibility_snapshot_leads_snapshotId_email_key" ON "visibility_snapshot_leads"("snapshotId", "email");

DO $$ BEGIN
  ALTER TABLE "visibility_snapshot_answers"
    ADD CONSTRAINT "visibility_snapshot_answers_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "visibility_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "visibility_snapshot_leads"
    ADD CONSTRAINT "visibility_snapshot_leads_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "visibility_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
