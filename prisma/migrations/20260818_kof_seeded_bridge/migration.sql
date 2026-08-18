-- Seeded analysis mode: the Keyword Explorer -> Opportunity Finder bridge.
--
-- Additive only. Every existing row becomes an explicit discovery run with no
-- seed hash and an empty seed list, which is exactly what it was.

ALTER TABLE "keyword_opportunity_analyses"
  ADD COLUMN "sourceMode" TEXT NOT NULL DEFAULT 'discovery',
  ADD COLUMN "seedHash" TEXT,
  ADD COLUMN "seedKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- The cache probe. Replaces the (domain, dateBucket) pair: a seeded run must
-- never serve from, or populate, the discovery cache, and the seedHash
-- equality filter is what separates them.
DROP INDEX IF EXISTS "keyword_opportunity_analyses_domain_dateBucket_idx";
CREATE INDEX "keyword_opportunity_analyses_domain_dateBucket_seedHash_idx"
  ON "keyword_opportunity_analyses" ("domain", "dateBucket", "seedHash");
