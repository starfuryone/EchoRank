-- Search-quota support on SeoApiCall.
--
-- The table already carried tenantId, feature, ok, createdAt and the
-- (tenantId, createdAt) index, so this adds only what the quota needs: a way to
-- tell "DataForSEO billed us" apart from "the tenant got an answer".
--
-- ok = billed (drives the USD cap). resultAt = usable result exists (drives the
-- user-facing search quota). For live endpoints these coincide; for the standard
-- queue they are minutes apart and a posted task can be billed and still fail.
ALTER TABLE "SeoApiCall" ADD COLUMN "resultAt" TIMESTAMP(3);
ALTER TABLE "SeoApiCall" ADD COLUMN "dataforseoTaskId" TEXT;

-- Existing rows predate the split. Every one of them was written by a code path
-- that only recorded after a result came back (live calls) or at task_post for
-- the standard queue. Backfilling ok=true rows to resultAt=createdAt keeps the
-- current month's usage honest rather than resetting every tenant to zero.
UPDATE "SeoApiCall" SET "resultAt" = "createdAt" WHERE "ok" = true;

-- The quota aggregate: one tenant, one month, successful rows only.
CREATE INDEX "SeoApiCall_tenantId_resultAt_idx" ON "SeoApiCall"("tenantId", "resultAt");
-- Poller lookup by task id.
CREATE INDEX "SeoApiCall_dataforseoTaskId_idx" ON "SeoApiCall"("dataforseoTaskId");
