-- The score that ordered the setup wizard's suggestions.
--
-- Nullable and additive: a prompt the user typed themselves was never ranked
-- against anything and correctly has none, and the 2 rows that predate the
-- wizard keep meaning what they meant.
--
-- Named suggestionScore rather than importanceScore because tracked_prompts
-- already has importanceWeight, a customer-set multiplier on the prompt's
-- contribution to the rolled-up visibility score. Two importance* fields on one
-- row is a misread waiting to happen.

-- AlterTable
ALTER TABLE "tracked_prompts" ADD COLUMN     "suggestionScore" INTEGER;
