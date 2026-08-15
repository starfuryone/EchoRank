-- AI Revenue Dashboard: the monthly rollup table, and the two tenant
-- assumptions every figure on it is computed from.
--
-- ADDITIVE ONLY. Two new enums, one new table, two new defaulted columns on
-- "tenants". Nothing is dropped, renamed or retyped, so `migrate deploy` needs
-- no window and every existing tenant row keeps meaning what it meant — the
-- defaults are the homepage ROI calculator's numbers, which is what those
-- tenants were quoted before this column existed.
--
-- ── DATED 2000, AFTER EVERYTHING IT TOUCHES ─────────────────────────────────
-- Filenames here are hand-written and apply in lexical order, so a migration
-- can easily sort before the one that creates a table it alters. Checked
-- against every table this file names:
--
--   "tenants"          0_init
--   "revenue_rollups"  created here
--
-- and against the tables the FEATURE reads but this file does not touch,
-- because the worker will fail at run time if they are absent:
--
--   "ai_visits"      20260814090000_ai_lead_attribution
--   "sov_snapshots"  20260814120000_ai_share_of_voice
--
-- The latest migration in the tree when this was written was
-- 20260815190000_credit_packs, so 2000 sorts last.
--
-- ── TABLE NAMES ARE @@map NAMES, NOT MODEL NAMES ────────────────────────────
-- This schema mixes conventions — "ScanRow" maps to "scan_rows" while
-- "SeoApiCall" maps to nothing and really is "SeoApiCall". Every identifier
-- below was read off the model's @@map, not guessed. Column names on "tenants"
-- are unmapped camelCase, matching the majority of that model, so they are
-- quoted.
--
-- ── EVERY STATEMENT IS GUARDED ──────────────────────────────────────────────
-- IF NOT EXISTS throughout, DO blocks for the two things Postgres gives no such
-- clause: CREATE TYPE and ADD CONSTRAINT. A half-applied run re-applies as a
-- no-op instead of needing the surviving objects dropped by hand.

-- CreateEnum
-- How credit for one lead is spread across the assistants that touched it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RevenueAttributionModel') THEN
    CREATE TYPE "RevenueAttributionModel" AS ENUM (
      'first',
      'last',
      'influenced',
      'linear'
    );
  END IF;
END
$$;

-- CreateEnum
-- Where a month's leads came from. Part of a rollup row's identity: a tenant
-- that gains AiConversion rows mid-run flips proxy -> measured, and that must
-- write a NEW parallel row rather than restate a number somebody already read.
--
-- Nothing writes 'measured' today. It binds to AiConversion (attribution P2),
-- which has not shipped. FunnelLead is deliberately not a measured source —
-- it carries no source, no visitorId and no referrer, and there is no join key
-- between it and "ai_visits".
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RevenueLeadMode') THEN
    CREATE TYPE "RevenueLeadMode" AS ENUM (
      'measured',
      'proxy'
    );
  END IF;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "revenue_rollups" (
    "id"             TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    -- UTC calendar month, "YYYY-MM". A 7-character string rather than a DATE
    -- pinned to the 1st: this is a month, and a date column invites somebody to
    -- write a day into it and then range-query a key that is not one.
    "month"          VARCHAR(7) NOT NULL,
    "model"          "RevenueAttributionModel" NOT NULL,
    "mode"           "RevenueLeadMode" NOT NULL,
    "wonRevenue"     DOUBLE PRECISION NOT NULL,
    "lostRevenueEst" DOUBLE PRECISION NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_rollups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The nightly writer's upsert target. THE MODE IS IN THE KEY, deliberately:
-- without it, a mode flip would overwrite the proxy figure a customer may
-- already have screenshotted into a client report.
CREATE UNIQUE INDEX IF NOT EXISTS "revenue_rollups_tenantId_month_model_mode_key"
  ON "revenue_rollups" ("tenantId", "month", "model", "mode");

-- CreateIndex
-- The page read: this tenant's months, newest first.
CREATE INDEX IF NOT EXISTS "revenue_rollups_tenantId_month_idx"
  ON "revenue_rollups" ("tenantId", "month" DESC);

-- AddForeignKey
-- ADD CONSTRAINT has no IF NOT EXISTS, so this is a catalog check. Named
-- exactly as Prisma would name it, so a later `migrate diff` sees no drift.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'revenue_rollups_tenantId_fkey'
  ) THEN
    ALTER TABLE "revenue_rollups"
      ADD CONSTRAINT "revenue_rollups_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- AlterTable
-- The two revenue assumptions, editable on /settings/account. Stored per tenant
-- rather than inferred because nobody can infer them: we see visits, never
-- sales. Defaults are the homepage ROI calculator's, so a tenant who never
-- opens the settings page gets the arithmetic the marketing site quoted them.
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "convRate" DOUBLE PRECISION NOT NULL DEFAULT 0.30;

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "avgSaleValue" DOUBLE PRECISION NOT NULL DEFAULT 450;

-- Bounds, as a backstop under the validation in src/lib/account-validation.ts.
-- Prisma does not model CHECK constraints, so these are invisible to the client
-- and to `migrate diff` — they exist to stop a future code path that skips the
-- validator from writing a convRate of 0, which would make `won` identically
-- zero and look like a data outage rather than a bad input.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_convRate_check'
  ) THEN
    ALTER TABLE "tenants"
      ADD CONSTRAINT "tenants_convRate_check"
      CHECK ("convRate" > 0 AND "convRate" <= 1);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_avgSaleValue_check'
  ) THEN
    ALTER TABLE "tenants"
      ADD CONSTRAINT "tenants_avgSaleValue_check"
      CHECK ("avgSaleValue" > 0);
  END IF;
END
$$;
