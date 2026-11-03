// The BFS runner's control flow: how a crawl stops, and what status it leaves.
//
// Postgres, Redis and the HTTP layer are stubbed; the frontier logic, batching,
// stop conditions and status writes are the real code. No socket is opened.
//
// THE PROPERTY THIS SUITE EXISTS FOR: a crawl never ends in RUNNING. A job left
// RUNNING is one the UI polls forever and no operator notices, so every exit —
// clean, capped, cancelled, timed out, or thrown — is asserted to write a
// terminal status.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Stubs ──────────────────────────────────────────────────────────────────

const crawlJob = { findUnique: vi.fn(), update: vi.fn() };
const crawlPage = { create: vi.fn(), findFirst: vi.fn() };
vi.mock("@/lib/prisma", () => ({
  prisma: {
    crawlJob,
    crawlPage,
    // Spell check: the workspace's accepted words (Phase 3c).
    tenant: { findUnique: async () => ({ name: "Acme", spellingAcceptedWords: ["Acmeware"] }) },
    // The runner writes a batch inside a transaction; run the callback inline.
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ crawlPage }),
  },
}));

const fetchPage = vi.fn();
vi.mock("@/lib/site-crawler/fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/site-crawler/fetch")>()),
  fetchPage: (...a: unknown[]) => fetchPage(...a),
  // A no-op limiter: pacing is fetch.ts's business and is tested there.
  RateLimiter: class {
    async acquire() {}
  },
}));

const fetchRobots = vi.fn();
vi.mock("@/lib/site-crawler/robots", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/site-crawler/robots")>()),
  fetchRobots: (...a: unknown[]) => fetchRobots(...a),
}));

// Phase 2 collaborators. Both have their own suites; here they are stubbed so
// this file stays about the crawl's control flow.
const collectSitemapUrls = vi.fn(async () => ({
  found: false,
  urls: [] as string[],
  filesFetched: 0,
  truncated: false,
}));
vi.mock("@/lib/site-crawler/sitemap", () => ({
  collectSitemapUrls: (...a: unknown[]) => collectSitemapUrls(...(a as [])),
}));

const aggregateCrawl = vi.fn(async () => ({
  summary: { aggregationMs: 1 },
  issueCount: 0,
}));
vi.mock("@/lib/site-crawler/aggregate", () => ({
  aggregateCrawl: (...a: unknown[]) => aggregateCrawl(...(a as [])),
}));

// The HEAD checks would open real sockets to the external links in these
// fixtures; they have their own suite.
const attachHeadChecks = vi.fn(async () => {});
vi.mock("@/lib/site-crawler/head-checks", () => ({
  attachHeadChecks: (...a: unknown[]) => attachHeadChecks(...(a as [])),
}));

const { runCrawl } = await import("@/lib/site-crawler/runner");

// ─── Fake Redis ─────────────────────────────────────────────────────────────

/** Minimal list+set semantics — enough for the frontier and the seen-set. */
/** Every HINCRBY the crawl issued, in order. Reset per test. */
const credits: { field: string; by: number }[] = [];

function fakeRedis(opts: { cancelled?: boolean } = {}) {
  const lists = new Map<string, string[]>();
  const sets = new Map<string, Set<string>>();
  const flags = new Set<string>();
  if (opts.cancelled) flags.add("crawl:job_1:cancel");

  return {
    lists,
    sets,
    async sadd(key: string, member: string) {
      const set = sets.get(key) ?? new Set<string>();
      sets.set(key, set);
      if (set.has(member)) return 0;
      set.add(member);
      return 1;
    },
    async rpush(key: string, ...values: string[]) {
      const list = lists.get(key) ?? [];
      list.push(...values);
      lists.set(key, list);
      return list.length;
    },
    async lpop(key: string, count: number) {
      const list = lists.get(key) ?? [];
      if (list.length === 0) return null;
      return list.splice(0, count);
    },
    async exists(key: string) {
      return flags.has(key) ? 1 : 0;
    },
    async sismember(key: string, member: string) {
      return sets.get(key)?.has(member) ? 1 : 0;
    },
    /** Records the inlink HINCRBY batch so the dedupe rule can be asserted. */
    pipeline() {
      const chain = {
        hincrby(key: string, field: string, by: number) {
          if (key.endsWith(":inlinks")) credits.push({ field, by });
          return chain;
        },
        hsetnx() {
          return chain;
        },
        expire() {
          return chain;
        },
        async exec() {
          return [];
        },
      };
      return chain;
    },
    async expire() {
      return 1;
    },
    async del() {
      return 1;
    },
    async set() {
      return "OK";
    },
  };
}

