-- Prepaid Places-lookup credits.
--
-- ADDITIVE ONLY. One new table, one new enum, one new defaulted column on an
-- existing one. Nothing is dropped, renamed or retyped, so `migrate deploy`
-- needs no window and every existing "SeoApiCall" row keeps meaning what it
-- meant — creditFunded defaults false, which is the truth for all of them.

-- CreateEnum

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
ALTER TABLE "credit_ledger"
  ADD CONSTRAINT "credit_ledger_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

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
