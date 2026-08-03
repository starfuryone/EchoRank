-- CreateTable
CREATE TABLE "page_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_snapshots_tenantId_url_capturedAt_idx" ON "page_snapshots"("tenantId", "url", "capturedAt");

-- CreateIndex
CREATE INDEX "page_snapshots_tenantId_contentHash_idx" ON "page_snapshots"("tenantId", "contentHash");

