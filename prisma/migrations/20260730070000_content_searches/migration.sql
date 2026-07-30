-- Content Explorer: one row per phrase search against DataForSEO Content Analysis.
--
-- COST IS ~96% FIXED, which is why zero-result searches are stored too.
-- Measured Jul 2026: $0.024036 per call regardless of what it returns, plus
-- ~$0.0000353 per item. A search finding nothing costs $0.024; re-running it
-- would cost the same again, so the empty answer is itself worth caching.
CREATE TABLE "content_searches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "angle" TEXT NOT NULL DEFAULT 'topic',
    "params" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    -- Nullable: summary/live is skipped for a zero-result phrase because it
    -- returns all-zero fields, and spending $0.024 to learn nothing is waste.
    "summary" JSONB,
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_searches_pkey" PRIMARY KEY ("id")
);

-- Cache lookup: newest search for this exact phrase within the 24h window.
CREATE INDEX "content_searches_tenantId_query_createdAt_idx" ON "content_searches"("tenantId", "query", "createdAt");

-- History list, newest first.
CREATE INDEX "content_searches_tenantId_createdAt_idx" ON "content_searches"("tenantId", "createdAt");

ALTER TABLE "content_searches" ADD CONSTRAINT "content_searches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
