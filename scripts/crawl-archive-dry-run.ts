/**
 * The crawl archive's dry run (CRAWL-ARCHIVE.md Phase 3): READ-ONLY. Prints,
 * per tenant, how many crawls the daily sweep would archive and how many
 * retention would delete, with the estimated Postgres bytes each would move
 * (rows × the table's average on-disk row size). Nothing is written, nothing
 * is uploaded; Spaces need not be configured.
 *
 * Runs as echorank (it reads .env, like the workers), from the app directory:
 *
 *   sudo -u echorank -H npm --prefix /opt/echorank/app run crawl-archive:dry-run
 *
 * Tenant ids only — no names, domains or URLs are printed.
 */

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { dryRunReport } from "@/lib/site-crawler/archive/sweep";
import { archiveDryRun, archiveEnabled } from "@/lib/site-crawler/archive/constants";
import { spacesConfigured } from "@/lib/spaces/client";

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

async function main(): Promise<number> {
  const started = Date.now();
  const { rows, lackingTotals, archivedAlready } = await dryRunReport();
  console.log(`crawl-archive dry run — ${new Date().toISOString()}`);
  console.log(`spaces configured: ${spacesConfigured()} · CRAWL_ARCHIVE_ENABLED: ${archiveEnabled()} · CRAWL_ARCHIVE_DRY_RUN: ${archiveDryRun()}`);
  console.log("");
  console.log(["tenant".padEnd(28), "plan".padEnd(11), "hot".padStart(5), "archive".padStart(8), "est. moved".padStart(12), "delete".padStart(7), "est. deleted".padStart(13)].join(" "));
  let a = 0;
  let d = 0;
  let ab = 0;
  let db = 0;
  for (const r of rows) {
    console.log([r.tenantId.padEnd(28), r.planType.padEnd(11), String(r.hot).padStart(5), String(r.archive).padStart(8), mb(r.archiveBytes).padStart(12), String(r.purge).padStart(7), mb(r.purgeBytes).padStart(13)].join(" "));
    a += r.archive;
    d += r.purge;
    ab += r.archiveBytes;
    db += r.purgeBytes;
  }
  console.log("");
  console.log(`tenants with work: ${rows.length} · crawls to archive: ${a} (${mb(ab)}) · crawls retention would delete: ${d} (${mb(db)})`);
  console.log(`already archived: ${archivedAlready} · archive candidates whose summary needs the totals backfill first: ${lackingTotals}`);
  console.log(`a sweep archives at most 50 crawls a day, oldest first · took ${((Date.now() - started) / 1000).toFixed(1)} s`);
  return 0;
}

main()
  .catch((err) => {
    // The message only: a stack or an error object can carry connection strings.
    console.error(`[crawl-archive:dry-run] failed: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`);
    return 1;
  })
  .then(async (code) => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(code);
  });
