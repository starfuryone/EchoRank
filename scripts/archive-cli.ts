/**
 * Archive retrieval for staff (ECHORANK-DATA-ARCHIVE.md Phase 4). READ-ONLY:
 * nothing in the buckets or in Postgres changes. Output goes to a local folder
 * (--out, default $TMPDIR/echorank-archive-<time>; mode 700, files 600), never
 * to a URL. See src/lib/archive-retrieval.ts.
 *
 * Runs as echorank (it reads .env, like the workers), from the app directory:
 *
 *   sudo -u echorank -H npm --prefix /opt/echorank/app run archive:list -- --tenant <id> [--source crawl] [--from 2026-11-01] [--to 2026-11-09]
 *   sudo -u echorank -H npm --prefix /opt/echorank/app run archive:get -- --tenant <id> --url https://example.com/ --date 2026-11-09
 *   sudo -u echorank -H npm --prefix /opt/echorank/app run archive:get -- --provider dataforseo --endpoint v3/serp/google/organic/live/advanced --hash <sha256>
 *   sudo -u echorank -H npm --prefix /opt/echorank/app run archive:restore-run -- --tenant <id> --run <crawlId> [--source crawl]
 */

import "dotenv/config";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archiveStore, PAGE_SOURCES, type PageSource } from "@/lib/spaces/client";
import { purchaseStore } from "@/lib/purchase-archive/store";
import { getNearestPage, getPurchase, listRuns, restoreRun, type PurchaseLookup } from "@/lib/archive-retrieval";

function arg(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

function date(v: string | undefined, name: string): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v.length === 10 ? `${v}T00:00:00Z` : v);
  if (Number.isNaN(d.getTime())) throw new Error(`--${name}: not a date (${v})`);
  return d;
}

function source(v: string | undefined): PageSource | undefined {
  if (!v) return undefined;
  if (!PAGE_SOURCES.includes(v as PageSource)) throw new Error(`--source must be one of ${PAGE_SOURCES.join(", ")}`);
  return v as PageSource;
}

const prismaLookup: PurchaseLookup = {
  async find(q) {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.purchaseArchive.findMany({
      where: { provider: q.provider, endpoint: q.endpoint, requestHash: q.requestHash, storedAt: { not: null } },
      select: { s3Key: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    if (!rows.length) return null;
    if (!q.near) return rows[0]!;
    const t = q.near.getTime();
    return rows.reduce((best, r) => (Math.abs(r.createdAt.getTime() - t) < Math.abs(best.createdAt.getTime() - t) ? r : best));
  },
};

async function main(): Promise<number> {
  const [cmd, ...args] = process.argv.slice(2);
  const outDir = arg(args, "out") ?? join(tmpdir(), `echorank-archive-${Date.now()}`);

  if (cmd === "list") {
    const tenantId = arg(args, "tenant");
    if (!tenantId) throw new Error("--tenant is required");
    const store = archiveStore();
    if (!store) throw new Error("SPACES_ARCHIVE_* is not configured");
    const runs = await listRuns(store, { tenantId, source: source(arg(args, "source")), from: date(arg(args, "from"), "from"), to: date(arg(args, "to"), "to") });
    for (const r of runs) console.log([r.source.padEnd(8), r.runId.padEnd(30), (r.createdAt ?? "-").padEnd(25), String(r.count ?? "-").padStart(7), String(r.bytes ?? "-").padStart(12), r.complete ? "complete" : "INCOMPLETE"].join(" "));
    console.log(`${runs.length} run(s)`);
    return 0;
  }

  if (cmd === "get") {
    if (arg(args, "provider")) {
      const provider = arg(args, "provider")!;
      const endpoint = arg(args, "endpoint");
      const hash = arg(args, "hash");
      if (!endpoint || !hash) throw new Error("--endpoint and --hash are required with --provider");
      const store = purchaseStore();
      if (!store) throw new Error("PURCHASE_ARCHIVE_* is not configured");
      const out = await getPurchase(store, prismaLookup, { provider, endpoint, hash, date: date(arg(args, "date"), "date"), outDir });
      console.log(out ? `wrote ${out.file}` : "not found");
      return out ? 0 : 1;
    }
    const tenantId = arg(args, "tenant");
    const url = arg(args, "url");
    const when = date(arg(args, "date"), "date") ?? new Date();
    if (!tenantId || !url) throw new Error("--tenant and --url are required (or --provider/--endpoint/--hash)");
    const store = archiveStore();
    if (!store) throw new Error("SPACES_ARCHIVE_* is not configured");
    const out = await getNearestPage(store, { tenantId, url, date: when, outDir });
    if (!out) {
      console.log("no snapshot of that URL");
      return 1;
    }
    console.log(`${out.source} run ${out.runId}, fetched ${out.fetchedAt}`);
    for (const f of out.files) console.log(`wrote ${f}`);
    return 0;
  }

  if (cmd === "restore-run") {
    const tenantId = arg(args, "tenant");
    const runId = arg(args, "run");
    if (!tenantId || !runId) throw new Error("--tenant and --run are required");
    const store = archiveStore();
    if (!store) throw new Error("SPACES_ARCHIVE_* is not configured");
    const out = await restoreRun(store, { tenantId, source: source(arg(args, "source")) ?? "crawl", runId, outDir });
    console.log(`${out.files} file(s), ${out.bytes} bytes → ${outDir}${out.complete ? "" : " (INCOMPLETE: no manifest)"}`);
    return 0;
  }

  console.log("usage: archive-cli.ts list | get | restore-run (see the header of scripts/archive-cli.ts)");
  return 2;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
