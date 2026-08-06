// The server-side CSV export path on the Site Crawler routes.
//
// The properties worth stating plainly, because a refactor could quietly break
// any of them:
//   1. ?format=csv is a RESPONSE FORMAT, not a second access surface — it
//      inherits the JSON route's auth, tenant scoping and filter validation.
//   2. the same query returns the same ROW SET as JSON (the order differs: the
//      export walks the primary key so the keyset cursor is stable).
//   3. the response opens with the UTF-8 BOM, or Excel mangles every accent.
//
// Prisma and the paid-plan guard are stubbed; the serializer, the streaming
// helper and the routes' own validation are the real code path.
import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const crawlJob = { findFirst: vi.fn() };
const crawlPage = { findMany: vi.fn(), count: vi.fn() };
const crawlIssue = { findMany: vi.fn(), count: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { crawlJob, crawlPage, crawlIssue } }));

const { GET: getIssues } = await import("@/app/api/seo/v1/crawl/[id]/issues/route");
const { GET: getPages } = await import("@/app/api/seo/v1/crawl/[id]/pages/route");
const { GET: getExport } = await import("@/app/api/seo/v1/crawl/[id]/export/route");

import { csvStreamResponse, CSV_ROW_CAP } from "@/lib/csv-stream";
import { ISSUE_COLUMNS, type CrawlIssueRow } from "@/lib/site-crawler/csv-columns";

const params = Promise.resolve({ id: "crawl_1" });

function issueRow(over: Partial<CrawlIssueRow> = {}): CrawlIssueRow {
  return {
    id: "iss_1",
    type: "TITLE_MISSING",
    severity: "ERROR",
    detail: "No <title>",
    crawlPage: { url: "https://example.com/a", statusCode: 200 },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requirePaidPlan.mockResolvedValue({ tenantId: "tenant_1" });
  crawlJob.findFirst.mockResolvedValue({ id: "crawl_1" });
  crawlIssue.findMany.mockResolvedValue([]);
  crawlIssue.count.mockResolvedValue(0);
  crawlPage.findMany.mockResolvedValue([]);
  crawlPage.count.mockResolvedValue(0);
});

describe("issues ?format=csv", () => {
  it("opens with the UTF-8 BOM, before the header line", async () => {
    // Asserted on the RAW BYTES, not on res.text(): the UTF-8 decoder strips a
    // leading BOM, so a text-level assertion passes whether or not the three
    // bytes Excel needs were ever sent.
    crawlIssue.findMany.mockResolvedValueOnce([issueRow()]).mockResolvedValue([]);
    const res = await getIssues(new Request("http://x/?format=csv"), { params });
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3)).startsWith("Severity,Type,URL,")).toBe(true);
  });

  it("sends CSV headers with a dated echorank filename", async () => {
    const res = await getIssues(new Request("http://x/?format=csv"), { params });
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="echorank-site-crawler-issues-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    // A snapshot of tenant data must not sit in a shared cache.
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("applies the same filters as the JSON route", async () => {
    // The body must be consumed: the stream is lazy, so nothing is queried
    // until someone reads it.
    await (
      await getIssues(new Request("http://x/?format=csv&severity=ERROR&type=TITLE_MISSING"), {
        params,
      })
    ).text();
    const where = crawlIssue.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      crawlPage: { crawlJobId: "crawl_1" },
      severity: "ERROR",
      type: "TITLE_MISSING",
    });
  });

  it("selects the same rows as JSON for the same query", async () => {
    // Same filters in, same `where` out — the two formats share one object, so
    // they cannot disagree about which rows a filter selects.
    await (await getIssues(new Request("http://x/?severity=WARNING"), { params })).text();
    const jsonWhere = crawlIssue.findMany.mock.calls[0][0].where;
    vi.clearAllMocks();
    requirePaidPlan.mockResolvedValue({ tenantId: "tenant_1" });
    crawlJob.findFirst.mockResolvedValue({ id: "crawl_1" });
    crawlIssue.findMany.mockResolvedValue([]);
    await (
      await getIssues(new Request("http://x/?format=csv&severity=WARNING"), { params })
    ).text();
    const csvWhere = crawlIssue.findMany.mock.calls[0][0].where;
    // The CSV call adds only the keyset cursor, which is absent on page one.
    expect(csvWhere).toEqual(jsonWhere);
  });

  it("rejects an unknown filter exactly as the JSON route does", async () => {
    const res = await getIssues(new Request("http://x/?format=csv&severity=BOGUS"), { params });
    expect(res.status).toBe(400);
    // Validation runs before the format branch, so no query was issued.
    expect(crawlIssue.findMany).not.toHaveBeenCalled();
  });

  it("is a 404 for another workspace's crawl, never a leak", async () => {
    crawlJob.findFirst.mockResolvedValue(null);
    const res = await getIssues(new Request("http://x/?format=csv"), { params });
    expect(res.status).toBe(404);
    expect(crawlIssue.findMany).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated caller, same as JSON", async () => {
    requirePaidPlan.mockRejectedValue(Object.assign(new Error("Unauthorized"), { statusCode: 401 }));
    const res = await getIssues(new Request("http://x/?format=csv"), { params });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(crawlIssue.findMany).not.toHaveBeenCalled();
  });

  it("still answers JSON when format is absent", async () => {
    const res = await getIssues(new Request("http://x/"), { params });
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("neutralises a formula smuggled in through a crawled page title", async () => {
    // `detail` carries the page's own <title>; a site can put anything there.
    crawlIssue.findMany
      .mockResolvedValueOnce([issueRow({ detail: "=cmd|'/c calc'!A0" })])
      .mockResolvedValue([]);
    const body = await (await getIssues(new Request("http://x/?format=csv"), { params })).text();
    expect(body).toContain("'=cmd");
    expect(body).not.toMatch(/,=cmd/);
  });
});

