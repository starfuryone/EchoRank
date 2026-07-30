-- Bot Analytics: the access check and the log-analysis halves.
--
-- Two tables and one Tenant column. Nothing here can hold a raw log line or an
-- IP address — see the note on bot_log_analyses.

-- Explicit domain for Bot Analytics, set on the tool page itself. Kept separate
-- from tenants.auditDomain so the tool works for a tenant that never ran an AI
-- Visibility audit, and so setting it here cannot disturb onboarding state.
ALTER TABLE "tenants" ADD COLUMN "botAnalyticsDomain" TEXT;

-- One active access check for one domain.
--
-- results holds both signals per bot: what robots.txt SAYS and what the edge
-- actually DID when we asked as that bot. JSONB rather than a column per crawler
-- because the bot list is config and grows — Meta added meta-externalagent after
-- this tool shipped, and a column per crawler means a migration per crawler.
CREATE TABLE "bot_access_checks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "robotsPresent" BOOLEAN NOT NULL DEFAULT false,
    "sitemapFound" BOOLEAN NOT NULL DEFAULT false,
    "llmsTxt" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_access_checks_pkey" PRIMARY KEY ("id")
);

-- Freshness lookup (newest check for this tenant) and the history line.
CREATE INDEX "bot_access_checks_tenantId_checkedAt_idx" ON "bot_access_checks"("tenantId", "checkedAt");

ALTER TABLE "bot_access_checks" ADD CONSTRAINT "bot_access_checks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "BotLogStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED');

-- Aggregates from one uploaded access log.
--
-- AGGREGATES ONLY, BY DESIGN. Access logs carry visitor IP addresses. The worker
-- parses the upload, writes the counts below, and deletes the file. There is
-- deliberately no column here that could hold a raw line or an IP, so a future
-- "keep a sample for debugging" change has to add one and argue for it.
CREATE TABLE "bot_log_analyses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "BotLogStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "linesParsed" INTEGER NOT NULL DEFAULT 0,
    "linesSkipped" INTEGER NOT NULL DEFAULT 0,
    "botHits" INTEGER NOT NULL DEFAULT 0,
    "aggregates" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "bot_log_analyses_pkey" PRIMARY KEY ("id")
);

-- History list, newest first.
CREATE INDEX "bot_log_analyses_tenantId_createdAt_idx" ON "bot_log_analyses"("tenantId", "createdAt");

ALTER TABLE "bot_log_analyses" ADD CONSTRAINT "bot_log_analyses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
