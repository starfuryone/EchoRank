-- CreateEnum
CREATE TYPE "VisibilityCadence" AS ENUM ('DAILY', 'WEEKLY');

-- CreateTable
CREATE TABLE "visibility_monitors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "cadence" "VisibilityCadence" NOT NULL DEFAULT 'WEEKLY',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastScore" INTEGER,
    "lastGrade" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visibility_monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visibility_audits" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "monitorId" TEXT,
    "url" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "checks" JSONB NOT NULL,
    "bots" JSONB NOT NULL,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visibility_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visibility_monitors_active_nextRunAt_idx" ON "visibility_monitors"("active", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "visibility_monitors_tenantId_url_key" ON "visibility_monitors"("tenantId", "url");

-- CreateIndex
CREATE INDEX "visibility_audits_tenantId_createdAt_idx" ON "visibility_audits"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "visibility_audits_monitorId_createdAt_idx" ON "visibility_audits"("monitorId", "createdAt");

-- AddForeignKey
ALTER TABLE "visibility_monitors" ADD CONSTRAINT "visibility_monitors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visibility_audits" ADD CONSTRAINT "visibility_audits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visibility_audits" ADD CONSTRAINT "visibility_audits_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "visibility_monitors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

