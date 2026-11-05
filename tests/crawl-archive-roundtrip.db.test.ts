// tests/crawl-archive-roundtrip.db.test.ts
//
// The crawl archive against a real Postgres and the in-memory fake S3
// (tests/helpers/fake-s3.ts, under the real AWS SDK): archive → restore leaves
// every table's rows byte-identical (row_to_json, so bigint, bytea, arrays,
// jsonb, floats and millisecond timestamps all count); the manifest's
// checksums verify; failures injected at upload, verify, delete and restore
// leave a consistent state; column drift; the reuse path; retention deleting
// an archived crawl's objects; the sweep (policy, dry run, recovery).
//
// SKIPPED UNLESS TEST_DATABASE_URL IS SET, like every *.db.test.ts: never the
// production database. Ran against a throwaway cluster built from
// `prisma migrate diff --from-empty --to-schema prisma/schema.prisma`.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FAKE_ARCHIVE_CONFIG, createFakeS3, type FakeS3 } from "./helpers/fake-s3";

const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

vi.mock("server-only", () => ({}));

const TABLES = ["crawl_pages", "crawl_issues", "crawl_links", "crawl_extractions", "crawl_page_metrics"] as const;

describe.skipIf(!TEST_DB)("crawl archive round trip (Postgres + fake S3)", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let engine: typeof import("@/lib/site-crawler/archive/engine");
  let sweep: typeof import("@/lib/site-crawler/archive/sweep");
  let retention: typeof import("@/lib/site-crawler/retention");
  let spaces: typeof import("@/lib/spaces/client");
  let fake: FakeS3;
  let store: import("@/lib/spaces/client").ObjectStore;
  const tenantId = `tarc${Date.now().toString(36)}`;
  const job = (n: number) => `${tenantId}j${n}`;
  const prefix = (n: number) => `tenants/${tenantId}/crawls/${job(n)}/`;

  /** Every row of a crawl, as Postgres renders it, per table. */
  async function snapshot(id: string): Promise<Record<string, string[]>> {
    const out: Record<string, string[]> = {};
    for (const t of TABLES) {
      const rows = await prisma.$queryRawUnsafe<{ j: string }[]>(`SELECT row_to_json(t)::text AS j FROM "${t}" t WHERE "crawlJobId" = $1 ORDER BY "id"`, id);
      out[t] = rows.map((r) => r.j);
    }
    return out;
  }
  const rowCount = async (id: string) => Object.values(await snapshot(id)).reduce((n, r) => n + r.length, 0);
  const state = async (id: string) => prisma.crawlJob.findUniqueOrThrow({ where: { id }, select: { storageState: true, archiveKeyPrefix: true, archiveBytes: true, archivedAt: true, restoredAt: true, summary: true } });

  async function seedCrawl(n: number, opts: { site?: string; createdAt?: Date; pages?: number; summary?: object | null } = {}) {
    const id = job(n);
    const site = opts.site ?? "a.example.com";
    await prisma.crawlJob.create({
      data: {
        id,
        tenantId,
        rootUrl: `https://${site}/`,
        urlCap: 100,
        status: "COMPLETED",
        createdAt: opts.createdAt ?? new Date(Date.UTC(2026, 9, n)),
        finishedAt: opts.createdAt ?? new Date(Date.UTC(2026, 9, n, 1)),
        ...(opts.summary === null ? {} : { summary: opts.summary ?? { totals: { ERROR: 1, WARNING: 0, NOTICE: 2 }, issues: {}, issuesByKind: { issue: 0, warning: 0, opportunity: 0 } } }),
      },
    });
    const pages = opts.pages ?? 3;
    for (let p = 0; p < pages; p++) {
      const pageId = `${id}p${p}`;
      await prisma.crawlPage.create({
        data: {
          id: pageId,
          crawlJobId: id,
          url: `https://${site}/${p}?q="x"&é=1`,
          depth: p,
          title: `Line one\nline "two" — ünïcödé ${p}`,
          simhash: BigInt("9223372036854775807") - BigInt(p),
          embedding: Buffer.from([0, 1, 2, 255, p]),
          segmentIds: [0, 2],
          jsonLdTypes: ["Organization", "WebPage"],
          imgSrcs: [],
          linkScore: 0.1 + p / 3,
          textRatio: 1 / 3,
          securityHeaders: { hsts: true, nested: { a: [1, null, "x"] } },
          redirectChain: p === 0 ? [{ url: "http://x", status: 301 }] : undefined,
          searchHits: { "gtag(": 2 },
          lastModified: null,
        },
      });
      await prisma.crawlIssue.create({ data: { crawlPageId: pageId, crawlJobId: id, type: "x", severity: "NOTICE", ruleId: "content.thin", kind: "warning", priority: "low", evidence: { value: "a\u0000b".replace("\u0000", ""), n: 1.5 } } });
      // A pre-3a finding: no crawlJobId (archived with its page all the same).
      await prisma.crawlIssue.create({ data: { crawlPageId: pageId, type: "legacy", severity: "ERROR", detail: "old" } });
      await prisma.crawlLink.create({ data: { crawlJobId: id, fromPageId: pageId, toPageId: `${id}p0`, toUrl: `https://${site}/`, anchor: "home", position: p, status: 200 } });
      await prisma.crawlExtraction.create({ data: { crawlJobId: id, pageId, kind: "ai", extractorIndex: 0, values: ["answer, with comma", ""] } });
      await prisma.crawlPageMetric.create({ data: { crawlJobId: id, pageId, source: "psi", data: { lcp: 2.345678901234, cls: 0.1 }, fetchedAt: new Date("2026-10-01T10:11:12.345Z") } });
    }
    return id;
  }

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/prisma"));
    engine = await import("@/lib/site-crawler/archive/engine");
    sweep = await import("@/lib/site-crawler/archive/sweep");
    retention = await import("@/lib/site-crawler/retention");
    spaces = await import("@/lib/spaces/client");
    fake = createFakeS3();
    store = spaces.s3ObjectStore(spaces.buildArchiveClient(FAKE_ARCHIVE_CONFIG, { requestHandler: fake.requestHandler as never }), fake.bucket);
    spaces.setArchiveStoreForTests(store);
    await prisma.tenant.create({ data: { id: tenantId, name: "arc", slug: tenantId, planType: "GROWTH" } });
  });

  afterAll(async () => {
    spaces?.setArchiveStoreForTests(undefined);
    await prisma?.$executeRawUnsafe(`ALTER TABLE "crawl_pages" DROP COLUMN IF EXISTS "driftNew"`).catch(() => {});
    await prisma?.$executeRawUnsafe(`ALTER TABLE "crawl_pages" DROP COLUMN IF EXISTS "driftRequired"`).catch(() => {});
    await prisma?.$executeRawUnsafe(`ALTER TABLE "crawl_pages" DROP COLUMN IF EXISTS "driftOld"`).catch(() => {});
    await prisma?.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  it("archive → restore: every row identical; manifest + checksums; HOT → ARCHIVED → HOT", async () => {
    const id = await seedCrawl(1, { summary: null });
    // Pre-3a findings carry no crawlJobId; the archive's first step gives them one.
    expect((await snapshot(id)).crawl_issues).toHaveLength(3);
    expect(await engine.backfillIssueJobIds(id)).toBe(3);
    const before = await snapshot(id);
    expect(before.crawl_issues).toHaveLength(6);

    const out = await engine.archiveCrawl(id, store);
    expect(out).toMatchObject({ status: "archived", reused: false, rows: 18 });

    // Rows gone, the crawl_jobs row and a backfilled summary stay.
    expect(await rowCount(id)).toBe(0);
    const s = await state(id);
    expect(s.storageState).toBe("ARCHIVED");
    expect(s.archiveKeyPrefix).toBe(prefix(1));
    expect(s.archiveBytes).toBe(out.status === "archived" ? out.bytes : -1);
    expect(s.summary).toMatchObject({ totals: { ERROR: 3, NOTICE: 3, WARNING: 0 } });

    // Objects: one per table + the manifest, written last, sha256 on each.
    expect(fake.keys(prefix(1))).toEqual([...TABLES.map((t) => `${prefix(1)}${t}.ndjson.gz`), `${prefix(1)}manifest.json`].sort());
    const puts = fake.requests.filter((r) => r.op === "PutObject" && r.key.startsWith(prefix(1))).map((r) => r.key);
    expect(puts.at(-1)).toBe(`${prefix(1)}manifest.json`);
    const manifest = await engine.readManifest(store, prefix(1), { id, tenantId });
    expect(manifest.tables.map((t) => [t.table, t.rows])).toEqual([["crawl_pages", 3], ["crawl_issues", 6], ["crawl_links", 3], ["crawl_extractions", 3], ["crawl_page_metrics", 3]]);
    for (const t of manifest.tables) expect(fake.objects.get(t.key)!.metadata.sha256).toBe(t.sha256);
    await expect(engine.verifyObjects(store, prefix(1), manifest)).resolves.toBeUndefined();

    const back = await engine.restoreCrawl(id, store);
    expect(back).toEqual({ status: "restored", rows: 18 });
    expect(await snapshot(id)).toEqual(before);
    const after = await state(id);
    expect(after.storageState).toBe("HOT");
    expect(after.restoredAt).not.toBeNull();
    // Archive objects are kept for a later re-archive.
    expect(fake.keys(prefix(1))).toHaveLength(6);
  });

  it("batch boundaries: 2,501 pages and links cross the 2,000-row read and 1,000-row insert batches", async () => {
    const id = job(9);
    await prisma.crawlJob.create({ data: { id, tenantId, rootUrl: "https://big.example.com/", urlCap: 5000, status: "COMPLETED", summary: { totals: { ERROR: 0, WARNING: 0, NOTICE: 0 }, issues: {}, issuesByKind: { issue: 0, warning: 0, opportunity: 0 } } } });
    const N = 2_501;
    await prisma.crawlPage.createMany({ data: Array.from({ length: N }, (_, i) => ({ id: `${id}p${String(i).padStart(5, "0")}`, crawlJobId: id, url: `https://big.example.com/${i}`, depth: i % 7, simhash: BigInt(i) * BigInt(3_000_000_000_000) })) });
    await prisma.crawlLink.createMany({ data: Array.from({ length: N }, (_, i) => ({ crawlJobId: id, fromPageId: `${id}p${String(i).padStart(5, "0")}`, toUrl: `https://big.example.com/${(i + 1) % N}`, position: i % 100 })) });
    const before = await snapshot(id);
    await expect(engine.archiveCrawl(id, store)).resolves.toMatchObject({ status: "archived", rows: 2 * N });
    expect(await rowCount(id)).toBe(0);
    await expect(engine.restoreCrawl(id, store)).resolves.toEqual({ status: "restored", rows: 2 * N });
    expect(await snapshot(id)).toEqual(before);
  });

  it("re-archive of a restored crawl reuses the objects when the manifest still matches", async () => {
    const id = job(1);
    const putsBefore = fake.requests.filter((r) => r.op === "PutObject").length;
    const out = await engine.archiveCrawl(id, store);
    expect(out).toMatchObject({ status: "archived", reused: true });
    expect(fake.requests.filter((r) => r.op === "PutObject").length).toBe(putsBefore);
    expect(await rowCount(id)).toBe(0);
    await engine.restoreCrawl(id, store);
  });

  it("failure at upload: back to HOT, rows intact, nothing left in the bucket", async () => {
    const id = await seedCrawl(2);
    await engine.backfillIssueJobIds(id);
    const before = await snapshot(id);
    fake.failNext("PutObject", 1);
    await expect(engine.archiveCrawl(id, store)).rejects.toThrow();
    expect((await state(id)).storageState).toBe("HOT");
    expect((await state(id)).archiveKeyPrefix).toBeNull();
    expect(await snapshot(id)).toEqual(before);
    expect(fake.keys(prefix(2))).toEqual([]);
  });

  it("failure at verify (an object's checksum differs): back to HOT, rows intact, objects deleted", async () => {
    const id = job(2);
    const before = await snapshot(id);
    await expect(
      engine.archiveCrawl(id, store, {
        beforeVerify: () => {
          fake.objects.get(`${prefix(2)}crawl_links.ndjson.gz`)!.metadata.sha256 = "0".repeat(64);
        },
      }),
    ).rejects.toThrow(/sha256/);
    expect((await state(id)).storageState).toBe("HOT");
    expect(await snapshot(id)).toEqual(before);
    expect(fake.keys(prefix(2))).toEqual([]);
  });

  it("failure at verify (HEAD refused): same", async () => {
    const id = job(2);
    fake.failNext("HeadObject", 1);
    await expect(engine.archiveCrawl(id, store)).rejects.toThrow();
    expect((await state(id)).storageState).toBe("HOT");
    expect(await rowCount(id)).toBe(18);
    expect(fake.keys(prefix(2))).toEqual([]);
  });

  it("a crash during the row delete leaves ARCHIVED + rows; the sweep's recovery finishes it", async () => {
    const id = job(2);
    const before = await snapshot(id);
    await expect(engine.archiveCrawl(id, store, { beforeDelete: () => { throw new Error("crash"); } })).rejects.toThrow("crash");
    expect((await state(id)).storageState).toBe("ARCHIVED");
    expect(await rowCount(id)).toBe(18);
    expect(await engine.archivedWithRows()).toContain(id);
    await engine.finishArchivedDeletes(id);
    expect(await rowCount(id)).toBe(0);
    expect(await engine.archivedWithRows()).not.toContain(id);
    // And it restores intact.
    await engine.restoreCrawl(id, store);
    expect(await snapshot(id)).toEqual(before);
  });

  it("failure mid-restore: inserted rows deleted, back to ARCHIVED; a second restore works", async () => {
    const id = job(2);
    const before = await snapshot(id);
    await prisma.crawlJob.update({ where: { id }, data: { restoredAt: null } });
    await engine.archiveCrawl(id, store);
    await expect(engine.restoreCrawl(id, store, { afterRestoreTable: (t) => { if (t === "crawl_links") throw new Error("boom"); } })).rejects.toThrow("boom");
    expect((await state(id)).storageState).toBe("ARCHIVED");
    expect(await rowCount(id)).toBe(0);
    await engine.restoreCrawl(id, store);
    expect(await snapshot(id)).toEqual(before);
  });

  it("a corrupted object fails the restore on its sha256; nothing is left inserted", async () => {
    const id = job(2);
    await engine.archiveCrawl(id, store);
    const key = `${prefix(2)}crawl_extractions.ndjson.gz`;
    const { gzipSync, gunzipSync } = await import("node:zlib");
    const text = gunzipSync(fake.objects.get(key)!.body).toString().replace("answer, with comma", "tampered");
    fake.objects.get(key)!.body = gzipSync(text);
    await expect(engine.restoreCrawl(id, store)).rejects.toThrow(/sha256/);
    expect((await state(id)).storageState).toBe("ARCHIVED");
    expect(await rowCount(id)).toBe(0);
  });

  describe("column drift", () => {
    it("an archived column the table no longer has is ignored; a new nullable/defaulted one takes its default", async () => {
      await prisma.$executeRawUnsafe(`ALTER TABLE "crawl_pages" ADD COLUMN "driftOld" TEXT`);
      const id = await seedCrawl(3);
      await prisma.$executeRawUnsafe(`UPDATE "crawl_pages" SET "driftOld" = 'gone' WHERE "crawlJobId" = $1`, id);
      await engine.archiveCrawl(id, store);
      const m = await engine.readManifest(store, prefix(3), { id, tenantId });
      expect(m.tables[0]!.columns).toContain("driftOld");
      await prisma.$executeRawUnsafe(`ALTER TABLE "crawl_pages" DROP COLUMN "driftOld"`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "crawl_pages" ADD COLUMN "driftNew" INTEGER NOT NULL DEFAULT 7`);
      await engine.restoreCrawl(id, store);
      const rows = await prisma.$queryRawUnsafe<{ v: number }[]>(`SELECT "driftNew" AS v FROM "crawl_pages" WHERE "crawlJobId" = $1`, id);
      expect(rows.map((r) => r.v)).toEqual([7, 7, 7]);
      await prisma.$executeRawUnsafe(`ALTER TABLE "crawl_pages" DROP COLUMN "driftNew"`);
    });

    it("a now-required column with no value: the restore fails clearly, nothing is inserted, the crawl stays ARCHIVED", async () => {
      const id = job(3);
      await prisma.crawlJob.update({ where: { id }, data: { restoredAt: null } });
      await engine.archiveCrawl(id, store);
      // Required, no default (existing rows of other crawls get a value while it is added).
      await prisma.$executeRawUnsafe(`ALTER TABLE "crawl_pages" ADD COLUMN "driftRequired" TEXT NOT NULL DEFAULT 'x'`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "crawl_pages" ALTER COLUMN "driftRequired" DROP DEFAULT`);
      await expect(engine.restoreCrawl(id, store)).rejects.toThrow(/crawl_pages now requires driftRequired/);
      expect((await state(id)).storageState).toBe("ARCHIVED");
      expect(await rowCount(id)).toBe(0);
      await prisma.$executeRawUnsafe(`ALTER TABLE "crawl_pages" DROP COLUMN "driftRequired"`);
      await expect(engine.restoreCrawl(id, store)).resolves.toMatchObject({ status: "restored" });
    });
  });

  it("retention purging an archived crawl deletes its objects first; without a store it waits", async () => {
    const id = await seedCrawl(4);
    await engine.archiveCrawl(id, store);
    const row = await prisma.crawlJob.findUniqueOrThrow({ where: { id }, select: { id: true, storageState: true, archiveKeyPrefix: true } });
    expect(await retention.purgeRetainedOut(row, null)).toBeNull();
    expect(fake.keys(prefix(4))).toHaveLength(6);
    expect((await prisma.crawlJob.findUniqueOrThrow({ where: { id } })).dataPurgedAt).toBeNull();
    // A crawl mid-move is left alone too.
    expect(await retention.purgeRetainedOut({ ...row, storageState: "RESTORING" }, store)).toBeNull();
    expect(await retention.purgeRetainedOut(row, store)).toBe(0);
    expect(fake.keys(prefix(4))).toEqual([]);
    const after = await prisma.crawlJob.findUniqueOrThrow({ where: { id } });
    expect(after.dataPurgedAt).not.toBeNull();
    expect(after.storageState).toBe("HOT");
    expect(after.archiveKeyPrefix).toBeNull();
  });

  describe("the sweep", () => {
    const t2 = `${tenantId}s`;
    const j2 = (n: number) => `${t2}j${n}`;
    beforeAll(async () => {
      await prisma.tenant.create({ data: { id: t2, name: "sweep", slug: t2, planType: "STARTER" } });
      // STARTER keeps 3. Site a: 4 crawls (oldest purged by retention, the next one archived); site b: 1.
      for (const [n, site, day] of [[1, "a.example.com", 1], [2, "a.example.com", 2], [3, "a.example.com", 3], [4, "a.example.com", 4], [5, "b.example.com", 5]] as const) {
        await prisma.crawlJob.create({ data: { id: j2(n), tenantId: t2, rootUrl: `https://${site}/`, urlCap: 10, status: "COMPLETED", createdAt: new Date(Date.UTC(2026, 9, day)), summary: { totals: { ERROR: 0, WARNING: 0, NOTICE: 1 }, issues: {}, issuesByKind: { issue: 0, warning: 0, opportunity: 0 } } } });
        await prisma.crawlPage.create({ data: { id: `${j2(n)}p`, crawlJobId: j2(n), url: `https://${site}/`, depth: 0 } });
      }
    });
    afterAll(async () => {
      await prisma.tenant.delete({ where: { id: t2 } }).catch(() => {});
    });

    it("plan: retention's 3 kept; of those, the newest 2 of site a and site b's one stay hot", async () => {
      const plan = (await sweep.planAllTenants(new Date(Date.UTC(2026, 9, 10)))).find((p) => p.tenantId === t2)!;
      expect(plan.purge).toEqual([j2(1), j2(2)]);
      expect(plan.hot.sort()).toEqual([j2(3), j2(4), j2(5)].sort());
      expect(plan.archive).toEqual([]);
    });

    it("a dry run touches nothing; disabled archives nothing; enabled archives the candidates", async () => {
      // GROWTH keeps 10: now crawl 1 and 2 are kept, beyond site a's newest two → archive.
      await prisma.tenant.update({ where: { id: t2 }, data: { planType: "GROWTH" } });
      const now = new Date(Date.UTC(2026, 9, 10));
      const dry = await sweep.runArchiveSweep({ store, enabled: true, dryRun: true, now });
      expect(dry.candidates).toBeGreaterThanOrEqual(2);
      expect(await prisma.crawlJob.count({ where: { tenantId: t2, storageState: { not: "HOT" } } })).toBe(0);
      expect(fake.keys(`tenants/${t2}/`)).toEqual([]);

      const off = await sweep.runArchiveSweep({ store, enabled: false, dryRun: false, now });
      expect(off.skipped).toBe("disabled");
      expect(await prisma.crawlJob.count({ where: { tenantId: t2, storageState: { not: "HOT" } } })).toBe(0);

      const none = await sweep.runArchiveSweep({ store: null, enabled: true, dryRun: false, now });
      expect(none.skipped).toBe("not_configured");

      const real = await sweep.runArchiveSweep({ store, enabled: true, dryRun: false, now, max: 50 });
      expect(real.failed).toEqual([]);
      const archived = await prisma.crawlJob.findMany({ where: { tenantId: t2, storageState: "ARCHIVED" }, select: { id: true }, orderBy: { id: "asc" } });
      expect(archived.map((c) => c.id)).toEqual([j2(1), j2(2)]);
      expect(await prisma.crawlPage.count({ where: { crawlJobId: { in: [j2(1), j2(2)] } } })).toBe(0);
      expect(await prisma.crawlPage.count({ where: { crawlJobId: { in: [j2(3), j2(4), j2(5)] } } })).toBe(3);
    });

    it("recovery: a crawl left ARCHIVING by a crash goes back to HOT, a RESTORING one with no job back to ARCHIVED", async () => {
      await prisma.crawlJob.update({ where: { id: j2(3) }, data: { storageState: "ARCHIVING" } });
      await store.put(`tenants/${t2}/crawls/${j2(3)}/crawl_pages.ndjson.gz`, "partial");
      await prisma.crawlJob.update({ where: { id: j2(1) }, data: { storageState: "RESTORING" } });
      await prisma.crawlPage.create({ data: { id: `${j2(1)}partial`, crawlJobId: j2(1), url: "https://a.example.com/x", depth: 1 } });
      const res = await sweep.runArchiveSweep({ store, enabled: true, dryRun: false, now: new Date(Date.UTC(2026, 9, 10)), restorePending: async () => false });
      expect(res.recovered).toMatchObject({ archiving: 1, restoring: 1 });
      expect((await state(j2(3))).storageState).toBe("HOT");
      expect(fake.keys(`tenants/${t2}/crawls/${j2(3)}/`)).toEqual([]);
      expect((await state(j2(1))).storageState).toBe("ARCHIVED");
      expect(await prisma.crawlPage.count({ where: { crawlJobId: j2(1) } })).toBe(0);
    });

    it("a RESTORING crawl whose job is still queued is left alone", async () => {
      await prisma.crawlJob.update({ where: { id: j2(2) }, data: { storageState: "RESTORING" } });
      const res = await sweep.runArchiveSweep({ store, enabled: true, dryRun: false, now: new Date(Date.UTC(2026, 9, 10)), restorePending: async (id) => id === j2(2) });
      expect(res.recovered.restoring).toBe(0);
      expect((await state(j2(2))).storageState).toBe("RESTORING");
      await prisma.crawlJob.update({ where: { id: j2(2) }, data: { storageState: "ARCHIVED" } });
    });

    it("exports older than 7 days are deleted, newer ones kept", async () => {
      fake.setClock(() => new Date(Date.UTC(2026, 9, 1)));
      await store.put(`tenants/${t2}/exports/${j2(4)}/pages-old.csv`, "old");
      fake.setClock(() => new Date(Date.UTC(2026, 9, 9)));
      await store.put(`tenants/${t2}/exports/${j2(4)}/pages-new.csv`, "new");
      fake.setClock(() => new Date());
      expect(await sweep.sweepExports(store, new Date(Date.UTC(2026, 9, 10)))).toBe(1);
      expect(fake.keys(`tenants/${t2}/exports/`)).toEqual([`tenants/${t2}/exports/${j2(4)}/pages-new.csv`]);
      // Archive objects are never touched by the export sweep.
      expect(fake.keys(`tenants/${t2}/crawls/`).length).toBeGreaterThan(0);
    });

    it("the dry-run report: per tenant, read-only", async () => {
      const before = await prisma.crawlJob.findMany({ where: { tenantId: t2 }, select: { id: true, storageState: true } });
      const report = await sweep.dryRunReport(new Date(Date.UTC(2026, 9, 10)));
      expect(report.archivedAlready).toBeGreaterThanOrEqual(2);
      expect(await prisma.crawlJob.findMany({ where: { tenantId: t2 }, select: { id: true, storageState: true } })).toEqual(before);
    });
  });
});
