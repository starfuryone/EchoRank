-- AI Action Agent: the draft/approve/apply queue.
--
-- ADDITIVE ONLY. Two new enums, one new table, one new foreign key. Nothing is
-- dropped, renamed or retyped, so `migrate deploy` needs no window.
--
-- ── DATED 20260816040000, AFTER EVERYTHING IT TOUCHES ───────────────────────
-- Filenames here are hand-written and apply in lexical order, so a migration
-- can easily sort before the one that creates a table it references. Checked
-- against every table this file names:
--
--   "tenants"       0_init
--   "action_items"  created here
--
-- and against the tables the FEATURE reads but this file does not touch,
-- because the generators fail at run time if they are absent:
--
--   "ai_api_calls"      20260803...  (Marketing Studio metering)
--   "external_reviews"  0_init
--   "tracked_prompts"   0_init
--   "notifications"     20260813210000_notifications
--   "audit_logs"        0_init
--
-- The latest migration in the tree when this was written was
-- 20260815200000_ai_revenue_rollup, so 20260816040000 sorts last.
--
-- ── TABLE NAMES ARE @@map NAMES, NOT MODEL NAMES ────────────────────────────
-- This schema mixes conventions. `ActionItem` carries @@map("action_items"),
-- matching its neighbours ("notifications", "citation_opportunities",
-- "ai_api_calls"), so the table is "action_items" and NOT "ActionItem". The
-- enum TYPES have no @@map and therefore really are "ActionItemKind" and
-- "ActionItemStatus" in PascalCase — the same split "SeoApiCall" shows.
-- Columns are unmapped camelCase, matching the model, so they are quoted.
--
-- ── EVERY STATEMENT IS GUARDED ──────────────────────────────────────────────
-- IF NOT EXISTS throughout, DO blocks for the two things Postgres gives no such
-- clause: CREATE TYPE and ADD CONSTRAINT. A half-applied run re-applies as a
-- no-op instead of needing the surviving objects dropped by hand.

-- CreateEnum
-- WIDE ON PURPOSE. 'page' and 'gbp_post' are v2 and nothing writes them today.
-- Adding a value to a live enum later is a migration against a table with rows
-- in it, and the state machine's exhaustiveness checks are compile-time — so
-- the whole vocabulary ships once and v2 is a generator plus a copy key.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ActionItemKind') THEN
    CREATE TYPE "ActionItemKind" AS ENUM (
      'schema',
      'faq',
      'page',
      'gbp_post',
      'review_reply'
    );
  END IF;
END
$$;

-- CreateEnum
-- 'rejected' and 'applied' are BOTH TERMINAL. Re-generating after a rejection
-- writes a NEW row with the same "sourceRef"; it never revives this one.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ActionItemStatus') THEN
    CREATE TYPE "ActionItemStatus" AS ENUM (
      'draft',
      'approved',
      'applied',
      'rejected'
    );
  END IF;
END
$$;

-- CreateTable
-- NOTHING IN THIS TABLE AUTO-PUBLISHES. 'applied' means a human copied the
-- draft out and said they used it; "appliedAt" plus the audit_logs row written
-- in the same request is the record of who said so.
CREATE TABLE IF NOT EXISTS "action_items" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "kind"         "ActionItemKind" NOT NULL,
    -- "<Model>:<id>" or a URL. Deliberately a string and deliberately not a
    -- foreign key: the three v1 kinds point at three different tables, one of
    -- which (the audited page) is not a table at all. NOT UNIQUE — the
    -- re-generate path depends on a second row with the same value.
    "sourceRef"    TEXT NOT NULL,
    "draft"        JSONB NOT NULL,
    "status"       "ActionItemStatus" NOT NULL DEFAULT 'draft',
    "approvedBy"   TEXT,
    "approvedAt"   TIMESTAMP(3),
    "rejectedBy"   TEXT,
    "rejectedAt"   TIMESTAMP(3),
    "rejectedNote" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    "appliedAt"    TIMESTAMP(3),

    CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The review queue's only order: this tenant's drafts, newest first, filtered
-- by status.
CREATE INDEX IF NOT EXISTS "action_items_tenantId_status_createdAt_idx"
  ON "action_items" ("tenantId", "status", "createdAt" DESC);

-- CreateIndex
-- The per-kind tab on the same page.
CREATE INDEX IF NOT EXISTS "action_items_tenantId_kind_createdAt_idx"
  ON "action_items" ("tenantId", "kind", "createdAt" DESC);

-- CreateIndex
-- "has this page or review already got a draft" — the de-dupe read the
-- Fix-with-AI buttons do before they enqueue.
CREATE INDEX IF NOT EXISTS "action_items_tenantId_sourceRef_idx"
  ON "action_items" ("tenantId", "sourceRef");

-- AddForeignKey
-- ADD CONSTRAINT has no IF NOT EXISTS, so this is a catalog check. Named
-- exactly as Prisma would name it, so a later `migrate diff` sees no drift.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'action_items_tenantId_fkey'
  ) THEN
    ALTER TABLE "action_items"
      ADD CONSTRAINT "action_items_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
