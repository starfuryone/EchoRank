-- Site Crawler Phase 3a: rule library.
-- Generated with `prisma migrate diff --from-schema <pre-3a> --to-schema
-- prisma/schema.prisma --script`, then guarded so a retried deploy is a no-op.
-- Applied by `prisma migrate deploy` (sudo echorank360-deploy), never by hand.

-- crawl_pages: the stored facts site-scope rules read.
ALTER TABLE "crawl_pages"
  ADD COLUMN IF NOT EXISTS "bytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "canonicalHeader" TEXT,
  ADD COLUMN IF NOT EXISTS "charset" TEXT,
  ADD COLUMN IF NOT EXISTS "externalOutlinks" INTEGER,
  ADD COLUMN IF NOT EXISTS "h1First" TEXT,
  ADD COLUMN IF NOT EXISTS "h2Count" INTEGER,
  ADD COLUMN IF NOT EXISTS "h2First" TEXT,
  ADD COLUMN IF NOT EXISTS "hasViewport" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "hreflang" JSONB,
  ADD COLUMN IF NOT EXISTS "imgCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "imgMissingAltCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "insecureFormCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "jsonLdErrors" INTEGER,
  ADD COLUMN IF NOT EXISTS "jsonLdTypes" TEXT[],
  ADD COLUMN IF NOT EXISTS "langAttr" TEXT,
  ADD COLUMN IF NOT EXISTS "mixedContentCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "nofollowInlinkCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "nofollowOutlinks" INTEGER,
  ADD COLUMN IF NOT EXISTS "noindex" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "relNext" TEXT,
  ADD COLUMN IF NOT EXISTS "relPrev" TEXT,
  ADD COLUMN IF NOT EXISTS "securityHeaders" JSONB,
  ADD COLUMN IF NOT EXISTS "simhash" BIGINT,
  ADD COLUMN IF NOT EXISTS "textRatio" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "xRobotsTag" TEXT;

-- crawl_issues: rule id, kind, priority, evidence, and the job id.
ALTER TABLE "crawl_issues"
  ADD COLUMN IF NOT EXISTS "crawlJobId" TEXT,
  ADD COLUMN IF NOT EXISTS "evidence" JSONB,
  ADD COLUMN IF NOT EXISTS "kind" TEXT,
  ADD COLUMN IF NOT EXISTS "priority" TEXT,
  ADD COLUMN IF NOT EXISTS "ruleId" TEXT;

-- Backfill the job id onto pre-3a rows (the column, not the summary: old
-- summaries are left as they are and computed from crawl_issues on read).
-- Idempotent: only rows still NULL are touched.
UPDATE "crawl_issues" ci
SET "crawlJobId" = cp."crawlJobId"
FROM "crawl_pages" cp
WHERE ci."crawlPageId" = cp."id" AND ci."crawlJobId" IS NULL;

CREATE INDEX IF NOT EXISTS "crawl_pages_crawlJobId_url_idx" ON "crawl_pages"("crawlJobId", "url");
CREATE INDEX IF NOT EXISTS "crawl_issues_crawlJobId_ruleId_idx" ON "crawl_issues"("crawlJobId", "ruleId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crawl_issues_crawlJobId_fkey') THEN
    ALTER TABLE "crawl_issues" ADD CONSTRAINT "crawl_issues_crawlJobId_fkey"
      FOREIGN KEY ("crawlJobId") REFERENCES "crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
