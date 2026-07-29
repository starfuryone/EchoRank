-- AI Lens: one measurement of what an AI answer engine sees on one URL.
--
-- gapPercent is NUMERIC(5,1), not an integer: 0.0% ("fully readable") and 0.4%
-- ("one stray block") are different answers, and rounding both to 0 would make
-- the headline number lie in the direction that flatters us.
CREATE TABLE "ai_lens_analyses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "gapPercent" DECIMAL(5,1) NOT NULL,
    "rawWordCount" INTEGER NOT NULL,
    "renderedWordCount" INTEGER NOT NULL,
    "missingBlocks" JSONB NOT NULL,
    "meta" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_lens_analyses_pkey" PRIMARY KEY ("id")
);

-- Cache lookup: newest analysis for this exact URL.
CREATE INDEX "ai_lens_analyses_tenantId_url_createdAt_idx" ON "ai_lens_analyses"("tenantId", "url", "createdAt");

-- History list.
CREATE INDEX "ai_lens_analyses_tenantId_createdAt_idx" ON "ai_lens_analyses"("tenantId", "createdAt");

ALTER TABLE "ai_lens_analyses" ADD CONSTRAINT "ai_lens_analyses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
