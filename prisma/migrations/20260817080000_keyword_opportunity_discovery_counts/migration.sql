-- Keyword Opportunity Finder: how many keywords discovery found, and how many
-- the brand filter removed.
--
-- ADDITIVE ONLY. Two nullable-by-default integer columns on an existing table.
-- Nothing is dropped, renamed or retyped; every existing row keeps its meaning
-- and picks up 0/0, which is correct for rows written before the counts were
-- recorded (we did not measure it, and 0 is what "not measured" looked like
-- then — no row written before this migration is rendered with the empty state
-- these columns feed, because that state requires COMPLETED with zero
-- opportunities, which the old code could not produce).
--
-- ── DATED 20260817080000, AFTER THE TABLE IT ALTERS ─────────────────────────
--   "keyword_opportunity_analyses"  20260817060000_keyword_opportunity_finder
--
-- The latest migration in the tree when this was written was
-- 20260817060000_keyword_opportunity_finder, so 20260817080000 sorts last.
--
-- ── WHY THESE ARE COLUMNS AND NOT DERIVED ───────────────────────────────────
-- keywordCount is post-filter AND post-cut. discoveredCount is pre-filter.
-- They coincide only when the working set is empty, which is exactly the case
-- that needs to tell the customer both numbers.

-- AlterTable
ALTER TABLE "keyword_opportunity_analyses"
  ADD COLUMN "discoveredCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "brandedCount"    INTEGER NOT NULL DEFAULT 0;
