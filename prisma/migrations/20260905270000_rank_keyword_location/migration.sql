-- City-scoped rank tracking: an optional location per tracked keyword.
--
-- ADDITIVE ONLY: two nullable columns. NULL means "inherit the project's
-- country", which is exactly what every existing row does today, so no
-- backfill is needed and no existing tracker changes behaviour.
--
-- APPLIED BY HAND (docs/agents/BLOCKERS.md):
--   psql "$DATABASE_URL" -f prisma/migrations/20260905270000_rank_keyword_location/migration.sql
--   npx prisma migrate resolve --applied 20260905270000_rank_keyword_location

ALTER TABLE "RankKeyword" ADD COLUMN IF NOT EXISTS "locationName" TEXT;
ALTER TABLE "RankKeyword" ADD COLUMN IF NOT EXISTS "locationCode" INTEGER;
