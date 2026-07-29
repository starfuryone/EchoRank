-- CreateTable
CREATE TABLE "LighthouseAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "opportunities" JSONB NOT NULL,
    "crux" JSONB,
    "lighthouseVersion" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LighthouseAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LighthouseAudit_tenantId_url_strategy_fetchedAt_idx" ON "LighthouseAudit"("tenantId", "url", "strategy", "fetchedAt");

-- CreateIndex
CREATE INDEX "LighthouseAudit_tenantId_fetchedAt_idx" ON "LighthouseAudit"("tenantId", "fetchedAt");
