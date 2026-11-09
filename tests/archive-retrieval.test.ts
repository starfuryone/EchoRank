// The archive, Phase 4 (ECHORANK-DATA-ARCHIVE.md): reports and exports land
// in Spaces when they are created; the admin retrieval commands return the
// right object into a local folder; "View stored copy" is tenant-scoped,
// presigned, an attachment, and never offers purchased data. Fakes only.
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  tenantId: "tenant12345678",
  crawl: { findFirst: vi.fn() },
  page: { findFirst: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { crawlJob: m.crawl, crawlPage: m.page } }));
vi.mock("@/lib/paid-plan", () => ({ requirePaidPlan: async () => ({ tenantId: m.tenantId }) }));

import { copyExportToReports, newReportId, reportKey, saveReportCopy } from "@/lib/report-archive";
import { getNearestPage, getPurchase, listRuns, restoreRun } from "@/lib/archive-retrieval";
import { presignStoredCopy, storedCopyInfo, storedCopyKeys } from "@/lib/page-archive/stored-copy";
import { urlHash } from "@/lib/page-archive/writer";
import { setArchiveStoreForTests, type ObjectStore } from "@/lib/spaces/client";

const T = "tenant12345678";
const ROOT = join(__dirname, "..");

function memStore(seed: Record<string, Buffer | string> = {}, opts: { failPut?: boolean } = {}) {
  const objects = new Map<string, Buffer>(Object.entries(seed).map(([k, v]) => [k, Buffer.isBuffer(v) ? v : Buffer.from(v)]));
  const presigned: Array<{ key: string; opts: unknown }> = [];
  const copies: Array<[string, string]> = [];
  const store: ObjectStore = {
    async put(key, body) {
      if (opts.failPut) throw new Error("Spaces unreachable");
      objects.set(key, Buffer.isBuffer(body) ? body : Buffer.from(String(body)));
    },
    async get(key) {
      const b = objects.get(key);
      if (!b) throw new Error("NoSuchKey");
      return Readable.from([b]);
    },
    async head(key) {
      const b = objects.get(key);
      return b ? { contentLength: b.length, metadata: {}, lastModified: null } : null;
    },
    async deleteKeys() {
      return 0;
    },
    async *list(prefix) {
      for (const [key, b] of [...objects].sort()) if (key.startsWith(prefix)) yield { key, size: b.length, lastModified: null };
    },
    async listPrefixes(prefix) {
      const out = new Set<string>();
      for (const key of objects.keys()) if (key.startsWith(prefix)) out.add(prefix + key.slice(prefix.length).split("/")[0] + "/");
      return [...out];
    },
    async presignGet(key, o) {
      presigned.push({ key, opts: o });
      return `https://bucket.example/${key}?sig=x`;
    },
    async copy(src, dst) {
      copies.push([src, dst]);
      objects.set(dst, objects.get(src) ?? Buffer.from(""));
    },
  };
  return { store, objects, presigned, copies };
}

afterEach(() => setArchiveStoreForTests(undefined));

// ─── Reports and exports ────────────────────────────────────────────────────

