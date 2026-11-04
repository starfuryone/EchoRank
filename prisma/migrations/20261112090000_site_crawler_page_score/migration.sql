-- Crawler Pages view: crawl_pages.pageScore (0-100, 100 - weighted findings on the page,
-- the site health weights), issueTotal and issueHigh, written in the summary pass so the
-- table can sort on them. Guarded so a retried deploy is a no-op. Applied by
-- `prisma migrate deploy` (sudo echorank360-deploy), never by hand. Additive: three
-- nullable columns; crawls from before this stay null until re-tallied.

ALTER TABLE "crawl_pages" ADD COLUMN IF NOT EXISTS "pageScore" SMALLINT;
ALTER TABLE "crawl_pages" ADD COLUMN IF NOT EXISTS "issueTotal" INTEGER;
ALTER TABLE "crawl_pages" ADD COLUMN IF NOT EXISTS "issueHigh" INTEGER;
