-- Free public site crawler: one row per free crawl (the result link), and the
-- opt-out list of hosts it refuses.
CREATE TABLE IF NOT EXISTS "free_crawls" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "crawlJobId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "free_crawls_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "free_crawls_token_key" ON "free_crawls"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "free_crawls_crawlJobId_key" ON "free_crawls"("crawlJobId");
CREATE INDEX IF NOT EXISTS "free_crawls_domain_createdAt_idx" ON "free_crawls"("domain", "createdAt");
CREATE INDEX IF NOT EXISTS "free_crawls_createdAt_idx" ON "free_crawls"("createdAt");
DO $$ BEGIN
  ALTER TABLE "free_crawls" ADD CONSTRAINT "free_crawls_crawlJobId_fkey" FOREIGN KEY ("crawlJobId") REFERENCES "crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "free_crawl_blocked_hosts" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "note" TEXT,
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "free_crawl_blocked_hosts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "free_crawl_blocked_hosts_host_key" ON "free_crawl_blocked_hosts"("host");
