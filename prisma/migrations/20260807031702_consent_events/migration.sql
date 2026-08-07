-- CreateTable
CREATE TABLE "consent_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "email" TEXT,
    "stripeSessionId" TEXT,
    "version" TEXT NOT NULL,
    "documents" JSONB NOT NULL,
    "plan" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consent_events_stripeSessionId_key" ON "consent_events"("stripeSessionId");

-- CreateIndex
CREATE INDEX "consent_events_tenantId_createdAt_idx" ON "consent_events"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "consent_events_email_idx" ON "consent_events"("email");

