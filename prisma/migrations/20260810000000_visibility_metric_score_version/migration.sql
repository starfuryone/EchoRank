-- Which formula produced visibility_metrics.visibilityScore.
--
-- Additive only: a new column with a default, so existing rows are backfilled
-- to 1 (the formula they were written under) without a table rewrite that
-- could restate them. Nothing is dropped and no existing column changes.

-- AlterTable
ALTER TABLE "visibility_metrics" ADD COLUMN     "scoreVersion" INTEGER NOT NULL DEFAULT 1;
