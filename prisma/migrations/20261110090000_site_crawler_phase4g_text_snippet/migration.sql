-- Site Crawler Phase 4g: crawl_pages.textSnippet, the visible text (<= 6,000 chars) kept
-- during a crawl with AI prompts or semantic duplicates opted in, so those post-crawl
-- steps read it instead of re-fetching. Generated with `prisma migrate diff`, guarded
-- so a retried deploy is a no-op. Applied by `prisma migrate deploy` (sudo
-- echorank360-deploy), never by hand. Additive: one nullable column. Retention: it goes
-- with the page (nightly crawl retention; FK cascade).

ALTER TABLE "crawl_pages" ADD COLUMN IF NOT EXISTS "textSnippet" TEXT;