function htmlResponse(url: string, links: string[] = []) {
  return {
    finalUrl: url,
    statusCode: 200,
    redirectTarget: null,
    redirectHops: 0,
    contentType: "text/html; charset=utf-8",
    html: `<html><head><title>A title long enough to pass</title>
      <meta name="description" content="${"d".repeat(40)}">
      <link rel="canonical" href="${url}"></head>
      <body><h1>H</h1><p>${Array.from({ length: 200 }, (_, i) => `w${i}`).join(" ")}</p>
      ${links.map((l) => `<a href="${l}">x</a>`).join("")}</body></html>`,
    xRobotsTag: null,
    headers: { "content-type": "text/html; charset=utf-8" },
    bytes: 2048,
    fetchMs: 10,
    error: null,
  };
}

/** The status written by the final (finally-block) update. */
function terminalWrite() {
  const calls = crawlJob.update.mock.calls;
  return calls[calls.length - 1]![0].data;
}

beforeEach(() => {
  vi.clearAllMocks();
  credits.length = 0;
  crawlJob.findUnique.mockResolvedValue({
    id: "job_1",
    rootUrl: "https://example.com/",
    urlCap: 100,
    status: "QUEUED",
  });
  crawlJob.update.mockResolvedValue({});
  crawlPage.create.mockResolvedValue({ id: "p1" });
  crawlPage.findFirst.mockResolvedValue(null);
  fetchRobots.mockResolvedValue({
    allowAll: true,
    isAllowed: () => true,
    crawlDelaySeconds: 0,
  });
  fetchPage.mockImplementation(async (url: string) => htmlResponse(url));
  collectSitemapUrls.mockResolvedValue({
    found: false,
    urls: [],
    filesFetched: 0,
    truncated: false,
  });
  aggregateCrawl.mockResolvedValue({ summary: { aggregationMs: 1 }, issueCount: 0 });
});

describe("clean completion", () => {
  it("marks RUNNING at the start and COMPLETED when the frontier empties", async () => {
    const outcome = await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });

    expect(crawlJob.update.mock.calls[0]![0].data).toMatchObject({ status: "RUNNING" });
    expect(outcome.status).toBe("COMPLETED");
    // A crawl that simply ran out of URLs has no reason to report.
    expect(outcome.stoppedReason).toBeNull();
    expect(outcome.pagesCrawled).toBe(1);
    expect(terminalWrite()).toMatchObject({ status: "COMPLETED", finishedAt: expect.any(Date) });
  });

  it("follows in-scope links and skips external ones", async () => {
    fetchPage.mockImplementation(async (url: string) =>
      url === "https://example.com/"
        ? htmlResponse(url, ["/a", "/b", "https://elsewhere.com/c"])
        : htmlResponse(url),
    );

    const outcome = await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(outcome.pagesCrawled).toBe(3); // root + /a + /b
    const fetched = fetchPage.mock.calls.map((c) => c[0]);
    expect(fetched.some((u: string) => u.includes("elsewhere.com"))).toBe(false);
  });

  it("never fetches the same URL twice", async () => {
    // Two pages linking to each other is the loop that hangs a naive crawler.
    fetchPage.mockImplementation(async (url: string) =>
      htmlResponse(url, ["https://example.com/", "https://example.com/a"]),
    );

    const outcome = await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    const fetched = fetchPage.mock.calls.map((c) => c[0]);
    expect(new Set(fetched).size).toBe(fetched.length);
    expect(outcome.pagesCrawled).toBe(2);
  });
});

