// tests/crawl-exports-spaces.test.ts — exports via Spaces (CRAWL-ARCHIVE.md
// Phase 5) against the HTTP-level fake S3: the key hash (type, normalized
// filters, finishedAt), object reuse, the presigned GET's headers, no row cap,
// tenant isolation, the PDF's JSON {url}, and the fallback — flag off, Spaces
// not configured, crawl not cacheable — byte-identical to the streaming path.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAKE_ARCHIVE_CONFIG, createFakeS3, type FakeS3 } from "./helpers/fake-s3";

vi.mock("server-only", () => ({}));

const crawlJob = { findFirst: vi.fn() };
const crawlIssue = { findMany: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { crawlJob, crawlIssue } }));
const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const spaces = await import("@/lib/spaces/client");
const ex = await import("@/lib/site-crawler/export-store");
const { csvStreamResponse, CSV_ROW_CAP } = await import("@/lib/csv-stream");

const FINISHED = new Date("2026-10-01T01:02:03.456Z");
const CRAWL = { id: "c1", tenantId: "tA", status: "COMPLETED", finishedAt: FINISHED, config: null, summary: {}, storageState: "HOT", dataPurgedAt: null };

let fake: FakeS3;
beforeEach(() => {
  vi.clearAllMocks();
  fake = createFakeS3();
  spaces.setArchiveStoreForTests(spaces.s3ObjectStore(spaces.buildArchiveClient(FAKE_ARCHIVE_CONFIG, { requestHandler: fake.requestHandler as never }), fake.bucket));
  process.env.EXPORTS_VIA_SPACES = "true";
  crawlJob.findFirst.mockResolvedValue({ ...CRAWL });
});
afterEach(() => {
  spaces.setArchiveStoreForTests(undefined);
  delete process.env.EXPORTS_VIA_SPACES;
});

type Row = { id: string; v: string };
const rowsSource = (n: number) => {
  const all = Array.from({ length: n }, (_, i) => ({ id: String(i).padStart(7, "0"), v: `v${i}` }));
  return {
    columns: [{ header: "ID", value: (r: Row) => r.id }, { header: "V", value: (r: Row) => r.v }],
    filename: "echorank-site-crawler-issues-2026-11-05.csv",
    cursorOf: (r: Row) => r.id,
    fetchPage: async (cursor: string | null, take: number) => all.filter((r) => cursor === null || r.id > cursor).slice(0, take),
  };
};
const req = (q = "format=csv") => new Request(`https://app.test/api/seo/v1/crawl/c1/issues?${q}`);
const target = (over: Partial<Parameters<typeof ex.crawlCsvResponse>[1]> = {}) => ({ tenantId: "tA", crawlId: "c1", type: "issues", request: req(), ...over });
const bodyOf = (key: string) => fake.objects.get(key)!.body.toString("utf8");

describe("the key", () => {
  it("hash: type + normalized filters + finishedAt; `format`, key order and empty values do not count", () => {
    const h = (type: string, f: Record<string, string | string[]>, at = FINISHED) => ex.exportHash(type, f, at);
    const base = h("issues", { severity: "ERROR", segment: "1" });
    expect(base).toMatch(/^[0-9a-f]{32}$/);
    expect(h("issues", { segment: "1", severity: "ERROR" })).toBe(base);
    expect(h("issues", { segment: "1", severity: "ERROR", type: "" })).toBe(base);
    expect(ex.filtersFromUrl(new URL("https://x/?format=csv&segment=1&severity=ERROR"))).toEqual({ segment: "1", severity: "ERROR" });
    expect(h("pages", { severity: "ERROR", segment: "1" })).not.toBe(base);
    expect(h("issues", { severity: "WARNING", segment: "1" })).not.toBe(base);
    expect(h("issues", { severity: "ERROR", segment: "1" }, new Date(FINISHED.getTime() + 1))).not.toBe(base);
    // Repeated params (sitemap exclude=) stay ordered lists.
    expect(ex.filtersFromUrl(new URL("https://x/?exclude=/a&exclude=/b"))).toEqual({ exclude: ["/a", "/b"] });
  });

  it("layout and tenant isolation: the tenant and crawl from the session lookup, nothing else", () => {
    const hash = "a".repeat(32);
    expect(ex.exportKey("tA", "c1", "issues", hash, "csv")).toBe(`tenants/tA/exports/c1/issues-${hash}.csv`);
    expect(ex.exportKey("tA", "c1", "issues", hash, "csv").startsWith("tenants/tB/")).toBe(false);
    for (const [t, c, ty, e] of [["../tB", "c1", "issues", "csv"], ["tA", "c1/../../tB", "issues", "csv"], ["tA", "c1", "ISSUES/x", "csv"], ["tA", "c1", "issues", "c/v"]]) {
      expect(() => ex.exportKey(t!, c!, ty!, hash, e!)).toThrow();
    }
  });
});

