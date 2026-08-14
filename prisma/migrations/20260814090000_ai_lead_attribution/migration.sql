-- CreateEnum
CREATE TYPE "AiVisitSource" AS ENUM ('chatgpt', 'perplexity', 'gemini', 'copilot', 'claude', 'dark_ai');

-- CreateTable
CREATE TABLE "attribution_keys" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribution_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_visits" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "source" "AiVisitSource" NOT NULL,
    "landingPath" TEXT NOT NULL,
    "referrer" TEXT,
    "utm" JSONB,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hits" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ai_visits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attribution_keys_keyHash_key" ON "attribution_keys"("keyHash");

-- CreateIndex
CREATE INDEX "attribution_keys_tenantId_idx" ON "attribution_keys"("tenantId");

-- CreateIndex
CREATE INDEX "ai_visits_tenantId_firstSeen_idx" ON "ai_visits"("tenantId", "firstSeen" DESC);

-- CreateIndex
CREATE INDEX "ai_visits_tenantId_source_firstSeen_idx" ON "ai_visits"("tenantId", "source", "firstSeen" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ai_visits_tenantId_visitorId_source_landingPath_key" ON "ai_visits"("tenantId", "visitorId", "source", "landingPath");

-- AddForeignKey
ALTER TABLE "attribution_keys" ADD CONSTRAINT "attribution_keys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_visits" ADD CONSTRAINT "ai_visits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
