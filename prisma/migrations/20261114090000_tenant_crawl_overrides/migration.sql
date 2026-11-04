-- Phase 3d-A: per-tenant site crawler overrides, set only by staff in
-- /admin/crawl-overrides. Null = the plan's value. Read where the plan caps
-- are: the worker's per-tenant fair share (simultaneous crawls), nightly
-- retention (crawls kept), startCrawl (URLs per crawl). Guarded so a retried
-- deploy is a no-op. Applied by `prisma migrate deploy` (sudo
-- echorank360-deploy), never by hand. Additive: three nullable columns, no data.

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "crawlConcurrencyOverride" INTEGER;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "crawlsKeptOverride" INTEGER;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "crawlUrlCapOverride" INTEGER;
