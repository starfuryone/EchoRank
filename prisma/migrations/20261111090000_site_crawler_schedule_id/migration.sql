-- Crawler History: crawl_jobs.scheduleId, the CrawlSchedule that started the crawl, so
-- History can label it "Scheduled". A plain nullable column, no FK: deleting the
-- schedule keeps the label. Guarded so a retried deploy is a no-op. Applied by
-- `prisma migrate deploy` (sudo echorank360-deploy), never by hand. Additive.
--
-- Backfill: each schedule's last started crawl (crawl_schedules.lastJobId) is the only
-- earlier link on record; older scheduled crawls stay unlabelled.

ALTER TABLE "crawl_jobs" ADD COLUMN IF NOT EXISTS "scheduleId" TEXT;

UPDATE "crawl_jobs" j
SET "scheduleId" = s."id"
FROM "crawl_schedules" s
WHERE s."lastJobId" = j."id" AND s."tenantId" = j."tenantId" AND j."scheduleId" IS NULL;
