-- Site Crawler Phase 4e: AMP, custom JavaScript, AI prompts, forms login.
-- Generated with `prisma migrate diff --from-schema <pre-4e> --to-schema
-- prisma/schema.prisma --script`, then guarded and reordered so a retried
-- deploy is a no-op and the old unique index is dropped only after its
-- replacement exists. Applied by `prisma migrate deploy` (sudo
-- echorank360-deploy), never by hand.
-- Additive: two enums, one table, five nullable/defaulted columns. The one
-- index swap widens crawl_extractions' key from (pageId, extractorIndex) to
-- (pageId, kind, extractorIndex); every existing row is kind 'extract'.
-- Retention: tenant_ai_keys go with the tenant or when the tenant deletes the
-- key; crawl_extractions (all kinds) go with their page; the login and
-- jsSnippets columns go with the site's defaults. Login cookies are never
-- stored here: Redis, for the crawl, with a TTL.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CrawlExtractionKind') THEN
    CREATE TYPE "CrawlExtractionKind" AS ENUM ('extract', 'js', 'ai');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AiKeyProvider') THEN
    CREATE TYPE "AiKeyProvider" AS ENUM ('openai', 'gemini');
  END IF;
END $$;

ALTER TABLE "crawl_pages"
  ADD COLUMN IF NOT EXISTS "ampHtml" TEXT,
  ADD COLUMN IF NOT EXISTS "isAmp" BOOLEAN;

ALTER TABLE "crawl_site_defaults"
  ADD COLUMN IF NOT EXISTS "jsSnippets" JSONB,
  ADD COLUMN IF NOT EXISTS "login" JSONB;

ALTER TABLE "crawl_extractions"
  ADD COLUMN IF NOT EXISTS "kind" "CrawlExtractionKind" NOT NULL DEFAULT 'extract';

CREATE INDEX IF NOT EXISTS "crawl_extractions_crawlJobId_kind_extractorIndex_idx" ON "crawl_extractions"("crawlJobId", "kind", "extractorIndex");
CREATE UNIQUE INDEX IF NOT EXISTS "crawl_extractions_pageId_kind_extractorIndex_key" ON "crawl_extractions"("pageId", "kind", "extractorIndex");
DROP INDEX IF EXISTS "crawl_extractions_crawlJobId_extractorIndex_idx";
DROP INDEX IF EXISTS "crawl_extractions_pageId_extractorIndex_key";

CREATE TABLE IF NOT EXISTS "tenant_ai_keys" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "AiKeyProvider" NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "tenant_ai_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_ai_keys_tenantId_provider_key" ON "tenant_ai_keys"("tenantId", "provider");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_ai_keys_tenantId_fkey') THEN
    ALTER TABLE "tenant_ai_keys" ADD CONSTRAINT "tenant_ai_keys_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
