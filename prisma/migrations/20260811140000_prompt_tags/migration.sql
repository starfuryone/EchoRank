-- User-applied labels on a tracked prompt.
--
-- Additive with a default, so every existing row reads as untagged.

-- AlterTable
ALTER TABLE "tracked_prompts" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
