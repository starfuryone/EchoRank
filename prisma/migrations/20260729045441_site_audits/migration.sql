-- CreateTable
CREATE TABLE "SiteAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "maxPages" INTEGER NOT NULL,
    "dataforseoTaskId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "issues" JSONB,
    "pages" JSONB,
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SiteAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteAudit_dataforseoTaskId_key" ON "SiteAudit"("dataforseoTaskId");

-- CreateIndex
CREATE INDEX "SiteAudit_tenantId_domain_createdAt_idx" ON "SiteAudit"("tenantId", "domain", "createdAt");

-- CreateIndex
CREATE INDEX "SiteAudit_tenantId_createdAt_idx" ON "SiteAudit"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "SiteAudit_status_createdAt_idx" ON "SiteAudit"("status", "createdAt");
