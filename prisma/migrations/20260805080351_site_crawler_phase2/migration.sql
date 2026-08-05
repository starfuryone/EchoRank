-- AlterTable
ALTER TABLE "crawl_jobs" ADD COLUMN     "summary" JSONB;

-- AlterTable
ALTER TABLE "crawl_pages" ADD COLUMN     "inSitemap" BOOLEAN,
ADD COLUMN     "inlinkCount" INTEGER;

