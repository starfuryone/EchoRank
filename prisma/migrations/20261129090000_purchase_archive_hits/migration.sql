-- Purchases not made because the purchase archive already held the same
-- request inside its freshness window (ECHORANK-DATA-ARCHIVE.md Phase 2).
-- Hand-written, additive; applied by the deploy's `prisma migrate deploy`.

-- CreateTable
CREATE TABLE IF NOT EXISTS "purchase_archive_hits" (
    "id" TEXT NOT NULL,
    "archiveId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "tenantId" TEXT,
    "purpose" TEXT NOT NULL,
    "savedUsd" DECIMAL(10,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_archive_hits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_archive_hits_provider_createdAt_idx" ON "purchase_archive_hits"("provider", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "purchase_archive_hits_tenantId_createdAt_idx" ON "purchase_archive_hits"("tenantId", "createdAt");
