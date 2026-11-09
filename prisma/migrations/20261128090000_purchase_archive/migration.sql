-- The purchase archive's index (ECHORANK-DATA-ARCHIVE.md): one row per
-- purchased provider response kept in the private PURCHASE_ARCHIVE_BUCKET.
-- Hand-written, additive; applied by the deploy's `prisma migrate deploy`.

-- CreateTable
CREATE TABLE IF NOT EXISTS "purchase_archive" (
    "id" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "providerTaskId" TEXT,
    "s3Key" TEXT NOT NULL,
    "costUsd" DECIMAL(10,6),
    "bytes" INTEGER NOT NULL,
    "tenantId" TEXT,
    "purpose" TEXT NOT NULL,
    "personalData" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "storedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_archive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_archive_dedupeKey_key" ON "purchase_archive"("dedupeKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_archive_provider_endpoint_requestHash_createdAt_idx" ON "purchase_archive"("provider", "endpoint", "requestHash", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_archive_tenantId_createdAt_idx" ON "purchase_archive"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_archive_personalData_createdAt_idx" ON "purchase_archive"("personalData", "createdAt");