describe("stop conditions", () => {
  it("stops at the URL cap with stoppedReason url_cap", async () => {
    crawlJob.findUnique.mockResolvedValue({
      id: "job_1",
      rootUrl: "https://example.com/",
      urlCap: 3,
      status: "QUEUED",
    });
    fetchPage.mockImplementation(async (url: string) =>
      htmlResponse(url, ["/a", "/b", "/c", "/d", "/e", "/f"]),
    );

    const outcome = await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(outcome.stoppedReason).toBe("url_cap");
    expect(outcome.status).toBe("COMPLETED"); // capped is a success, not a failure
    expect(outcome.pagesCrawled).toBeLessThanOrEqual(3);
  });

  it("stops at the wall clock with stoppedReason time_cap, still COMPLETED", async () => {
    // A clock that jumps past the hour on its second reading.
    let calls = 0;
    const now = () => (calls++ === 0 ? 0 : 61 * 60 * 1000);

    const outcome = await runCrawl({ jobId: "job_1", redis: fakeRedis() as never, now });
    expect(outcome.stoppedReason).toBe("time_cap");
    expect(outcome.status).toBe("COMPLETED");
    expect(terminalWrite()).toMatchObject({ status: "COMPLETED", stoppedReason: "time_cap" });
  });

  it("stops on the cancel flag with status CANCELLED", async () => {
    const outcome = await runCrawl({
      jobId: "job_1",
      redis: fakeRedis({ cancelled: true }) as never,
    });
    expect(outcome.status).toBe("CANCELLED");
    expect(terminalWrite()).toMatchObject({ status: "CANCELLED" });
    // The flag is checked before any fetch, so a cancelled crawl costs nothing.
    expect(fetchPage).not.toHaveBeenCalled();
  });
});

describe("failure handling", () => {
  it("writes FAILED with a truncated reason, never leaving the job RUNNING", async () => {
    crawlPage.create.mockRejectedValue(new Error("x".repeat(900)));

    const outcome = await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(outcome.status).toBe("FAILED");
    expect(outcome.stoppedReason!.length).toBeLessThanOrEqual(500);
    expect(terminalWrite()).toMatchObject({ status: "FAILED", finishedAt: expect.any(Date) });
  });

  it("still writes a terminal status when the progress update itself fails", async () => {
    // The RUNNING write succeeds, a mid-crawl write throws — the finally block
    // is what guarantees the row does not stay RUNNING.
    crawlJob.update
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("db gone"))
      .mockResolvedValue({});

    const outcome = await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(outcome.status).toBe("FAILED");
    expect(terminalWrite().status).toBe("FAILED");
  });

  it("throws when the crawl row does not exist", async () => {
    crawlJob.findUnique.mockResolvedValue(null);
    await expect(runCrawl({ jobId: "missing", redis: fakeRedis() as never })).rejects.toThrow();
  });
});

describe("robots.txt", () => {
  it("records a disallowed URL without fetching it", async () => {
    fetchRobots.mockResolvedValue({
      allowAll: false,
      isAllowed: () => false,
      crawlDelaySeconds: 0,
    });

    const outcome = await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(fetchPage).not.toHaveBeenCalled();
    // The row still exists, carrying the blocked-by-robots finding and nothing else.
    expect(crawlPage.create).toHaveBeenCalledTimes(1);
    const created = crawlPage.create.mock.calls[0]![0].data;
    expect(created.issues.create).toEqual([
      expect.objectContaining({
        crawlJobId: "job_1",
        ruleId: "response_codes.blocked_by_robots",
        type: "response_codes.blocked_by_robots",
        kind: "warning",
        severity: "WARNING",
      }),
    ]);
    expect(outcome.pagesCrawled).toBe(1);
  });
});

