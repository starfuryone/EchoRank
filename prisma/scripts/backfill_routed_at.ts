/**
 * One-shot backfill for Feedback.routedAt.
 *
 * The async feedback-routing reconciliation sweep treats any SUBMITTED
 * feedback with `routedAt IS NULL` (older than the grace window) as unrouted
 * and re-enqueues it. Before `routedAt` existed, feedback was routed
 * synchronously at submission time, so every pre-existing SUBMITTED row would
 * otherwise look unrouted on the first deploy and get reprocessed in batches.
 *
 * This marks those rows as already routed (routedAt = submittedAt) so the
 * sweep starts from a clean slate. Re-running is safe: the `routedAt IS NULL`
 * guard means already-marked rows are skipped, and routing itself is
 * idempotent regardless.
 *
 * Run once, after the schema change is applied:
 *   npm run db:backfill-routed-at
 */
import { PrismaClient } from "../../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Only touch rows that were actually submitted; PENDING/EXPIRED feedback was
  // never routed and correctly has no routedAt.
  const result = await prisma.$executeRaw`
    UPDATE "feedback"
    SET "routedAt" = "submittedAt"
    WHERE "status" = 'SUBMITTED'
      AND "routedAt" IS NULL
      AND "submittedAt" IS NOT NULL
  `;

  console.log(`Backfilled routedAt for ${result} submitted feedback row(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