describe("pages ?format=csv", () => {
  it("streams with the crawler's real columns", async () => {
    const res = await getPages(new Request("http://x/?format=csv"), { params });
    const body = await res.text();
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    // Title LENGTH, not title text for the meta description: the crawler
    // stores no HTML bodies, and the export reports what exists.
    expect(body).toContain("Meta description length");
    expect(body).not.toContain("Meta description,");
  });

  it("inherits the tenant scope", async () => {
    crawlJob.findFirst.mockResolvedValue(null);
    const res = await getPages(new Request("http://x/?format=csv"), { params });
    expect(res.status).toBe(404);
    expect(crawlPage.findMany).not.toHaveBeenCalled();
  });
});

describe("the whole-crawl /export endpoint", () => {
  it("now carries the BOM it was missing", async () => {
    const res = await getExport(new Request("http://x/"), { params });
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("exports the whole crawl, ignoring filters by design", async () => {
    await (await getExport(new Request("http://x/?severity=ERROR"), { params })).text();
    const where = crawlIssue.findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty("severity");
  });
});

describe("row cap", () => {
  const columns = ISSUE_COLUMNS;

  it("appends a truncation notice instead of stopping silently", async () => {
    // A silent cut is indistinguishable from a complete export.
    const rows = Array.from({ length: 5 }, (_, i) => issueRow({ id: `iss_${i}` }));
    const res = csvStreamResponse({
      columns,
      filename: "x.csv",
      cap: 4,
      chunkSize: 2,
      cursorOf: (r) => r.id,
      fetchPage: async (cursor, take) => {
        const from = cursor ? rows.findIndex((r) => r.id === cursor) + 1 : 0;
        return rows.slice(from, from + take);
      },
    });
    const body = await res.text();
    expect(body).toContain("TRUNCATED: export limited to 4 rows");
    // Four data rows, plus header, plus the notice.
    expect(body.trimEnd().split("\r\n")).toHaveLength(6);
  });

  it("does not add a notice when the data ends before the cap", async () => {
    const rows = [issueRow({ id: "a" }), issueRow({ id: "b" })];
    const res = csvStreamResponse({
      columns,
      filename: "x.csv",
      cap: 100,
      chunkSize: 50,
      cursorOf: (r) => r.id,
      fetchPage: async (cursor) => (cursor ? [] : rows),
    });
    expect(await res.text()).not.toContain("TRUNCATED");
  });

  it("never fetches past the cap", async () => {
    const takes: number[] = [];
    const res = csvStreamResponse({
      columns,
      filename: "x.csv",
      cap: 3,
      chunkSize: 10,
      cursorOf: (r) => r.id,
      fetchPage: async (cursor, take) => {
        takes.push(take);
        return cursor ? [] : [issueRow({ id: "a" }), issueRow({ id: "b" }), issueRow({ id: "c" })];
      },
    });
    await res.text();
    // Asked for 3, not 10 — reading 7 rows only to discard them is the bug.
    expect(takes[0]).toBe(3);
  });

  it("defaults to a 50k cap", () => {
    expect(CSV_ROW_CAP).toBe(50_000);
  });
});
