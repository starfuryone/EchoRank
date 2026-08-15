-- AI Competitor Reverse Engineer: the "why are they winning?" report.
--
-- PURELY ADDITIVE. One new table, no enum, no ALTER of anything that exists.
-- Every input this feature reads — sov_snapshots, sources, citation_opportunities,
-- "Competitor", "SeoApiCall" — is read-only to it, so the feature cannot
-- interfere with the nightly SOV rollup, the citation aggregator's sourceId
-- watermark, or the weekly opportunity sweep.
--
-- APPENDED, NOT UPSERTED. There is deliberately no unique key on
-- (tenantId, rivalDomain): the 7-day re-run window is served by reading the
-- newest row for a rival and checking its age, and keeping the older rows is
-- what makes "has the gap moved?" answerable. Each row also cost real money to
-- produce (~$0.09 of DataForSEO + Places), so overwriting one is discarding a
-- paid-for observation.

-- CreateTable
CREATE TABLE "explain_reports" (
  "id"             TEXT           NOT NULL,
  "tenantId"       TEXT           NOT NULL,
  "rivalDomain"    TEXT           NOT NULL,
  "rivalName"      TEXT           NOT NULL,
  "brandProfileId" TEXT           NOT NULL,
  "factors"        JSONB          NOT NULL,
  "costUsd"        DECIMAL(10, 6) NOT NULL,
  "createdAt"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "explain_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The only read this table serves: newest report for one rival, one tenant.
-- Covers both the report-view fetch and the staleness check that decides
-- whether a re-run is allowed, so neither needs a sort.
CREATE INDEX "explain_reports_tenantId_rivalDomain_createdAt_idx"
  ON "explain_reports" ("tenantId", "rivalDomain", "createdAt" DESC);

-- AddForeignKey
-- Cascade matches every other tenant-scoped table here: deleting a tenant
-- takes its reports with it.
ALTER TABLE "explain_reports"
  ADD CONSTRAINT "explain_reports_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
