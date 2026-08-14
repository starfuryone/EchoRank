-- AI Share of Voice.
--
-- Additive: one new table, no column added to and no constraint changed on any
-- existing one. The Watcher tables this reads from (prompt_runs,
-- mention_analyses, competitor_mentions) are untouched.

-- CreateTable
CREATE TABLE "sov_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "promptSetId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "brand" TEXT NOT NULL,
    "mentionWeighted" DOUBLE PRECISION NOT NULL,
    "promptCount" INTEGER NOT NULL,
    "share" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sov_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The nightly writer's upsert target. Re-running a night restates it.
CREATE UNIQUE INDEX "sov_snapshots_promptSetId_engine_date_brand_key" ON "sov_snapshots"("promptSetId", "engine", "date", "brand");

-- CreateIndex
CREATE INDEX "sov_snapshots_promptSetId_date_idx" ON "sov_snapshots"("promptSetId", "date" DESC);

-- CreateIndex
CREATE INDEX "sov_snapshots_tenantId_date_idx" ON "sov_snapshots"("tenantId", "date" DESC);

-- AddForeignKey
ALTER TABLE "sov_snapshots" ADD CONSTRAINT "sov_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sov_snapshots" ADD CONSTRAINT "sov_snapshots_promptSetId_fkey" FOREIGN KEY ("promptSetId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
