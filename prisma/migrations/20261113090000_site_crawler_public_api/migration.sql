-- Phase 3d-A, public crawl API: crawl_jobs.callbackUrl (https, SSRF-guarded at
-- start and at delivery) and crawl_jobs.apiKeyId (the key that started the
-- crawl; its secret hash signs the callback). Plain nullable columns, no FK.
-- Guarded so a retried deploy is a no-op. Applied by `prisma migrate deploy`
-- (sudo echorank360-deploy), never by hand. Additive.

ALTER TABLE "crawl_jobs" ADD COLUMN IF NOT EXISTS "callbackUrl" TEXT;
ALTER TABLE "crawl_jobs" ADD COLUMN IF NOT EXISTS "apiKeyId" TEXT;
