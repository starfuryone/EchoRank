-- Account / workspace deletion requests with a 14-day grace period (src/lib/privacy/deletion.ts).
CREATE TYPE "DeletionScope" AS ENUM ('WORKSPACE', 'USER');
CREATE TYPE "DeletionStatus" AS ENUM ('PENDING', 'CANCELLED', 'COMPLETED', 'FAILED');

CREATE TABLE "data_deletion_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tenantId" TEXT,
    "subjectHash" TEXT NOT NULL,
    "scope" "DeletionScope" NOT NULL,
    "status" "DeletionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "runAfter" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "summary" JSONB,
    "error" TEXT,

    CONSTRAINT "data_deletion_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "data_deletion_requests_status_runAfter_idx" ON "data_deletion_requests"("status", "runAfter");
CREATE INDEX "data_deletion_requests_userId_idx" ON "data_deletion_requests"("userId");