describe("reports and exports land in Spaces on creation", () => {
  it("tenants/<t>/reports/<type>/<YYYY>/<MM>/<id>.<ext>", () => {
    expect(reportKey({ tenantId: T, type: "monitoring", id: "abc", ext: "pdf", at: new Date("2026-11-09T00:00:00Z") })).toBe(`tenants/${T}/reports/monitoring/2026/11/abc.pdf`);
    expect(() => reportKey({ tenantId: T, type: "../x", id: "abc", ext: "pdf", at: new Date() })).toThrow();
    expect(() => reportKey({ tenantId: "../t", type: "x", id: "abc", ext: "pdf", at: new Date() })).toThrow();
    expect(newReportId()).toMatch(/^[a-z0-9]+-[0-9a-f]{12}$/);
  });

  it("saves the bytes in the background; returns before the upload", async () => {
    const { store, objects } = memStore();
    const p = saveReportCopy({ tenantId: T, type: "ai-visibility", ext: "pdf", contentType: "application/pdf", body: new Uint8Array([37, 80, 68, 70]), id: "r1", at: new Date("2026-11-09T00:00:00Z") }, { store: () => store, enabled: () => true });
    expect(objects.size).toBe(0);
    expect(await p).toBe(`tenants/${T}/reports/ai-visibility/2026/11/r1.pdf`);
    expect(objects.get(`tenants/${T}/reports/ai-visibility/2026/11/r1.pdf`)!.toString("latin1")).toBe("%PDF");
  });

  it("never throws: off, unconfigured, a bad key, a failing bucket", async () => {
    const down = memStore({}, { failPut: true });
    await expect(saveReportCopy({ tenantId: T, type: "x", ext: "csv", contentType: "text/csv", body: "a" }, { store: () => down.store, enabled: () => true })).resolves.toBeNull();
    await expect(saveReportCopy({ tenantId: T, type: "x", ext: "csv", contentType: "text/csv", body: "a" }, { store: () => null, enabled: () => true })).resolves.toBeNull();
    await expect(saveReportCopy({ tenantId: T, type: "x", ext: "csv", contentType: "text/csv", body: "a" }, { enabled: () => false })).resolves.toBeNull();
    await expect(saveReportCopy({ tenantId: "bad/../id", type: "x", ext: "csv", contentType: "text/csv", body: "a" }, { store: () => down.store, enabled: () => true })).resolves.toBeNull();
  });

  it("a crawl export generated through Spaces is copied server-side, not uploaded twice", () => {
    const { store, copies } = memStore({ [`tenants/${T}/exports/c1/pages-${"a".repeat(32)}.csv`]: "x" });
    copyExportToReports({ store, tenantId: T, type: "crawl-pages", ext: "csv", sourceKey: `tenants/${T}/exports/c1/pages-${"a".repeat(32)}.csv`, id: `c1-${"a".repeat(32)}` }, () => true);
    expect(copies).toHaveLength(1);
    expect(copies[0]![1]).toMatch(new RegExp(`^tenants/${T}/reports/crawl-pages/\\d{4}/\\d{2}/c1-a{32}\\.csv$`));
  });

  it("every user-facing PDF and CSV route saves a copy (or goes through the export store)", () => {
    const routes: Record<string, RegExp> = {
      "src/app/api/ai/visibility/report/route.ts": /saveReportCopy\(\{ tenantId: membership\.tenantId, type: "ai-visibility"/,
      "src/app/api/monitoring/report/route.ts": /saveReportCopy\(\{ tenantId: membership\.tenantId, type: "monitoring"/,
      "src/app/api/intelligence/report/route.ts": /saveReportCopy\(\{ tenantId: membership\.tenantId, type: "intelligence"/,
      "src/app/api/intelligence/explain/report/route.ts": /saveReportCopy\(\{ tenantId: membership\.tenantId, type: "explain"/,
      "src/app/api/seo/v1/crawl/[id]/report/route.ts": /saveReportCopy\(\{ tenantId: tenant\.tenantId, type: "crawl-report"/,
      "src/app/api/agency/scan/[id]/rows/[rowId]/report/route.ts": /saveReportCopy\(\{ tenantId: membership\.tenantId, type: "agency-scan"/,
      "src/app/api/agency/scan/[id]/export/route.ts": /saveReportCopy\(\{ tenantId: membership\.tenantId, type: "agency-scan-csv"/,
      "src/app/api/agency/funnels/[id]/leads/export/route.ts": /saveReportCopy\(\{ tenantId: membership\.tenantId, type: "funnel-leads"/,
      "src/app/api/free/v1/authority-checker/[token]/pdf/route.ts": /if \(member\) void saveReportCopy\(\{ tenantId: member\.tenantId/,
      "src/lib/site-crawler/export-store.ts": /copyExportToReports\(/,
    };
    for (const [file, re] of Object.entries(routes)) expect(readFileSync(join(ROOT, file), "utf8"), file).toMatch(re);
  });
});

// ─── Admin retrieval ────────────────────────────────────────────────────────

describe("admin retrieval commands", () => {
  const url = "https://a.example/pricing";
  const h = urlHash(url);
  const pre = (src: string, run: string) => `tenants/${T}/pages/${src}/${run}/`;
  const seed = {
    [`${pre("crawl", "c1")}manifest.json`]: JSON.stringify({ createdAt: "2026-10-01T10:00:00.000Z", count: 1, bytes: 10 }),
    [`${pre("crawl", "c1")}${h}.meta.json`]: JSON.stringify({ fetchedAt: "2026-10-01T09:59:00.000Z", bytes: 4 }),
    [`${pre("crawl", "c1")}${h}.html.gz`]: gzipSync(Buffer.from("<p>october</p>")),
    [`${pre("crawl", "c2")}manifest.json`]: JSON.stringify({ createdAt: "2026-11-08T10:00:00.000Z", count: 1, bytes: 10 }),
    [`${pre("crawl", "c2")}${h}.meta.json`]: JSON.stringify({ fetchedAt: "2026-11-08T09:59:00.000Z", bytes: 4, renderedBytes: 4 }),
    [`${pre("crawl", "c2")}${h}.html.gz`]: gzipSync(Buffer.from("<p>november</p>")),
    [`${pre("crawl", "c2")}${h}.rendered.html.gz`]: gzipSync(Buffer.from("<p>november rendered</p>")),
    [`${pre("crawl", "c2")}tables/crawl_pages.ndjson.gz`]: gzipSync(Buffer.from("{}\n")),
    [`${pre("crawl", "c3")}${h}.meta.json`]: JSON.stringify({ fetchedAt: "2026-11-09T09:00:00.000Z", bytes: 4 }), // no manifest: incomplete
    [`tenants/other1234567/pages/crawl/c9/${h}.meta.json`]: JSON.stringify({ fetchedAt: "2026-11-09T09:00:00.000Z", bytes: 4 }),
  };

  it("archive:list shows the tenant's runs, newest first, and which are incomplete", async () => {
    const { store } = memStore(seed);
    const runs = await listRuns(store, { tenantId: T, source: "crawl" });
    expect(runs.map((r) => [r.runId, r.complete])).toEqual([["c2", true], ["c1", true], ["c3", false]]);
    const nov = await listRuns(store, { tenantId: T, from: new Date("2026-11-01"), to: new Date("2026-11-30") });
    expect(nov.map((r) => r.runId)).toEqual(["c2"]);
  });

  it("archive:get --url --date writes the nearest snapshot as plain HTML into a local folder", async () => {
    const { store } = memStore(seed);
    const out = mkdtempSync(join(tmpdir(), "arch-get-"));
    const near = await getNearestPage(store, { tenantId: T, url, date: new Date("2026-10-05"), outDir: out });
    expect(near).toMatchObject({ runId: "c1", fetchedAt: "2026-10-01T09:59:00.000Z" });
    const html = near!.files.find((f) => f.endsWith(".html"))!;
    expect(readFileSync(html, "utf8")).toBe("<p>october</p>");
    expect(statSync(html).mode & 0o777).toBe(0o600);
    const later = await getNearestPage(store, { tenantId: T, url, date: new Date("2026-11-08T12:00:00Z"), outDir: out });
    expect(later?.runId).toBe("c2");
    expect(later!.files.some((f) => f.endsWith(".rendered.html"))).toBe(true);
  });

  it("archive:get --provider --endpoint --hash writes the purchased response", async () => {
    const body = { v: 1, provider: "dataforseo", response: { tasks: [] } };
    const { store } = memStore({ "v1/echorank/dataforseo/serp-google-organic-live-advanced/2026/11/09/h-1.json.gz": gzipSync(Buffer.from(JSON.stringify(body))) });
    const out = mkdtempSync(join(tmpdir(), "arch-buy-"));
    const seen: unknown[] = [];
    const got = await getPurchase(
      store,
      { find: async (q) => (seen.push(q), { s3Key: "v1/echorank/dataforseo/serp-google-organic-live-advanced/2026/11/09/h-1.json.gz", createdAt: new Date(1) }) },
      { provider: "dataforseo", endpoint: "v3/serp/google/organic/live/advanced", hash: "h".repeat(64), outDir: out },
    );
    expect(seen[0]).toMatchObject({ endpoint: "serp-google-organic-live-advanced" });
    expect(JSON.parse(readFileSync(got!.file, "utf8"))).toEqual(body);
  });

  it("archive:restore-run pulls a run's pages and tables into the folder, and nothing of another run", async () => {
    const { store } = memStore(seed);
    const out = mkdtempSync(join(tmpdir(), "arch-run-"));
    const r = await restoreRun(store, { tenantId: T, source: "crawl", runId: "c2", outDir: out });
    expect(r).toMatchObject({ files: 5, complete: true });
    expect(readdirSync(join(out, "tables"))).toEqual(["crawl_pages.ndjson.gz"]);
  });
});

// ─── View stored copy ───────────────────────────────────────────────────────

describe("View stored copy", () => {
  const url = "https://a.example/";
  const keys = storedCopyKeys(T, "c1", url);
  const seed = {
    [keys.meta]: JSON.stringify({ fetchedAt: "2026-11-08T10:00:00.000Z", bytes: 10, renderedBytes: 12 }),
    [keys.raw]: gzipSync(Buffer.from("<p>raw</p>")),
    [keys.rendered]: gzipSync(Buffer.from("<p>rendered</p>")),
  };

  beforeEach(() => {
    m.crawl.findFirst.mockReset();
    m.page.findFirst.mockReset();
  });

  it("reports what is stored; a logged-in crawl's page has nothing to offer", async () => {
    const { store } = memStore(seed);
    expect(await storedCopyInfo(store, T, "c1", url)).toEqual({ raw: true, rendered: true, fetchedAt: "2026-11-08T10:00:00.000Z" });
    const login = memStore({ [keys.meta]: JSON.stringify({ fetchedAt: "x", bytes: null, skipped: "login_crawl" }) });
    expect(await storedCopyInfo(login.store, T, "c1", url)).toBeNull();
    expect(await storedCopyInfo(memStore().store, T, "c1", url)).toBeNull();
  });

  it("is a short-lived presigned download, as an attachment, decoded to HTML", async () => {
    const { store, presigned } = memStore(seed);
    const u = await presignStoredCopy(store, { tenantId: T, crawlId: "c1", url, kind: "rendered", date: "2026-11-08" });
    expect(u).toContain(keys.rendered);
    expect(presigned[0]!.opts).toEqual({ filename: "a.example-2026-11-08-rendered.html", expiresIn: 300, contentType: "text/html; charset=utf-8", contentEncoding: "gzip" });
  });

  it("the route: 302 to the presigned URL for the session's own crawl", async () => {
    const { store } = memStore(seed);
    setArchiveStoreForTests(store);
    m.crawl.findFirst.mockResolvedValue({ id: "c1" });
    m.page.findFirst.mockResolvedValue({ url });
    const { GET } = await import("@/app/api/seo/v1/crawl/[id]/pages/[pageId]/stored-copy/route");
    const res = await GET(new Request("https://echorank360.com/api/seo/v1/crawl/c1/pages/p1/stored-copy?kind=raw"), { params: Promise.resolve({ id: "c1", pageId: "p1" }) });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain(keys.raw);
    expect(m.crawl.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1", tenantId: T } }));
    expect(m.page.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1", crawlJobId: "c1" } }));
  });

  it("the route: another workspace's crawl (or no copy) is a 404", async () => {
    const { store } = memStore(seed);
    setArchiveStoreForTests(store);
    m.crawl.findFirst.mockResolvedValue(null);
    const { GET } = await import("@/app/api/seo/v1/crawl/[id]/pages/[pageId]/stored-copy/route");
    const res = await GET(new Request("https://echorank360.com/x?kind=raw"), { params: Promise.resolve({ id: "c-other", pageId: "p1" }) });
    expect(res.status).toBe(404);
    m.crawl.findFirst.mockResolvedValue({ id: "c1" });
    m.page.findFirst.mockResolvedValue({ url: "https://a.example/never-stored" });
    const none = await GET(new Request("https://echorank360.com/x?kind=raw"), { params: Promise.resolve({ id: "c1", pageId: "p2" }) });
    expect(none.status).toBe(404);
  });

  it("offers no purchased data: the route and its library never touch the purchase archive", () => {
    for (const f of ["src/app/api/seo/v1/crawl/[id]/pages/[pageId]/stored-copy/route.ts", "src/lib/page-archive/stored-copy.ts"]) {
      expect(readFileSync(join(ROOT, f), "utf8"), f).not.toMatch(/purchase-archive|purchaseStore|PURCHASE_ARCHIVE/);
    }
  });

  it("no route presigns a purchase-archive object", () => {
    const walk = (d: string, out: string[] = []): string[] => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (/\.(ts|tsx)$/.test(n)) out.push(p);
      }
      return out;
    };
    const hits = walk(join(ROOT, "src/app")).filter((p) => /purchaseStore\(/.test(readFileSync(p, "utf8")));
    expect(hits).toEqual([]);
  });
});
