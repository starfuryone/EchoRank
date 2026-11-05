-- Crawl archive (CRAWL-ARCHIVE.md Phase 3). Additive: one enum, five nullable/defaulted
-- columns on crawl_jobs (ADD COLUMN ... DEFAULT is metadata-only on PG 11+), one index.
-- CreateEnum
CREATE TYPE "CrawlStorageState" AS ENUM ('HOT', 'ARCHIVING', 'ARCHIVED', 'RESTORING');

-- AlterTable
ALTER TABLE "crawl_jobs" ADD COLUMN     "archiveBytes" INTEGER,
ADD COLUMN     "archiveKeyPrefix" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "restoredAt" TIMESTAMP(3),
ADD COLUMN     "storageState" "CrawlStorageState" NOT NULL DEFAULT 'HOT';

-- CreateIndex
CREATE INDEX "crawl_jobs_storageState_idx" ON "crawl_jobs"("storageState");

