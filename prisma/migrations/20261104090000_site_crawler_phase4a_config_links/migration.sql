-- Site Crawler Phase 4a: crawl configuration, list mode, link graph, redirect
-- chains, sitemap inputs, retention, per-site defaults and verification.
-- Generated with `prisma migrate diff --from-schema <pre-4a> --to-schema
-- prisma/schema.prisma --script`, then guarded so a retried deploy is a no-op.
-- Applied by `prisma migrate deploy` (sudo echorank360-deploy), never by hand.
-- Additive only: pre-4a crawls read as spider mode, default config, unpinned.

ALTER TABLE "crawl_jobs"
  ADD COLUMN IF NOT EXISTS "config" JSONB,
  ADD COLUMN IF NOT EXISTS "dataPurgedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'spider',
  ADD COLUMN IF NOT EXISTS "pinned" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "crawl_pages"
  ADD COLUMN IF NOT EXISTS "foundOn" TEXT,
  ADD COLUMN IF NOT EXISTS "imgSrcs" TEXT[],
  ADD COLUMN IF NOT EXISTS "lastModified" TEXT,
  ADD COLUMN IF NOT EXISTS "parentPageId" TEXT,
  ADD COLUMN IF NOT EXISTS "redirectChain" JSONB;

CREATE TABLE IF NOT EXISTS "crawl_links" (
    "id" TEXT NOT NULL,
    "crawlJobId" TEXT NOT NULL,
    "fromPageId" TEXT NOT NULL,
    "toPageId" TEXT,
    "toUrl" TEXT NOT NULL,
    "anchor" TEXT,
    "nofollow" BOOLEAN NOT NULL DEFAULT false,
    "position" SMALLINT NOT NULL,

    CONSTRAINT "crawl_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "crawl_site_defaults" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "config" JSONB,
    "verifyToken" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "verifyMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crawl_site_defaults_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "crawl_links_crawlJobId_toPageId_idx" ON "crawl_links"("crawlJobId", "toPageId");
CREATE INDEX IF NOT EXISTS "crawl_links_crawlJobId_fromPageId_idx" ON "crawl_links"("crawlJobId", "fromPageId");
CREATE UNIQUE INDEX IF NOT EXISTS "crawl_site_defaults_tenantId_host_key" ON "crawl_site_defaults"("tenantId", "host");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crawl_links_crawlJobId_fkey') THEN
    ALTER TABLE "crawl_links" ADD CONSTRAINT "crawl_links_crawlJobId_fkey"
      FOREIGN KEY ("crawlJobId") REFERENCES "crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crawl_links_fromPageId_fkey') THEN
    ALTER TABLE "crawl_links" ADD CONSTRAINT "crawl_links_fromPageId_fkey"
      FOREIGN KEY ("fromPageId") REFERENCES "crawl_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crawl_site_defaults_tenantId_fkey') THEN
    ALTER TABLE "crawl_site_defaults" ADD CONSTRAINT "crawl_site_defaults_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
