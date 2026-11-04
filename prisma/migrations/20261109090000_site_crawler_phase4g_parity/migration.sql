-- Site Crawler Phase 4g: external links, Link Score, semantic duplicates, URL Inspection.
-- Generated with `prisma migrate diff --from-schema <pre-4g> --to-schema
-- prisma/schema.prisma --script`, then guarded so a retried deploy is a no-op.
-- Applied by `prisma migrate deploy` (sudo echorank360-deploy), never by hand.
-- Additive only: two crawl_links columns and an index, two crawl_pages
-- columns, one enum value. Retention: all of it goes with the crawl's pages
-- and links (nightly crawl retention, batched; FK cascade). The index is
-- built inline: crawl_links holds only the kept crawls' edges.

ALTER TYPE "CrawlMetricSource" ADD VALUE IF NOT EXISTS 'gsc_inspection';

ALTER TABLE "crawl_pages"
  ADD COLUMN IF NOT EXISTS "embedding" BYTEA,
  ADD COLUMN IF NOT EXISTS "linkScore" REAL;

ALTER TABLE "crawl_links"
  ADD COLUMN IF NOT EXISTS "isExternal" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "status" SMALLINT;

CREATE INDEX IF NOT EXISTS "crawl_links_crawlJobId_isExternal_toUrl_idx" ON "crawl_links"("crawlJobId", "isExternal", "toUrl");
