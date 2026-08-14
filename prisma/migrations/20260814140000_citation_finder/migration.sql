-- Citation Finder: the domain rollup behind /visibility/tools/citation-finder.
--
-- ADDITIVE ONLY. `sources` already existed — schema'd for an aggregator that was
-- never built, so the table has no writer and (verified before this migration)
-- no reader in application code either. This revives it rather than standing up
-- a second domain rollup beside it. Nothing here drops, renames or retypes an
-- existing column, so a row written by whatever put data there originally keeps
-- meaning exactly what it meant.
--
-- Every added column carries a DEFAULT, so the ALTER does not rewrite the table
-- and existing rows land on the honest value: no engines observed yet, no
-- rivals observed yet, kind not yet classified.

-- CreateEnum
CREATE TYPE "CitationKind" AS ENUM (
  'DIRECTORY',
  'REVIEW_SITE',
  'NEWS',
  'BLOG',
  'GOV',
  'SOCIAL',
  'OTHER'
);

-- AlterTable
ALTER TABLE "sources"
  ADD COLUMN "enginesSeen"      JSONB          NOT NULL DEFAULT '{}',
  ADD COLUMN "citesCompetitors" JSONB          NOT NULL DEFAULT '{}',
  ADD COLUMN "kind"             "CitationKind" NOT NULL DEFAULT 'OTHER';

-- CreateIndex
-- The tool's default sort. `sources_brandProfileId_influenceScore_idx` cannot
-- serve it: this feature never writes influenceScore, so every row it creates
-- would tie at 0.
CREATE INDEX "sources_brandProfileId_citationCount_idx"
  ON "sources" ("brandProfileId", "citationCount" DESC);
