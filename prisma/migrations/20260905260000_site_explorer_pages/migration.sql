-- Site Explorer's Pages tab: which pages on a domain earn the organic traffic.
--
-- ADDITIVE ONLY: one nullable column. Every existing row keeps meaning what it
-- meant — NULL is "this analysis predates the Pages tab", not "this domain has
-- no pages".
--
-- APPLIED BY HAND (docs/agents/BLOCKERS.md):
--   psql "$DATABASE_URL" -f prisma/migrations/20260905260000_site_explorer_pages/migration.sql
--   npx prisma migrate resolve --applied 20260905260000_site_explorer_pages

ALTER TABLE "SiteExplorerAnalysis" ADD COLUMN IF NOT EXISTS "pages" JSONB;
