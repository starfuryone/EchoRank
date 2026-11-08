-- Clicks from Echorank to a sister product's page (demand signal): today the
-- CTA on "Social posting, by EchoPilot". Hand-written, additive; applied by
-- the deploy's `prisma migrate deploy`.

-- CreateTable
CREATE TABLE IF NOT EXISTS "partner_clicks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plan" "PlanType" NOT NULL,
    "target" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "partner_clicks_target_createdAt_idx" ON "partner_clicks"("target", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "partner_clicks_tenantId_idx" ON "partner_clicks"("tenantId");

-- AddForeignKey
ALTER TABLE "partner_clicks" ADD CONSTRAINT "partner_clicks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