describe("progress and cleanup", () => {
  it("updates pagesCrawled as it goes, so the UI poll shows movement", async () => {
    fetchPage.mockImplementation(async (url: string) =>
      url === "https://example.com/" ? htmlResponse(url, ["/a"]) : htmlResponse(url),
    );
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });

    const progressWrites = crawlJob.update.mock.calls
      .map((c) => c[0].data)
      .filter((d) => "pagesCrawled" in d && !("status" in d));
    expect(progressWrites.length).toBeGreaterThan(0);
  });

  it("deletes the frontier keys when the crawl ends", async () => {
    const redis = fakeRedis();
    const del = vi.spyOn(redis, "del");
    await runCrawl({ jobId: "job_1", redis: redis as never });
    expect(del).toHaveBeenCalled();
  });

  it("writes page-rule findings with rule id, kind, priority and evidence, and the stored facts", async () => {
    fetchPage.mockImplementation(async (url: string) => ({
      ...htmlResponse(url),
      html: `<html><head><title>x</title></head><body><img src="/a.png"></body></html>`,
    }));
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    const data = crawlPage.create.mock.calls[0]![0].data;
    const rules = (data.issues.create as { ruleId: string }[]).map((i) => i.ruleId);
    expect(rules).toEqual(expect.arrayContaining(["page_titles.under_30_chars", "images.missing_alt", "validation.missing_doctype"]));
    expect(data.issues.create[0]).toMatchObject({ crawlJobId: "job_1", kind: expect.any(String), priority: expect.any(String), evidence: expect.any(Object) });
    expect(data).toMatchObject({ imgCount: 1, imgMissingAltCount: 1, hasViewport: false, noindex: false, bytes: 2048 });
    expect(typeof data.simhash).toBe("bigint");
    // Duplicates are a site rule now: nothing is looked up at write time.
    expect(crawlPage.findFirst).not.toHaveBeenCalled();
  });

  it("queues hreflang, canonical and pagination targets, without inlink credit", async () => {
    fetchPage.mockImplementation(async (url: string) =>
      url === "https://example.com/"
        ? {
            ...htmlResponse(url),
            html: `<html><head><link rel="alternate" hreflang="fr" href="/fr"><link rel="next" href="/p2"></head><body></body></html>`,
          }
        : htmlResponse(url),
    );
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    const urls = crawlPage.create.mock.calls.map((c) => c[0].data.url);
    expect(urls).toEqual(expect.arrayContaining(["https://example.com/fr", "https://example.com/p2"]));
    expect(credits.some((c) => c.field.endsWith("/fr") || c.field.endsWith("/p2"))).toBe(false);
  });
});

// ─── Inlink credit ──────────────────────────────────────────────────────────

describe("inlink counting", () => {
  it("credits a repeatedly-linked URL once per source page", async () => {
    // THE RULE: a nav that links the homepage five times from one page is one
    // vote from that page, not five. Without this the count measures markup
    // repetition rather than how well-linked a page is.
    fetchPage.mockImplementation(async (url: string) =>
      url === "https://example.com/"
        ? htmlResponse(url, ["/a", "/a", "/a", "/a", "/a"])
        : htmlResponse(url),
    );

    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });

    const forA = credits.filter((c) => c.field === "https://example.com/a");
    expect(forA).toHaveLength(1);
    expect(forA[0]!.by).toBe(1);
  });

  it("counts the same target once from each of two source pages", async () => {
    // Two different pages linking /shared is two votes — the dedupe is
    // per source page, not global.
    fetchPage.mockImplementation(async (url: string) => {
      if (url === "https://example.com/") return htmlResponse(url, ["/one", "/two"]);
      // Only /one and /two link to /shared; /shared itself links nowhere, so
      // the expected count is exactly the two source pages.
      if (url === "https://example.com/shared") return htmlResponse(url);
      return htmlResponse(url, ["/shared", "/shared"]);
    });

    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });

    const forShared = credits.filter((c) => c.field === "https://example.com/shared");
    expect(forShared).toHaveLength(2);
  });

  it("credits links that differ only by tracking params once", async () => {
    // They normalize to one URL, so they are one link.
    fetchPage.mockImplementation(async (url: string) =>
      url === "https://example.com/"
        ? htmlResponse(url, ["/a?utm_source=nav", "/a?utm_source=footer", "/a"])
        : htmlResponse(url),
    );

    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(credits.filter((c) => c.field === "https://example.com/a")).toHaveLength(1);
  });

  it("credits nothing for external links", async () => {
    fetchPage.mockImplementation(async (url: string) =>
      url === "https://example.com/" ? htmlResponse(url, ["https://elsewhere.com/x"]) : htmlResponse(url),
    );

    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(credits.some((c) => c.field.includes("elsewhere.com"))).toBe(false);
  });
});

