-- Data-protection complaints (src/lib/privacy/complaints.ts).
CREATE TYPE "ComplaintStatus" AS ENUM ('RECEIVED', 'IN_PROGRESS', 'ANSWERED');

CREATE TABLE "privacy_complaints" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "details" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'RECEIVED',
    "acknowledgedAt" TIMESTAMP(3),
    "inProgressAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "answerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privacy_complaints_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "privacy_complaints_reference_key" ON "privacy_complaints"("reference");
CREATE INDEX "privacy_complaints_status_createdAt_idx" ON "privacy_complaints"("status", "createdAt");
