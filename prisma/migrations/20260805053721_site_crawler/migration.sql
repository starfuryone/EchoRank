-- CreateEnum
CREATE TYPE "CrawlStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "crawl_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rootUrl" TEXT NOT NULL,
    "status" "CrawlStatus" NOT NULL DEFAULT 'QUEUED',
    "urlCap" INTEGER NOT NULL,
    "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
    "issueCount" INTEGER NOT NULL DEFAULT 0,
    "stoppedReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawl_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_pages" (
    "id" TEXT NOT NULL,
    "crawlJobId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "statusCode" INTEGER,
    "redirectTarget" TEXT,
    "title" TEXT,
    "titleLength" INTEGER,
    "metaDescription" TEXT,
    "metaDescLength" INTEGER,
    "h1Count" INTEGER,
    "canonical" TEXT,
    "metaRobots" TEXT,
    "wordCount" INTEGER,
    "contentHash" TEXT,
    "depth" INTEGER NOT NULL,
    "internalLinks" INTEGER,
    "fetchMs" INTEGER,
    "contentType" TEXT,

    CONSTRAINT "crawl_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_issues" (
    "id" TEXT NOT NULL,
    "crawlPageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "detail" TEXT,

    CONSTRAINT "crawl_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crawl_jobs_tenantId_createdAt_idx" ON "crawl_jobs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "crawl_pages_crawlJobId_idx" ON "crawl_pages"("crawlJobId");

-- CreateIndex
CREATE INDEX "crawl_pages_crawlJobId_contentHash_idx" ON "crawl_pages"("crawlJobId", "contentHash");

-- CreateIndex
CREATE INDEX "crawl_issues_crawlPageId_idx" ON "crawl_issues"("crawlPageId");

-- AddForeignKey
ALTER TABLE "crawl_jobs" ADD CONSTRAINT "crawl_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_pages" ADD CONSTRAINT "crawl_pages_crawlJobId_fkey" FOREIGN KEY ("crawlJobId") REFERENCES "crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_issues" ADD CONSTRAINT "crawl_issues_crawlPageId_fkey" FOREIGN KEY ("crawlPageId") REFERENCES "crawl_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

