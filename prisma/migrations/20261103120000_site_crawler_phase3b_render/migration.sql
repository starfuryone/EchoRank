-- Site Crawler Phase 3b: render mode.
-- Generated with `prisma migrate diff --from-schema <pre-3b> --to-schema
-- prisma/schema.prisma --script`, then guarded so a retried deploy is a no-op.
-- Applied by `prisma migrate deploy` (sudo echorank360-deploy), never by hand.
-- Additive only: every existing job reads as renderMode 'none', 0 rendered.

ALTER TABLE "crawl_jobs"
  ADD COLUMN IF NOT EXISTS "pagesRendered" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "renderCap" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "renderMode" TEXT NOT NULL DEFAULT 'none';

ALTER TABLE "crawl_pages"
  ADD COLUMN IF NOT EXISTS "axeViolations" JSONB,
  ADD COLUMN IF NOT EXISTS "consoleErrors" INTEGER,
  ADD COLUMN IF NOT EXISTS "jsOnly" JSONB,
  ADD COLUMN IF NOT EXISTS "renderedLinkCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "renderedWordCount" INTEGER;
