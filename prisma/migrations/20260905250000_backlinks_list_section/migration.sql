-- The Full tier's individual-links table, stored alongside the other sections.
--
-- ADDITIVE ONLY: one nullable column. Every existing row keeps meaning what it
-- meant — NULL there is "this analysis has no link list", which is true of
-- every analysis written before the Full tier existed.
--
-- APPLIED BY HAND (docs/agents/BLOCKERS.md):
--   psql "$DATABASE_URL" -f prisma/migrations/20260905250000_backlinks_list_section/migration.sql
--   npx prisma migrate resolve --applied 20260905250000_backlinks_list_section

ALTER TABLE "BacklinksAnalysis" ADD COLUMN IF NOT EXISTS "list" JSONB;
