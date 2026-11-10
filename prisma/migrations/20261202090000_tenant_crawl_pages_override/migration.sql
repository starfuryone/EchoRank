-- Nosy Bat monthly page allowance: a per-tenant pages-per-month figure set
-- only by staff in /admin/crawl-overrides (an Enterprise contract). Null = the
-- plan's crawlPagesPerMonth (plan-config.ts). Read by
-- src/lib/site-crawler/page-allowance.ts. Hand-written, additive, guarded so a
-- retried deploy is a no-op. Applied by `prisma migrate deploy` (sudo
-- echorank360-deploy), never by hand.

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "crawlPagesPerMonthOverride" INTEGER;
