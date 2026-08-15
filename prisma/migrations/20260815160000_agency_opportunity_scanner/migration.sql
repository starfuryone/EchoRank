-- CreateEnum
CREATE TYPE "ScanRowStatus" AS ENUM ('queued', 'running', 'done', 'failed');

-- CreateEnum
CREATE TYPE "ScanBatchStatus" AS ENUM ('running', 'complete');

-- CreateTable
CREATE TABLE "scan_batches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "ScanBatchStatus" NOT NULL DEFAULT 'running',
    "total" INTEGER NOT NULL,
    "done" INTEGER NOT NULL DEFAULT 0,
    "placesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "scan_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_rows" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "score" INTEGER,
    "grade" CHAR(1),
    "topGaps" JSONB,
    "place" JSONB,
    "status" "ScanRowStatus" NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "scan_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scan_batches_tenantId_createdAt_idx" ON "scan_batches"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "scan_rows_batchId_grade_idx" ON "scan_rows"("batchId", "grade");

-- CreateIndex
CREATE UNIQUE INDEX "scan_rows_batchId_domain_key" ON "scan_rows"("batchId", "domain");

-- AddForeignKey
ALTER TABLE "scan_batches" ADD CONSTRAINT "scan_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_rows" ADD CONSTRAINT "scan_rows_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "scan_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

