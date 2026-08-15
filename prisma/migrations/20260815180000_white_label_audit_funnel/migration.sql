-- CreateTable
CREATE TABLE "funnel_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "allowedOrigins" TEXT[],
    "branding" JSONB,
    "notifyEmail" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funnel_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_leads" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "funnelId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "score" INTEGER,
    "summary" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funnel_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "funnel_configs_key_key" ON "funnel_configs"("key");

-- CreateIndex
CREATE INDEX "funnel_configs_tenantId_createdAt_idx" ON "funnel_configs"("tenantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "funnel_leads_funnelId_createdAt_idx" ON "funnel_leads"("funnelId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "funnel_leads_tenantId_createdAt_idx" ON "funnel_leads"("tenantId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "funnel_configs" ADD CONSTRAINT "funnel_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_leads" ADD CONSTRAINT "funnel_leads_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funnel_leads" ADD CONSTRAINT "funnel_leads_funnelId_fkey" FOREIGN KEY ("funnelId") REFERENCES "funnel_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
