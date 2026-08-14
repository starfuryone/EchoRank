-- Citation Opportunity Engine: the get-listed worklist derived from `sources`.
--
-- PURELY ADDITIVE. Two new enums, one new table, no ALTER of anything that
-- exists. `sources` is read by the weekly job and never written by it, and
-- `citations` is not touched at all — in particular Citation.sourceId, the
-- rollup's watermark, is neither read nor stamped here, so this feature cannot
-- interfere with the Citation Finder aggregator's idempotency.
--
-- The table is keyed (tenantId, domain), one grain coarser than
-- sources(brandProfileId, domain). Getting listed on a domain is one job per
-- tenant however many brand profiles it tracks; the job aggregates up to this
-- grain before writing.

-- CreateEnum
CREATE TYPE "OpportunityEffort" AS ENUM ('LOW', 'MED', 'HIGH');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'DISMISSED');

-- CreateTable
CREATE TABLE "citation_opportunities" (
  "id"        TEXT                NOT NULL,
  "tenantId"  TEXT                NOT NULL,
  "domain"    TEXT                NOT NULL,
  "impact"    DOUBLE PRECISION    NOT NULL,
  "priority"  DOUBLE PRECISION    NOT NULL,
  "effort"    "OpportunityEffort" NOT NULL,
  "kind"      "CitationKind"      NOT NULL DEFAULT 'OTHER',
  "howTo"     TEXT                NOT NULL,
  "theme"     TEXT,
  "status"    "OpportunityStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)        NOT NULL,

  CONSTRAINT "citation_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The upsert key AND the tenant-isolation guarantee: every write goes through
-- (tenantId, domain), so a domain harvested from another tenant cannot collide.
CREATE UNIQUE INDEX "citation_opportunities_tenantId_domain_key"
  ON "citation_opportunities" ("tenantId", "domain");

-- CreateIndex
-- The worklist's only order. Priority DESC because the whole product is "do the
-- top one first"; a tenant with hundreds of rows must not sort them in memory.
CREATE INDEX "citation_opportunities_tenantId_priority_idx"
  ON "citation_opportunities" ("tenantId", "priority" DESC);

-- AddForeignKey
ALTER TABLE "citation_opportunities"
  ADD CONSTRAINT "citation_opportunities_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
