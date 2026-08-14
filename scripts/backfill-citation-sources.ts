/**
 * One-off: fold every stored citation into the `sources` rollup.
 *
 *   npx tsx scripts/backfill-citation-sources.ts            # REPORT ONLY
 *   npx tsx scripts/backfill-citation-sources.ts --apply    # writes
 *   npx tsx scripts/backfill-citation-sources.ts --apply --tenant <id>
 *
 * REPORT IS THE DEFAULT AND --apply IS THE ONLY WAY PAST IT. Running this
 * without the flag touches nothing and prints what a run would do: how many
 * citations are unclaimed, how many brand profiles they belong to, and what
 * `sources` already holds. Approve the numbers, then pass the flag.
 *
 * ── Why there is no separate backfill code path ─────────────────────────────
 * The nightly worker's scope is "citations with no sourceId", which on a table
 * that has never been rolled up is every row. So this script is the worker's
 * own rollUpBrandProfile() with the batch cap lifted — not a parallel
 * implementation that could drift from it. If the backfill is right, the
 * nightly job is right, because they are the same function.
 *
 * SAFE TO RUN TWICE. The watermark means a second run finds nothing left to
 * claim and reports zero. Safe to INTERRUPT, too: each batch commits its
 * upserts and its stamps in one transaction, so stopping mid-run leaves a
 * consistent prefix of the work done and the rest still queued.
 *
 * SPENDS NOTHING UPSTREAM. Every number comes from rows the checkup worker
 * already paid for, so there is no costUsd to log.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  countUnrolledCitations,
  listCitationBrandProfiles,
  rollUpBrandProfile,
} from "@/lib/citations/store";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const tenantFlag = args.indexOf("--tenant");
const TENANT: string | undefined = tenantFlag >= 0 ? args[tenantFlag + 1] : undefined;

function line(label: string, value: string | number): void {
  console.log(`  ${label.padEnd(38)} ${value}`);
}

async function report(): Promise<void> {
  const [unrolled, profiles, existingSources, totalCitations] = await Promise.all([
    countUnrolledCitations(TENANT),
    listCitationBrandProfiles(TENANT),
    prisma.source.count({ where: TENANT ? { tenantId: TENANT } : {} }),
    prisma.citation.count({ where: TENANT ? { tenantId: TENANT } : {} }),
  ]);

  console.log("\nCitation Finder backfill — what a run would touch\n");
  line("scope", TENANT ? `tenant ${TENANT}` : "ALL TENANTS");
  line("citations stored", totalCitations);
  line("citations not yet rolled up", unrolled);
  line("brand profiles with tracking on", profiles.length);
  line("source rows that already exist", existingSources);

  // Citations belonging to a paused or deleted brand profile are counted by
  // `unrolled` but will not be claimed by any rollup, because the sweep only
  // visits profiles with trackingActive. Saying so here stops the run being
  // read as a failure when the two numbers do not match afterwards.
  console.log(
    "\n  Note: citations under a paused brand profile stay unclaimed by design —\n" +
      "  the rollup only visits profiles with trackingActive, exactly as the\n" +
      "  nightly sweep does.",
  );
}

async function apply(): Promise<void> {
  const profiles = await listCitationBrandProfiles(TENANT);
  console.log(`\nRolling up ${profiles.length} brand profile(s)…\n`);

  let citations = 0;
  let domains = 0;
  let failed = 0;

  for (const profile of profiles) {
    try {
      // Infinity: the nightly cap exists so a routine run cannot grind through
      // a backlog. Grinding through the backlog is this script's entire job.
      const result = await rollUpBrandProfile(profile, Number.POSITIVE_INFINITY);
      citations += result.citations;
      domains += result.domains;
      console.log(
        `  ${profile.brandName.padEnd(30)} ${String(result.citations).padStart(7)} citations → ${result.domains} domains`,
      );
    } catch (error) {
      // One brand's bad row must not abandon every brand after it in the list.
      failed += 1;
      console.error(
        `  ${profile.brandName.padEnd(30)} FAILED — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  console.log("\nDone.");
  line("citations rolled up", citations);
  line("domains touched", domains);
  line("brand profiles that failed", failed);
  line("citations still unclaimed", await countUnrolledCitations(TENANT));

  if (failed > 0) process.exitCode = 1;
}

async function main(): Promise<void> {
  await report();

  if (!APPLY) {
    console.log("\nREPORT ONLY — nothing was written. Re-run with --apply to write.\n");
    return;
  }

  await apply();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
