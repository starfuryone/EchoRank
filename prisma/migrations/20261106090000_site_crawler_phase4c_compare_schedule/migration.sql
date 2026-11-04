-- Site Crawler Phase 4c: crawl comparison and scheduled crawls.
-- Generated with `prisma migrate diff --from-schema <pre-4c> --to-schema
-- prisma/schema.prisma --script`, then guarded so a retried deploy is a no-op.
-- Applied by `prisma migrate deploy` (sudo echorank360-deploy), never by hand.
-- Additive only: two new tables, no column on an existing one.
-- Retention: crawl_comparisons are deleted when either crawl's data is purged
-- (nightly crawl retention) and cascade with either crawl row;
-- crawl_schedules go with their tenant (FK cascade).

CREATE TABLE IF NOT EXISTS "crawl_comparisons" (
    "id" TEXT NOT NULL,
    "jobAId" TEXT NOT NULL,
    "jobBId" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "segmentId" SMALLINT,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawl_comparisons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "crawl_schedules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "cadence" TEXT NOT NULL,
    "hourUtc" SMALLINT NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastJobId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "exportTo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawl_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "crawl_comparisons_jobAId_createdAt_idx" ON "crawl_comparisons"("jobAId", "createdAt");
CREATE INDEX IF NOT EXISTS "crawl_comparisons_jobBId_idx" ON "crawl_comparisons"("jobBId");
CREATE INDEX IF NOT EXISTS "crawl_schedules_tenantId_idx" ON "crawl_schedules"("tenantId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crawl_comparisons_jobAId_fkey') THEN
    ALTER TABLE "crawl_comparisons" ADD CONSTRAINT "crawl_comparisons_jobAId_fkey"
      FOREIGN KEY ("jobAId") REFERENCES "crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crawl_comparisons_jobBId_fkey') THEN
    ALTER TABLE "crawl_comparisons" ADD CONSTRAINT "crawl_comparisons_jobBId_fkey"
      FOREIGN KEY ("jobBId") REFERENCES "crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crawl_schedules_tenantId_fkey') THEN
    ALTER TABLE "crawl_schedules" ADD CONSTRAINT "crawl_schedules_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
