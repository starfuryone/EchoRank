-- Entity classification stored beside the raw competitor mention.
--
-- Fully additive. `classification` is NULLABLE rather than defaulted to RIVAL:
-- every row written before the classifier existed is honestly "not yet judged",
-- and defaulting it to RIVAL would assert that ChatGPT and Google Search
-- Console are competitors of an AI-visibility product -- the exact error the
-- classifier exists to remove.
--
-- Nothing is deleted or rewritten. A classification is a lens over an
-- observation, so re-judging after a rule change is a re-run of a pure function
-- over these rows rather than a re-run of the provider calls that produced them.

-- CreateEnum
CREATE TYPE "EntityClass" AS ENUM ('RIVAL', 'PLATFORM', 'GENERIC');

-- AlterTable
ALTER TABLE "competitor_mentions" ADD COLUMN     "classification" "EntityClass",
ADD COLUMN     "classificationTrace" JSONB,
ADD COLUMN     "classifierVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "competitor_mentions_tenantId_classification_createdAt_idx" ON "competitor_mentions"("tenantId", "classification", "createdAt");
