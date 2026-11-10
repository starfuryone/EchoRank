// The page archive, Phase 1b (ECHORANK-DATA-ARCHIVE.md): every page fetched
// for a client copied to tenants/<tenantId>/pages/<source>/<runId>/ — html
// (+ rendered) and meta per URL, the manifest last, the >5 MB skip, metadata
// only for logged-in crawls, a 500-URL crawl no more than 10% slower, the
// spool when Spaces is down, retention and workspace deletion removing the
// objects, tenant-prefix isolation, and the sidecar's archive never reaching a
// stored or returned response. S3 is a fake; nothing leaves the box.
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const fixed: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {
    tenant: { findUnique: vi.fn(async () => ({ id: "tenant12345678", stripeSubscriptionId: null, stripeCustomerId: null })), delete: vi.fn(async () => ({})) },
    pageSnapshot: { findMany: vi.fn(async () => []), deleteMany: vi.fn(async () => ({ count: 0 })) },
    purchaseArchive: { findMany: vi.fn(async () => [{ s3Key: "v1/echorank/dataforseo/x/2026/11/09/a-1.json.gz" }]), deleteMany: vi.fn(async () => ({ count: 1 })) },
    crawlComparison: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    crawlJob: { update: vi.fn(async () => ({})) },
  };
  const prisma = new Proxy({ $executeRaw: vi.fn(async () => 0) } as Record<string, unknown>, {
    get(target, key: string) {
      if (key in target) return target[key];
      fixed[key] ??= { deleteMany: vi.fn(async () => ({ count: 0 })), findMany: vi.fn(async () => []), findUnique: vi.fn(async () => null) };
      return fixed[key];
    },
  });
  return { prisma, fixed, redis: { scan: vi.fn(async () => ["0", []]), del: vi.fn(async () => 0) } };
});
vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@/lib/stripe/client", () => ({ getStripe: () => ({ subscriptions: { cancel: vi.fn() } }) }));
vi.mock("@/lib/mailer", () => ({ sendMail: vi.fn() }));
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => m.redis }));

import { InvalidKeySegmentError, pagesPrefix, setArchiveStoreForTests, type ObjectStore } from "@/lib/spaces/client";
import { PageRunWriter, urlHash, type PageCapture } from "@/lib/page-archive/writer";
import { drainPageSpool, listPageSpool, spoolPageObject } from "@/lib/page-archive/spool";
import { archiveSidecarPages, sidecarArchiveBody, takeSidecarArchive, toCaptures } from "@/lib/page-archive/sidecar";
import { closeCrawlSnapshots, crawlTablesPrefix } from "@/lib/page-archive/crawl";
import { pageArchiveConcurrency, pageArchiveEnabled } from "@/lib/page-archive/config";
import { purgeRetainedOut } from "@/lib/site-crawler/retention";
import { deleteWorkspace } from "@/lib/privacy/deletion";
import { setPurchaseStoreForTests } from "@/lib/purchase-archive/store";

const T = "tenant12345678";

function fakeStore(opts: { failPut?: () => boolean; putDelayMs?: number } = {}) {
  const objects = new Map<string, Buffer>();
  const order: string[] = [];
  const deleted: string[] = [];
  const store: ObjectStore = {
    async put(key, body) {
      if (opts.putDelayMs) await new Promise((r) => setTimeout(r, opts.putDelayMs));
      if (opts.failPut?.()) throw new Error("Spaces unreachable");
      order.push(key);
      objects.set(key, Buffer.isBuffer(body) ? body : Buffer.from(String(body)));
    },
    async get() {
      throw new Error("not used");
    },
    async head() {
      return null;
    },
    async deleteKeys(keys) {
      for (const k of keys) {
        objects.delete(k);
        deleted.push(k);
      }
      return keys.length;
    },
    async *list(prefix) {
      for (const [key, b] of objects) if (key.startsWith(prefix)) yield { key, size: b.length, lastModified: null };
    },
    async listPrefixes() {
      return [];
    },
    async presignGet() {
      throw new Error("not used");
    },
  };
  return { store, objects, order, deleted };
}

function page(url: string, over: Partial<PageCapture> = {}): PageCapture {
  return {
    url,
    finalUrl: url,
    status: 200,
    contentType: "text/html; charset=utf-8",
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "max-age=60" },
    fetchedAt: "2026-11-09T10:00:00.000Z",
    raw: { html: `<html><body><h1>${url}</h1>${"<p>lorem ipsum</p>".repeat(50)}</body></html>` },
    ...over,
  };
}

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "page-spool-"));
}

