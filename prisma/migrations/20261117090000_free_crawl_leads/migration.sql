-- Free public site crawler: leads from the result page's email gate. Kept
-- after the crawl is purged (no FK to free_crawls).
CREATE TABLE IF NOT EXISTS "free_crawl_leads" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'free-crawler',
    "doiRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "free_crawl_leads_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "free_crawl_leads_token_email_key" ON "free_crawl_leads"("token", "email");
CREATE INDEX IF NOT EXISTS "free_crawl_leads_createdAt_idx" ON "free_crawl_leads"("createdAt");
