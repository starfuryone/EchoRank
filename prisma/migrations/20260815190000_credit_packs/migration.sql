-- Prepaid Places-lookup credits.
--
-- ADDITIVE ONLY. One new table, one new enum, two new defaulted columns on
-- existing ones. Nothing is dropped, renamed or retyped, so `migrate deploy`
-- needs no window and every existing "SeoApiCall" and "scan_rows" row keeps
-- meaning what it meant — both new columns default false, which is the truth
-- for all of them.
--
-- ── DATED 1900, AFTER THE SCANNER ───────────────────────────────────────────
-- This was originally 20260815130000, which sorted BEFORE
-- 20260815160000_agency_opportunity_scanner — the migration that CREATES
-- "scan_rows", which the last statement here alters. That ordering works on a
-- database where the scanner already shipped and breaks on a fresh one, which
-- is exactly the case that only shows up when someone rebuilds from git. Renamed
-- rather than left to be discovered then.
--
-- ── EVERY STATEMENT IS GUARDED ──────────────────────────────────────────────
-- An earlier run of this migration applied the enum, the table, its indexes and
-- its foreign key, then failed on a wrong table name for "SeoApiCall". The
-- guards make re-applying safe rather than requiring the surviving objects to be
-- dropped by hand first; the foreign key is omitted entirely because it landed.
-- If this is ever run against a database that has NEVER seen it, the FK will be
-- missing — recreate it with:
--
--   ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_tenantId_fkey"
--     FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
--     ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
-- Postgres has no CREATE TYPE ... IF NOT EXISTS, so the guard is a DO block.
-- It has to exist before the table below, whose `reason` column is of this
-- type — a migration that creates the table without it fails outright.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CreditReason') THEN
    CREATE TYPE "CreditReason" AS ENUM (
      'PURCHASE',
      'RESERVE',
      'CONSUME_RELEASE',
      'REFUND',
      'ADMIN'
    );
  END IF;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "credit_ledger" (
    "id"        TEXT NOT NULL,
    "tenantId"  TEXT NOT NULL,
    "delta"     INTEGER NOT NULL,
    "reason"    "CreditReason" NOT NULL,
    "ref"       TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The idempotency constraint every writer retries against: one PURCHASE per
-- Stripe session, one RESERVE per batch, one CONSUME_RELEASE per batch.
CREATE UNIQUE INDEX IF NOT EXISTS "credit_ledger_tenantId_reason_ref_key"
  ON "credit_ledger" ("tenantId", "reason", "ref");

-- CreateIndex
-- Serves both the SUM(delta) balance and the /billing history list.
CREATE INDEX IF NOT EXISTS "credit_ledger_tenantId_createdAt_idx"
  ON "credit_ledger" ("tenantId", "createdAt" DESC);

-- AddForeignKey
-- FK already applied in the first (partial) run; removed for re-apply.


-- AlterTable
-- Credit-funded calls bypass the monthly USD cap but still record what the
-- upstream actually charged us, so the cap's denominator stays honest.
ALTER TABLE "SeoApiCall"
  ADD COLUMN IF NOT EXISTS "creditFunded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
-- Whether a row's Places lookup was billed. Distinct from "did it find a
-- listing" — a search that returns nothing is still a search Google charged
-- for. The completion release counts these and refunds the remainder of the
-- batch's hold. Defaults false, which is correct for every historical row:
-- credits did not exist when they ran, so none of them were credit-funded.
ALTER TABLE "scan_rows"
  ADD COLUMN IF NOT EXISTS "placesCharged" BOOLEAN NOT NULL DEFAULT false;