afterEach(() => {
  setArchiveStoreForTests(undefined);
  setPurchaseStoreForTests(undefined);
  vi.unstubAllEnvs();
});

// ─── Keys and isolation ─────────────────────────────────────────────────────

describe("keys and tenant isolation", () => {
  it("lays pages out under the tenant, source and run", () => {
    expect(pagesPrefix(T, "crawl", "crawl123")).toBe(`tenants/${T}/pages/crawl/crawl123/`);
    expect(pagesPrefix(T, "ai-lens", "lens1")).toBe(`tenants/${T}/pages/ai-lens/lens1/`);
    expect(crawlTablesPrefix(T, "crawl123")).toBe(`tenants/${T}/pages/crawl/crawl123/tables/`);
  });

  it("refuses any id that could leave its prefix, and any unknown source", () => {
    for (const bad of ["../other", "a/b", "", "x".repeat(65), "t enant"]) {
      expect(() => pagesPrefix(bad, "crawl", "c1")).toThrow(InvalidKeySegmentError);
      expect(() => pagesPrefix(T, "crawl", bad)).toThrow(InvalidKeySegmentError);
    }
    expect(() => pagesPrefix(T, "purchases" as never, "c1")).toThrow(InvalidKeySegmentError);
  });

  it("every object a run writes is inside that tenant's run prefix", async () => {
    const { store, order } = fakeStore();
    const w = new PageRunWriter({ store, tenantId: T, source: "crawl", runId: "c1", concurrency: 4 });
    w.add(page("https://a.example/"));
    w.add(page("https://a.example/../../tenants/other/x"));
    await w.finish();
    expect(order.length).toBeGreaterThan(0);
    for (const k of order) expect(k.startsWith(`tenants/${T}/pages/crawl/c1/`)).toBe(true);
  });

  it("no route builds a page-archive key; only the tenant-scoped stored-copy pair reads one", () => {
    const ROOT = join(__dirname, "..");
    const walk = (d: string, out: string[] = []): string[] => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(ts|tsx)$/.test(n)) out.push(p);
      }
      return out;
    };
    const files = walk(join(ROOT, "src/app"));
    const builds = files.filter((p) => /pagesPrefix\(|\/pages\/(crawl|ai-lens|audit)\//.test(readFileSync(p, "utf8")));
    expect(builds.map((p) => relative(ROOT, p))).toEqual([]);
    const reads = files.filter((p) => /@\/lib\/page-archive\/stored-copy/.test(readFileSync(p, "utf8"))).map((p) => relative(ROOT, p)).sort();
    expect(reads).toEqual(["src/app/api/seo/v1/crawl/[id]/pages/[pageId]/route.ts", "src/app/api/seo/v1/crawl/[id]/pages/[pageId]/stored-copy/route.ts"]);
  });
});

// ─── The writer ─────────────────────────────────────────────────────────────

