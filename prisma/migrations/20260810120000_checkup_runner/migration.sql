-- The checkup runner: run outcomes, the idempotency key, and partial coverage.
--
-- ONE NON-ADDITIVE STATEMENT, and it is safe for a reason that was checked
-- rather than assumed. The CheckupStatus rewrite below drops QUEUED, COMPLETED
-- and CAPPED, which would fail on the USING cast if any row still held one.
-- `checkups` has ZERO rows -- nothing has ever written it, because the runner
-- that does is what this migration is for -- so the cast has nothing to
-- convert. Verified with SELECT count(*) FROM checkups immediately before.
--
-- CAPPED goes because it now contradicts the lifecycle: a tenant reaching its
-- spend cap no longer stops a checkup, it skips the runs it cannot afford and
-- finishes PARTIAL. Leaving the label in the type would leave a trap for the
-- next person to write a status.
--
-- Everything else is additive: two new columns with defaults, one new enum, and
-- a unique index that cannot collide with existing data (see below).

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('OK', 'SKIPPED_CAP', 'FAILED');

-- AlterEnum
BEGIN;
CREATE TYPE "CheckupStatus_new" AS ENUM ('PENDING', 'RUNNING', 'READY', 'PARTIAL', 'FAILED');
ALTER TABLE "public"."checkups" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "checkups" ALTER COLUMN "status" TYPE "CheckupStatus_new" USING ("status"::text::"CheckupStatus_new");
ALTER TYPE "CheckupStatus" RENAME TO "CheckupStatus_old";
ALTER TYPE "CheckupStatus_new" RENAME TO "CheckupStatus";
DROP TYPE "public"."CheckupStatus_old";
ALTER TABLE "checkups" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "checkups" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
-- Defaults to OK so the 66 pre-checkup rows, every one of them answered, keep
-- meaning what they meant.
ALTER TABLE "prompt_runs" ADD COLUMN     "status" "RunStatus" NOT NULL DEFAULT 'OK';

-- AlterTable
ALTER TABLE "visibility_metrics" ADD COLUMN     "partialCoverage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "skippedRuns" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
-- The runner's idempotency key. Cannot collide with the 66 existing rows:
-- every one has a NULL "checkupId", and Postgres treats NULLs as distinct in a
-- unique index. Checked with
--   SELECT count(*) FILTER (WHERE "checkupId" IS NOT NULL) FROM prompt_runs;  -- 0
CREATE UNIQUE INDEX "prompt_runs_checkupId_promptId_engine_repetition_key" ON "prompt_runs"("checkupId", "promptId", "engine", "repetition");
