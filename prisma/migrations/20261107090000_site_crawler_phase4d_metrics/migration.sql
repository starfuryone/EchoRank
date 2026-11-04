-- Site Crawler Phase 4d: GSC, PSI, GA4 and backlink metrics joined onto crawl rows.
-- Generated with `prisma migrate diff --from-schema <pre-4d> --to-schema
-- prisma/schema.prisma --script`, then guarded so a retried deploy is a no-op.
-- Applied by `prisma migrate deploy` (sudo echorank360-deploy), never by hand.
-- Additive only: one enum, one table, two nullable columns.
-- Retention: crawl_page_metrics go with their page (nightly crawl retention,
-- batched; FK cascade). gsc_connections.ga4Property* go with the connection.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CrawlMetricSource') THEN
    CREATE TYPE "CrawlMetricSource" AS ENUM ('gsc', 'psi', 'ga4', 'backlinks');
  END IF;
END $$;

ALTER TABLE "gsc_connections"
  ADD COLUMN IF NOT EXISTS "ga4PropertyId" TEXT,
  ADD COLUMN IF NOT EXISTS "ga4PropertyName" TEXT;

CREATE TABLE IF NOT EXISTS "crawl_page_metrics" (
    "id" TEXT NOT NULL,
    "crawlJobId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "source" "CrawlMetricSource" NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawl_page_metrics_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "crawl_page_metrics_crawlJobId_source_idx" ON "crawl_page_metrics"("crawlJobId", "source");
CREATE UNIQUE INDEX IF NOT EXISTS "crawl_page_metrics_pageId_source_key" ON "crawl_page_metrics"("pageId", "source");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crawl_page_metrics_crawlJobId_fkey') THEN
    ALTER TABLE "crawl_page_metrics" ADD CONSTRAINT "crawl_page_metrics_crawlJobId_fkey"
      FOREIGN KEY ("crawlJobId") REFERENCES "crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crawl_page_metrics_pageId_fkey') THEN
    ALTER TABLE "crawl_page_metrics" ADD CONSTRAINT "crawl_page_metrics_pageId_fkey"
      FOREIGN KEY ("pageId") REFERENCES "crawl_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