describe("page run writer", () => {
  it("every URL gets an html and a meta object (+ rendered when rendered), and the manifest is written last", async () => {
    const { store, objects, order } = fakeStore();
    const w = new PageRunWriter({ store, tenantId: T, source: "crawl", runId: "c1", concurrency: 8 });
    const urls = Array.from({ length: 25 }, (_, i) => `https://a.example/p${i}`);
    for (const u of urls) w.add(page(u, u.endsWith("p3") ? { rendered: { html: "<html><body>rendered</body></html>" }, renderedStatus: 200 } : {}));
    const manifest = await w.finish();
    const prefix = `tenants/${T}/pages/crawl/c1/`;
    for (const u of urls) {
      const h = urlHash(u);
      expect(objects.has(`${prefix}${h}.html.gz`)).toBe(true);
      expect(objects.has(`${prefix}${h}.meta.json`)).toBe(true);
    }
    const r = urlHash("https://a.example/p3");
    expect(gunzipSync(objects.get(`${prefix}${r}.rendered.html.gz`)!).toString()).toContain("rendered");
    expect(order[order.length - 1]).toBe(`${prefix}manifest.json`);
    expect(manifest!.count).toBe(25);
    expect(manifest!.objects).toHaveLength(51); // 25 html + 25 meta + 1 rendered
    const meta = JSON.parse(objects.get(`${prefix}${urlHash(urls[0]!)}.meta.json`)!.toString());
    expect(Object.keys(meta)).toEqual(expect.arrayContaining(["url", "finalUrl", "status", "headers", "fetchedAt", "bytes", "contentType"]));
    const listed = manifest!.objects.find((o) => o.key.endsWith(".html.gz"))!;
    expect(listed.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a body over 5 MB is meta only", async () => {
    const { store, objects } = fakeStore();
    const w = new PageRunWriter({ store, tenantId: T, source: "crawl", runId: "c1", concurrency: 2 });
    w.add(page("https://a.example/big", { raw: { html: "x".repeat(5_000_001) } }));
    w.add(page("https://a.example/pdf", { raw: null, contentType: "application/pdf", skipped: "not_html" }));
    await w.finish();
    const prefix = `tenants/${T}/pages/crawl/c1/`;
    expect(objects.has(`${prefix}${urlHash("https://a.example/big")}.html.gz`)).toBe(false);
    expect(JSON.parse(objects.get(`${prefix}${urlHash("https://a.example/big")}.meta.json`)!.toString()).skipped).toBe("too_large");
    expect(JSON.parse(objects.get(`${prefix}${urlHash("https://a.example/pdf")}.meta.json`)!.toString()).skipped).toBe("not_html");
  });

  it("a logged-in crawl keeps metadata only", async () => {
    const { store, objects } = fakeStore();
    const w = new PageRunWriter({ store, tenantId: T, source: "crawl", runId: "c1", concurrency: 2 });
    w.add(page("https://a.example/account", { skipped: "login_crawl", rendered: { html: "<p>private</p>" } }));
    await w.finish();
    const keys = [...objects.keys()];
    expect(keys.some((k) => k.endsWith(".html.gz"))).toBe(false);
    const meta = keys.find((k) => k.endsWith(".meta.json"))!;
    expect(JSON.parse(objects.get(meta)!.toString()).skipped).toBe("login_crawl");
  });

  it("Spaces down: every object and then the manifest go to the spool, and drain in that order", async () => {
    const dir = tmp();
    const down = fakeStore({ failPut: () => true });
    const w = new PageRunWriter({ store: down.store, tenantId: T, source: "crawl", runId: "c1", concurrency: 4, spool: (k, b, o) => spoolPageObject(k, b, o, dir) });
    for (let i = 0; i < 5; i++) w.add(page(`https://a.example/s${i}`));
    await w.finish();
    const files = await listPageSpool(dir);
    expect(files).toHaveLength(11); // 5 html + 5 meta + manifest
    for (const f of files) expect(statSync(join(dir, f)).mode & 0o777).toBe(0o600);
    const up = fakeStore();
    const out = await drainPageSpool(up.store, { dir });
    expect(out).toMatchObject({ uploaded: 11, remaining: 0, failed: false });
    expect(up.order[up.order.length - 1]).toBe(`tenants/${T}/pages/crawl/c1/manifest.json`);
  });

  it("a full backlog spills to the spool instead of holding pages in memory", async () => {
    const dir = tmp();
    const slow = fakeStore({ putDelayMs: 30 });
    const w = new PageRunWriter({ store: slow.store, tenantId: T, source: "crawl", runId: "c1", concurrency: 1, maxPending: 2, spool: (k, b, o) => spoolPageObject(k, b, o, dir) });
    for (let i = 0; i < 10; i++) w.add(page(`https://a.example/b${i}`));
    await w.finish();
    expect(w.spooled).toBeGreaterThan(0);
    // Every page's html + meta went somewhere; none was dropped.
    expect(w.uploaded + w.spooled).toBe(20);
    expect(w.dropped).toBe(0);
  });

  it("a 500-URL crawl is no more than 10% slower with the archive on", async () => {
    // The crawl's shape: 4 fetch workers, each page a few ms of network. The
    // archive's puts are slow (25 ms) on purpose: they must not reach the crawl.
    const urls = Array.from({ length: 500 }, (_, i) => `https://a.example/u${i}`);
    async function crawl(onPage: (u: string) => void): Promise<number> {
      const started = performance.now();
      let cursor = 0;
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          for (;;) {
            const i = cursor++;
            if (i >= urls.length) return;
            await new Promise((r) => setTimeout(r, 4));
            onPage(urls[i]!);
          }
        }),
      );
      return performance.now() - started;
    }
    const baseline = Math.min(await crawl(() => {}), await crawl(() => {}));
    const { store } = fakeStore({ putDelayMs: 25 });
    const dir = tmp();
    const w = new PageRunWriter({ store, tenantId: T, source: "crawl", runId: "c500", concurrency: 8, spool: (k, b, o) => spoolPageObject(k, b, o, dir) });
    const withArchive = await crawl((u) => w.add(page(u)));
    await w.finish();
    expect(w.pages).toBe(500);
    expect(withArchive).toBeLessThanOrEqual(baseline * 1.1 + 15);
  }, 30_000);
});