// ─── Render mode (Phase 3b) ─────────────────────────────────────────────────

describe("render mode", () => {
  const rendered = (url: string, extraLinks: string[]) => ({
    finalUrl: url,
    status: 200,
    jsRedirect: null,
    offSite: false,
    html: htmlResponse(url, extraLinks).html,
    consoleErrors: 2,
    consoleSample: "boom",
    viewport: { width: 412, scrollWidth: 412 },
    bodyFontPx: 16,
    tapTargets: { checked: 1, tooClose: 0, sample: null },
    axe: { version: "4.11.4", violations: { "image-alt": { impact: "critical", nodes: 1 } } },
  });

  function sidecarStub() {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        if (!url.endsWith("/render")) throw new Error(`unexpected fetch ${url}`);
        const page = JSON.parse(init.body as string).url as string;
        calls.push(page);
        // The root renders one link the raw HTML does not have.
        return new Response(JSON.stringify(rendered(page, page === "https://example.com/" ? ["/js-only"] : [])), { status: 200 });
      }),
    );
    return calls;
  }

  afterEach(() => vi.unstubAllGlobals());

  it("renders up to the job's cap, stores the render columns and follows JS-only links", async () => {
    crawlJob.findUnique.mockResolvedValue({
      id: "job_1",
      rootUrl: "https://example.com/",
      urlCap: 100,
      status: "QUEUED",
      renderMode: "all",
      renderCap: 1,
      pagesRendered: 0,
    });
    const calls = sidecarStub();

    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });

    expect(calls).toEqual(["https://example.com/"]);
    const rootRow = crawlPage.create.mock.calls.find((c) => c[0].data.url === "https://example.com/")![0].data;
    expect(rootRow).toMatchObject({ consoleErrors: 2, axeViolations: { "image-alt": 1 }, jsOnly: { links: true } });
    const ruleIds = rootRow.issues.create.map((i: { ruleId: string }) => i.ruleId);
    expect(ruleIds).toEqual(expect.arrayContaining(["javascript.links_only_rendered", "javascript.console_errors", "accessibility.image_alt"]));
    // The JS-only link became a crawled page.
    expect(fetchPage.mock.calls.map((c) => c[0])).toContain("https://example.com/js-only");
    expect(terminalWrite().pagesRendered).toBe(1);
  });

  it("renders nothing and fires no render rules when the job's mode is none", async () => {
    const calls = sidecarStub();
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(calls).toEqual([]);
    const all = crawlPage.create.mock.calls.flatMap((c) => c[0].data.issues.create.map((i: { ruleId: string }) => i.ruleId));
    expect(all.some((id: string) => id.startsWith("accessibility.") || id.startsWith("mobile."))).toBe(false);
  });
});

// ─── Spell check (Phase 3c) ─────────────────────────────────────────────────

describe("spell check", () => {
  it("checks pages in their declared language and skips the workspace's accepted words", async () => {
    fetchPage.mockImplementation(async (url: string) => {
      const r = htmlResponse(url);
      return { ...r, html: r.html.replace("<html>", '<html lang="en">').replace("<h1>H</h1>", "<h1>Acmeware recieve</h1>") };
    });
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    const issues = crawlPage.create.mock.calls[0]![0].data.issues.create as { ruleId: string; evidence: Record<string, unknown> }[];
    const sp = issues.find((i) => i.ruleId === "spelling.misspellings");
    expect(sp?.evidence.sample).toContain("recieve");
    expect(String(sp?.evidence.sample)).not.toMatch(/acmeware/i);
  });
});
