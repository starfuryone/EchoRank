-- Site Crawler Phase 4b: custom extraction, custom search, segmentation.
-- Generated with `prisma migrate diff --from-schema <pre-4b> --to-schema
-- prisma/schema.prisma --script`, then guarded so a retried deploy is a no-op.
-- Applied by `prisma migrate deploy` (sudo echorank360-deploy), never by hand.
-- Additive and nullable only: pre-4b pages read as no search hits, no segments.
-- Retention: crawl_extractions go with their page (nightly crawl retention,
-- FK cascade); crawl_segments go with their tenant (FK cascade).

ALTER TABLE "crawl_pages"
  ADD COLUMN IF NOT EXISTS "searchHits" JSONB,
  ADD COLUMN IF NOT EXISTS "segmentIds" SMALLINT[];

CREATE TABLE IF NOT EXISTS "crawl_extractions" (
    "id" TEXT NOT NULL,
    "crawlJobId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "extractorIndex" SMALLINT NOT NULL,
    "values" TEXT[],

    CONSTRAINT "crawl_extractions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "crawl_segments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rule" JSONB NOT NULL,
    "position" SMALLINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crawl_segments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "crawl_extractions_crawlJobId_extractorIndex_idx" ON "crawl_extractions"("crawlJobId", "extractorIndex");
CREATE UNIQUE INDEX IF NOT EXISTS "crawl_extractions_pageId_extractorIndex_key" ON "crawl_extractions"("pageId", "extractorIndex");
CREATE UNIQUE INDEX IF NOT EXISTS "crawl_segments_tenantId_host_position_key" ON "crawl_segments"("tenantId", "host", "position");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crawl_extractions_crawlJobId_fkey') THEN
    ALTER TABLE "crawl_extractions" ADD CONSTRAINT "crawl_extractions_crawlJobId_fkey"
      FOREIGN KEY ("crawlJobId") REFERENCES "crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crawl_extractions_pageId_fkey') THEN
    ALTER TABLE "crawl_extractions" ADD CONSTRAINT "crawl_extractions_pageId_fkey"
      FOREIGN KEY ("pageId") REFERENCES "crawl_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crawl_segments_tenantId_fkey') THEN
    ALTER TABLE "crawl_segments" ADD CONSTRAINT "crawl_segments_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