// ─── Crawl completion ───────────────────────────────────────────────────────

describe("crawl completion", () => {
  it("a COMPLETED crawl copies its tables after the pages; a cancelled one does not", async () => {
    const { store } = fakeStore();
    const copied: string[] = [];
    const copy = async (_s: ObjectStore, c: { id: string }, prefix: string) => copied.push(`${c.id}:${prefix}`);
    const w1 = new PageRunWriter({ store, tenantId: T, source: "crawl", runId: "c1", concurrency: 2 });
    await closeCrawlSnapshots({ store, writer: w1 }, { id: "c1", tenantId: T, status: "COMPLETED" }, copy);
    const w2 = new PageRunWriter({ store, tenantId: T, source: "crawl", runId: "c2", concurrency: 2 });
    await closeCrawlSnapshots({ store, writer: w2 }, { id: "c2", tenantId: T, status: "CANCELLED" }, copy);
    expect(copied).toEqual([`c1:tenants/${T}/pages/crawl/c1/tables/`]);
  });

  it("a failed table copy is logged, never thrown", async () => {
    const { store } = fakeStore();
    const w = new PageRunWriter({ store, tenantId: T, source: "crawl", runId: "c1", concurrency: 2 });
    await expect(closeCrawlSnapshots({ store, writer: w }, { id: "c1", tenantId: T, status: "COMPLETED" }, async () => Promise.reject(new Error("boom")))).resolves.toBeUndefined();
  });

  it("config: on with the crawl archive's key unless switched off; concurrency 8 by default", () => {
    const env = { SPACES_ARCHIVE_ENDPOINT: "e", SPACES_ARCHIVE_REGION: "r", SPACES_ARCHIVE_BUCKET: "b", SPACES_ARCHIVE_KEY: "k", SPACES_ARCHIVE_SECRET: "s" } as unknown as NodeJS.ProcessEnv;
    expect(pageArchiveEnabled(env)).toBe(true);
    expect(pageArchiveEnabled({ ...env, PAGE_ARCHIVE_ENABLED: "false" })).toBe(false);
    expect(pageArchiveEnabled({ PURCHASE_ARCHIVE_ENDPOINT: "e" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(pageArchiveConcurrency({} as NodeJS.ProcessEnv)).toBe(8);
    expect(pageArchiveConcurrency({ PAGE_ARCHIVE_CONCURRENCY: "3" } as unknown as NodeJS.ProcessEnv)).toBe(3);
  });

  it("the crawler feeds the writer and closes it after the terminal status", () => {
    const src = readFileSync(join(__dirname, "../src/lib/site-crawler/runner.ts"), "utf8");
    expect(src).toMatch(/ctx\.snapshots\?\.add\(/);
    expect(src).toMatch(/skipped: ctx\.loggedIn \? "login_crawl"/);
    const finallyAt = src.indexOf("const finishedAt = new Date()");
    // The last close is the terminal one; an INTERRUPTED crawl (a restart) closes its run earlier, with no terminal write.
    const closeAt = src.lastIndexOf("closeCrawlSnapshots(archived");
    expect(finallyAt).toBeGreaterThan(0);
    expect(closeAt).toBeGreaterThan(finallyAt);
  });
});

// ─── Retention and deletion ─────────────────────────────────────────────────

describe("retention and deletion remove the Spaces objects", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a crawl leaving retention takes its page snapshots and table copy with it, and nothing else", async () => {
    const { store, objects } = fakeStore();
    const mine = `tenants/${T}/pages/crawl/c1/`;
    for (const k of [`${mine}a.html.gz`, `${mine}a.meta.json`, `${mine}manifest.json`, `${mine}tables/crawl_pages.ndjson.gz`, `tenants/${T}/pages/crawl/c2/a.html.gz`, `tenants/other1234567/pages/crawl/c1/a.html.gz`]) {
      objects.set(k, Buffer.from("x"));
    }
    await purgeRetainedOut({ id: "c1", tenantId: T, storageState: "HOT", archiveKeyPrefix: null }, store);
    expect([...objects.keys()].sort()).toEqual([`tenants/other1234567/pages/crawl/c1/a.html.gz`, `tenants/${T}/pages/crawl/c2/a.html.gz`]);
  });

  it("deleting a workspace deletes its whole archive prefix and its purchase objects", async () => {
    const archive = fakeStore();
    const purchases = fakeStore();
    archive.objects.set(`tenants/${T}/pages/crawl/c1/a.html.gz`, Buffer.from("x"));
    archive.objects.set(`tenants/${T}/crawls/c1/manifest.json`, Buffer.from("x"));
    archive.objects.set(`tenants/other1234567/pages/crawl/c9/a.html.gz`, Buffer.from("x"));
    purchases.objects.set("v1/echorank/dataforseo/x/2026/11/09/a-1.json.gz", Buffer.from("x"));
    setArchiveStoreForTests(archive.store);
    setPurchaseStoreForTests(purchases.store);
    const out = await deleteWorkspace(T);
    expect([...archive.objects.keys()]).toEqual([`tenants/other1234567/pages/crawl/c9/a.html.gz`]);
    expect(purchases.deleted).toEqual(["v1/echorank/dataforseo/x/2026/11/09/a-1.json.gz"]);
    expect(out["spaces.archive"]).toBe(2);
    expect(out["spaces.purchases"]).toBe(1);
  });
});

// ─── The sidecar's pages ────────────────────────────────────────────────────

describe("sidecar pages (AI Lens, audits)", () => {
  const html = "<html><body>raw</body></html>";
  const archive = {
    v: 1,
    pages: [
      {
        url: "https://a.example/",
        final_url: "https://a.example/",
        status: 200,
        content_type: "text/html",
        headers: { "content-type": "text/html" },
        fetched_at: "2026-11-09T00:00:00+00:00",
        raw: { gz_b64: gzipSync(Buffer.from(html)).toString("base64"), bytes: html.length },
        rendered: null,
        skipped: null,
      },
    ],
  };

  it("takeSidecarArchive removes the archive from the response it returns", () => {
    const data: Record<string, unknown> = { score: 80, archive: structuredClone(archive) };
    const taken = takeSidecarArchive(data);
    expect(taken?.pages).toHaveLength(1);
    expect("archive" in data).toBe(false);
    expect(takeSidecarArchive({ score: 1 })).toBeNull();
  });

  it("asks the sidecar for pages only when the archive is on", () => {
    expect(sidecarArchiveBody({} as NodeJS.ProcessEnv)).toEqual({});
    const env = { SPACES_ARCHIVE_ENDPOINT: "e", SPACES_ARCHIVE_REGION: "r", SPACES_ARCHIVE_BUCKET: "b", SPACES_ARCHIVE_KEY: "k", SPACES_ARCHIVE_SECRET: "s" } as unknown as NodeJS.ProcessEnv;
    expect(sidecarArchiveBody(env)).toEqual({ archive: true });
  });

  it("stores the gzipped page as sent, under the run", async () => {
    const { store, objects } = fakeStore();
    setArchiveStoreForTests(store);
    for (const [k, v] of Object.entries({ SPACES_ARCHIVE_ENDPOINT: "e", SPACES_ARCHIVE_REGION: "r", SPACES_ARCHIVE_BUCKET: "b", SPACES_ARCHIVE_KEY: "k", SPACES_ARCHIVE_SECRET: "s" })) vi.stubEnv(k, v);
    archiveSidecarPages({ tenantId: T, source: "ai-lens", runId: "lens1", archive: structuredClone(archive) });
    await vi.waitFor(() => expect(objects.has(`tenants/${T}/pages/ai-lens/lens1/manifest.json`)).toBe(true));
    const h = urlHash("https://a.example/");
    expect(gunzipSync(objects.get(`tenants/${T}/pages/ai-lens/lens1/${h}.html.gz`)!).toString()).toBe(html);
    expect(toCaptures(archive)[0]!.raw).toMatchObject({ bytes: html.length });
  });

  it("every call site that asks for pages strips them before storing or returning the response", () => {
    const ROOT = join(__dirname, "..");
    const sites = [
      "src/lib/ai-lens/service.ts",
      "src/app/api/ai/visibility/audit/route.ts",
      "src/app/api/ai/visibility/benchmark/route.ts",
      "src/infrastructure/queue/workers/visibility-monitoring.worker.ts",
      "src/lib/partner/service.ts",
    ];
    for (const f of sites) {
      const src = readFileSync(join(ROOT, f), "utf8");
      const ask = src.indexOf("sidecarArchiveBody()");
      expect(ask, f).toBeGreaterThan(0);
      // From the sidecar call on: the archive is taken before the response is
      // stored (a create, or a helper that stores it) or returned.
      const after = src.slice(ask);
      const take = after.indexOf("takeSidecarArchive(data)");
      const stored = after.search(/raw: data as unknown|prisma\.aiLensAnalysis\.create|prisma\.visibilityAudit\.create|persistAudit\(|NextResponse\.json\(data/);
      expect(take, f).toBeGreaterThan(0);
      if (stored > 0) expect(take, f).toBeLessThan(stored);
    }
  });
});
