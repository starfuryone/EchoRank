/**
 * The purchase archive's one-time backfill (ECHORANK-DATA-ARCHIVE.md Phase 3):
 * the shared provider cache (SPACES_CACHE_BUCKET, cache/…) copied into the
 * purchase archive with purpose "backfill". See src/lib/purchase-archive/backfill.ts
 * for what exists to backfill and how each object is mapped.
 *
 * DRY RUN BY DEFAULT: counts and sizes, per cache feature, plus the projected
 * archive size; nothing is read beyond the listing and nothing is written.
 * `--run` writes (idempotent: a second run stores nothing new). `--limit N`
 * caps how many objects a run writes.
 *
 * Runs as echorank (it reads .env, like the workers), from the app directory:
 *
 *   sudo -u echorank -H npm --prefix /opt/echorank/app run archive:backfill
 *   sudo -u echorank -H npm --prefix /opt/echorank/app run archive:backfill -- --run
 *
 * Prints counts, sizes and features only — no keys' targets, no payloads,
 * never a credential.
 */

import "dotenv/config";
import { buildArchiveClient, s3ObjectStore } from "@/lib/spaces/client";
import { spacesCredentials } from "@/lib/spaces-client";
import { purchaseStore } from "@/lib/purchase-archive/store";
import { prismaArchiveIndex } from "@/lib/purchase-archive/prisma-index";
import { runBackfill } from "@/lib/purchase-archive/backfill";
import { purchaseArchiveEnabled } from "@/lib/purchase-archive/config";

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const run = args.includes("--run");
  const limitAt = args.indexOf("--limit");
  const limit = limitAt >= 0 ? Math.max(1, Number(args[limitAt + 1]) || 0) : undefined;

  const bucket = process.env.SPACES_CACHE_BUCKET?.trim();
  if (!bucket) {
    console.log("SPACES_CACHE_BUCKET is not set: there is no shared cache to backfill from.");
    return 0;
  }
  const c = spacesCredentials();
  const cache = s3ObjectStore(buildArchiveClient({ endpoint: c.endpoint, region: c.region, bucket, key: c.key, secret: c.secret }), bucket);

  console.log(`purchase-archive backfill — ${new Date().toISOString()} — ${run ? "RUN" : "dry run"}`);
  console.log(`purchase archive configured: ${purchaseArchiveEnabled()}`);
  const out = await runBackfill({
    cache,
    archive: run ? purchaseStore() : null,
    index: run ? prismaArchiveIndex : null,
    run,
    limit,
    log: (l) => console.log(l.replace(/cache\/([^/]+)\/([^/]+)\/([^/]+)\/[0-9a-f]{64}/, "cache/$1/$2/$3/<target>")),
  });
  console.log("");
  console.log(["feature".padEnd(24), "objects".padStart(9), "size".padStart(10)].join(" "));
  for (const [f, s] of Object.entries(out.byFeature).sort()) {
    console.log([f.padEnd(24), String(s.objects).padStart(9), mb(s.bytes).padStart(10)].join(" "));
  }
  console.log(["total".padEnd(24), String(out.objects).padStart(9), mb(out.bytes).padStart(10)].join(" "));
  console.log(`not cache objects (skipped): ${out.skipped}`);
  // The archive stores each payload re-gzipped inside a JSON body: about the
  // cached size plus a few hundred bytes of envelope per object.
  console.log(`projected archive size: ~${mb(out.bytes + out.objects * 400)}`);
  if (run) console.log(`stored ${out.stored} · already archived ${out.duplicates} · failed ${out.failed}`);
  else console.log("dry run: nothing written. Re-run with --run to write.");
  return out.failed ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