describe("serving through Spaces", () => {
  it("first request: one upload, then a 302 to a 15-minute presigned GET with the filename", async () => {
    const res = await ex.crawlCsvResponse(rowsSource(3), target());
    expect(res.status).toBe(302);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const loc = new URL(res.headers.get("location")!);
    expect(loc.hostname).toBe("test-bucket.sfo3.digitaloceanspaces.com");
    expect(loc.pathname).toMatch(/^\/tenants\/tA\/exports\/c1\/issues-[0-9a-f]{32}\.csv$/);
    expect(loc.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(loc.searchParams.get("response-content-disposition")).toBe(spaces.attachmentDisposition("echorank-site-crawler-issues-2026-11-05.csv"));
    expect(loc.searchParams.get("response-content-type")).toBe("text/csv; charset=utf-8");
    const [key] = fake.keys("tenants/tA/exports/c1/");
    expect(bodyOf(key!)).toBe("﻿ID,V\r\n0000000,v0\r\n0000001,v1\r\n0000002,v2\r\n");
    // The crawl was looked up tenant-scoped.
    expect(crawlJob.findFirst.mock.calls[0]![0].where).toEqual({ id: "c1", tenantId: "tA" });
  });

  it("the same request again reuses the object (no second upload); other filters are another object", async () => {
    await ex.crawlCsvResponse(rowsSource(3), target());
    const puts = () => fake.requests.filter((r) => r.op === "PutObject" || r.op === "CreateMultipartUpload").length;
    expect(puts()).toBe(1);
    const fetchPage = vi.fn(rowsSource(3).fetchPage);
    const again = await ex.crawlCsvResponse({ ...rowsSource(3), fetchPage }, target({ request: req("segment=&format=csv") }));
    expect(again.status).toBe(302);
    expect(fetchPage).not.toHaveBeenCalled();
    expect(puts()).toBe(1);
    await ex.crawlCsvResponse(rowsSource(3), target({ request: req("format=csv&severity=ERROR") }));
    expect(puts()).toBe(2);
    expect(fake.keys("tenants/tA/exports/c1/")).toHaveLength(2);
  });

  it("no row cap on this path: past the streaming path's 50,000 rows, no truncation notice", async () => {
    const n = CSV_ROW_CAP + 1_234;
    await ex.crawlCsvResponse(rowsSource(n), target());
    const text = bodyOf(fake.keys("tenants/tA/exports/c1/")[0]!);
    expect(text.trimEnd().split("\r\n")).toHaveLength(n + 1);
    expect(text).not.toContain("TRUNCATED");
  });

  it("the PDF: JSON {url}, the generator's filename kept on the object and reused", async () => {
    const make = vi.fn(async () => ({ body: (await import("node:stream")).Readable.from([Buffer.from("%PDF-1.7 x")]), filename: "Echorank-360-Site-Crawl-Report-ex.com-2026-10-01.pdf" }));
    const t = { tenantId: "tA", crawlId: "c1", type: "report", filters: {}, ext: "pdf", contentType: "application/pdf", filename: "Echorank-360-Site-Crawl-Report.pdf" };
    const res = (await ex.serveViaSpaces(t, make, "json"))!;
    const { url, expiresIn } = await res.json();
    expect(expiresIn).toBe(900);
    expect(new URL(url).searchParams.get("response-content-disposition")).toContain("Echorank-360-Site-Crawl-Report-ex.com-2026-10-01.pdf");
    const again = await (await ex.serveViaSpaces(t, make, "json"))!.json();
    expect(make).toHaveBeenCalledTimes(1);
    expect(new URL(again.url).searchParams.get("response-content-disposition")).toContain("Echorank-360-Site-Crawl-Report-ex.com-2026-10-01.pdf");
  });

  it("a generator's refusal (sidecar down) is passed through and nothing is stored", async () => {
    const t = { tenantId: "tA", crawlId: "c1", type: "report", filters: {}, ext: "pdf", contentType: "application/pdf", filename: "r.pdf" };
    const res = (await ex.serveViaSpaces(t, async () => new Response(JSON.stringify({ error: "report_unavailable" }), { status: 502 }), "json"))!;
    expect(res.status).toBe(502);
    expect(fake.keys("tenants/")).toEqual([]);
  });
});

describe("the fallback: the old streaming response, unchanged", () => {
  const streamed = async () => (await csvStreamResponse(rowsSource(5) as never)).text();
  const viaHelper = async () => {
    const res = await ex.crawlCsvResponse(rowsSource(5), target());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    return res.text();
  };

  it("EXPORTS_VIA_SPACES unset", async () => {
    delete process.env.EXPORTS_VIA_SPACES;
    expect(await viaHelper()).toBe(await streamed());
    expect(fake.requests).toEqual([]);
  });

  it("Spaces not configured", async () => {
    spaces.setArchiveStoreForTests(null);
    expect(await viaHelper()).toBe(await streamed());
  });

  it.each([
    ["running", { status: "RUNNING", finishedAt: null }],
    ["no finishedAt", { finishedAt: null }],
    ["archived", { storageState: "ARCHIVED" }],
    ["metrics still running", { config: { addData: { psi: { mode: "all" } } }, summary: { metrics: { psi: { status: "running" } } } }],
  ])("crawl not cacheable: %s", async (_n, over) => {
    crawlJob.findFirst.mockResolvedValue({ ...CRAWL, ...over });
    expect(await viaHelper()).toBe(await streamed());
    expect(fake.keys("tenants/")).toEqual([]);
  });

  it("the streaming path keeps its 50,000-row cap and notice", async () => {
    delete process.env.EXPORTS_VIA_SPACES;
    const text = await (await ex.crawlCsvResponse(rowsSource(CSV_ROW_CAP + 10), target())).text();
    expect(text).toContain("TRUNCATED");
  });
});

describe("a route: auth and tenant scoping before any Spaces call", () => {
  it("issues CSV: tenant A gets a 302; another tenant's crawl id is a 404 and touches no object", async () => {
    const { GET } = await import("@/app/api/seo/v1/crawl/[id]/issues/route");
    requirePaidPlan.mockResolvedValue({ tenantId: "tA", tenant: { planType: "GROWTH" } });
    crawlIssue.findMany.mockResolvedValue([]);
    const res = await GET(req(), { params: Promise.resolve({ id: "c1" }) });
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("location")!).pathname.startsWith("/tenants/tA/exports/c1/issues-")).toBe(true);

    requirePaidPlan.mockResolvedValue({ tenantId: "tB", tenant: { planType: "GROWTH" } });
    crawlJob.findFirst.mockResolvedValue(null);
    const before = fake.requests.length;
    const denied = await GET(req(), { params: Promise.resolve({ id: "c1" }) });
    expect(denied.status).toBe(404);
    expect(crawlJob.findFirst.mock.calls.at(-1)![0].where).toEqual({ id: "c1", tenantId: "tB" });
    expect(fake.requests.length).toBe(before);
  });

  it("unauthenticated: 401, no Spaces call", async () => {
    const { GET } = await import("@/app/api/seo/v1/crawl/[id]/issues/route");
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated"));
    expect((await GET(req(), { params: Promise.resolve({ id: "c1" }) })).status).toBe(401);
    expect(fake.requests).toEqual([]);
  });
});

describe("scheduled-crawl emails", () => {
  it("link to the app's routes, never to a presigned URL", async () => {
    const { scheduleEmail } = await import("@/lib/site-crawler/schedule-email");
    const mail = scheduleEmail({
      locale: "en",
      host: "ex.com",
      crawlJobId: "c1",
      pagesCrawled: 10,
      issues: { ERROR: 1, WARNING: 0, NOTICE: 0 },
      comparison: { id: "cmp1", counts: { added: 1, removed: 0, changed: 0, issuesNew: 0, issuesResolved: 0 } },
    } as never);
    for (const body of [mail.html, mail.text]) {
      expect(body).not.toMatch(/X-Amz-|digitaloceanspaces|amazonaws/);
      expect(body).toContain("/api/seo/v1/crawl/c1/");
    }
  });
});
