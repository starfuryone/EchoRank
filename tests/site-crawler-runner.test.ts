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
const crawlLink = { createMany: vi.fn() };
const crawlExtraction = { createMany: vi.fn() };
const executeRaw = vi.fn(async () => 0);
vi.mock("@/lib/prisma", () => ({
  prisma: {
    crawlJob,
    crawlPage,
    $executeRaw: (...a: unknown[]) => executeRaw(...(a as [])),
    // resolveLinkGraph's window lookup: no edge past the first window.
    $queryRaw: async () => [],
    // Spell check: the workspace's accepted words (Phase 3c).
    tenant: { findUnique: async () => ({ name: "Acme", spellingAcceptedWords: ["Acmeware"] }) },
    // The runner writes a batch inside a transaction; run the callback inline.
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ crawlPage, crawlLink, crawlExtraction }),
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
    chain: [] as { url: string; status: number }[],
    lastModified: null as string | null,
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

// ─── Crawl configuration (Phase 4a) ────────────────────────────────────────

const { sealCrawlConfig } = await import("@/lib/site-crawler/crawl-config-secrets");
const { CrawlConfigInputSchema } = await import("@/lib/site-crawler/crawl-config");
const { rulesFromBody, allowAllRules } = await import("@/lib/site-crawler/robots");

describe("crawl configuration", () => {
  const KEY = "test-key-not-a-secret";

  function withConfig(input: Record<string, unknown>, extra: Record<string, unknown> = {}) {
    vi.stubEnv("GSC_TOKEN_ENCRYPTION_KEY", KEY);
    const config = { ...sealCrawlConfig(CrawlConfigInputSchema.parse(input), null, KEY), ...extra };
    crawlJob.findUnique.mockResolvedValue({ id: "job_1", rootUrl: "https://example.com/", urlCap: 100, status: "QUEUED", config });
  }
  const fetched = () => fetchPage.mock.calls.map((c) => c[0] as string);
  const site = (links: Record<string, string[]>) =>
    fetchPage.mockImplementation(async (url: string) => htmlResponse(url, links[url] ?? []));

  afterEach(() => vi.unstubAllEnvs());

  it("stores custom extractions per page and search hits on the page row (Phase 4b)", async () => {
    withConfig({
      extractors: [
        { name: "nav", kind: "css", expr: "nav" },
        { name: "h1", kind: "css", expr: "h1" },
        { name: "canonical", kind: "xpath", expr: "//link[@rel='canonical']/@href" },
      ],
      searches: [
        { name: "w19x", pattern: "w19", isRegex: false },
        { name: "absent", pattern: "gtag\\(", isRegex: true },
      ],
    });
    site({ "https://example.com/": [] });
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    const rows = crawlExtraction.createMany.mock.calls[0]![0].data;
    expect(rows).toEqual([
      { crawlJobId: "job_1", pageId: "p1", extractorIndex: 1, values: ["H"] },
      { crawlJobId: "job_1", pageId: "p1", extractorIndex: 2, values: ["https://example.com/"] },
    ]);
    // w19 and w190..w199
    expect(crawlPage.create.mock.calls[0]![0].data.searchHits).toEqual({ "0": 11, "1": 0 });
  });

  it("a crawl without extractors or searches writes neither", async () => {
    withConfig({});
    site({ "https://example.com/": [] });
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(crawlExtraction.createMany).not.toHaveBeenCalled();
    expect(crawlPage.create.mock.calls[0]![0].data.searchHits).toBeUndefined();
  });

  it("excluded URLs and URLs past max depth are never fetched", async () => {
    withConfig({ exclude: ["*/tag/*"], maxDepth: 1 });
    site({
      "https://example.com/": ["/a", "/tag/x"],
      "https://example.com/a": ["/a/deeper"],
    });
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(fetched().sort()).toEqual(["https://example.com/", "https://example.com/a"]);
  });

  it("sends decrypted credentials and the configured pace, never logs them", async () => {
    withConfig({ cookies: "session=abc", headers: [{ name: "X-Preview", value: "tok" }] });
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    const opts = fetchPage.mock.calls[0]![1] as { extraHeaders: Record<string, string>; credentialsFor: (u: string) => boolean };
    expect(opts.extraHeaders).toMatchObject({ cookie: "session=abc", "x-preview": "tok" });
    expect(opts.credentialsFor("https://elsewhere.test/")).toBe(false);
  });

  it("test mode: obeys the live robots.txt and reports what the draft would block", async () => {
    withConfig({ customRobots: "User-agent: *\nDisallow: /a" }, { customRobotsMode: "test" });
    fetchRobots.mockResolvedValue(rulesFromBody("User-agent: *\nDisallow:", "https://example.com/robots.txt"));
    site({ "https://example.com/": ["/a"] });
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(fetched()).toContain("https://example.com/a");
    const pageA = crawlPage.create.mock.calls.map((c) => c[0].data).find((d) => d.url === "https://example.com/a");
    expect(pageA.issues.create.map((i: { ruleId: string }) => i.ruleId)).toContain("robots.would_block");
  });

  it("replace mode (verified site): the draft is what the crawl obeys", async () => {
    withConfig({ customRobots: "User-agent: *\nDisallow: /a" }, { customRobotsMode: "replace" });
    fetchRobots.mockResolvedValue(rulesFromBody("User-agent: *\nDisallow:", "https://example.com/robots.txt"));
    site({ "https://example.com/": ["/a"] });
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(fetched()).not.toContain("https://example.com/a");
  });

  it("fails the job, without crawling, when the secrets cannot be opened", async () => {
    withConfig({ cookies: "session=abc" });
    vi.stubEnv("GSC_TOKEN_ENCRYPTION_KEY", "a-different-key");
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(fetchPage).not.toHaveBeenCalled();
    expect(terminalWrite().status).toBe("FAILED");
    expect(JSON.stringify(terminalWrite())).not.toContain("session=abc");
  });
});

// ─── Link graph (Phase 4a) ─────────────────────────────────────────────────

describe("link graph", () => {
  const created = () => crawlPage.create.mock.calls.map((c) => c[0].data);

  it("stores one edge per internal target with its first anchor, nofollow and position", async () => {
    fetchPage.mockImplementation(async (url: string) => {
      const r = htmlResponse(url);
      if (url !== "https://example.com/") return r;
      return {
        ...r,
        html: r.html.replace(
          "</body>",
          '<a href="/a">First</a><a href="/a">Again</a><a href="/b" rel="nofollow">B</a><a href="https://other.test/">Out</a></body>',
        ),
      };
    });
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    const edges = crawlLink.createMany.mock.calls[0]![0].data as { toUrl: string; anchor: string; nofollow: boolean; position: number; fromPageId: string }[];
    expect(edges.map((e) => [e.toUrl, e.anchor, e.nofollow])).toEqual([
      ["https://example.com/a", "First", false],
      ["https://example.com/b", "B", true],
    ]);
    expect(edges[0]!.fromPageId).toBe("p1");
    expect(edges[1]!.position).toBe(2);
  });

  it("records the discoverer as foundOn and resolves ids in SQL before aggregation", async () => {
    fetchRobots.mockResolvedValue(allowAllRules());
    fetchPage.mockImplementation(async (url: string) => htmlResponse(url, url === "https://example.com/" ? ["/a"] : []));
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(created().find((d) => d.url === "https://example.com/a").foundOn).toBe("https://example.com/");
    expect(created().find((d) => d.url === "https://example.com/").foundOn).toBeNull();
    expect(executeRaw).toHaveBeenCalledTimes(2);
    expect(executeRaw.mock.invocationCallOrder[1]!).toBeLessThan(aggregateCrawl.mock.invocationCallOrder[0]!);
  });

  it("stores every redirect hop plus the destination, image srcs and Last-Modified", async () => {
    fetchPage.mockImplementation(async (url: string) => ({
      ...htmlResponse("https://example.com/final"),
      html: htmlResponse(url).html.replace("</body>", '<img src="/i.png" alt=""><img src="data:x" alt=""></body>'),
      redirectHops: 2,
      redirectTarget: "https://example.com/mid",
      chain: [
        { url, status: 301 },
        { url: "https://example.com/mid", status: 302 },
      ],
      lastModified: "Tue, 03 Nov 2026 10:00:00 GMT",
    }));
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(created()[0]).toMatchObject({
      redirectChain: [
        { url: "https://example.com/", status: 301 },
        { url: "https://example.com/mid", status: 302 },
        { url: "https://example.com/final", status: 200 },
      ],
      imgSrcs: ["https://example.com/i.png"],
      lastModified: "Tue, 03 Nov 2026 10:00:00 GMT",
    });
  });
});

// ─── List mode (Phase 4a) ──────────────────────────────────────────────────

describe("list mode", () => {
  function listJob(urls: string[]) {
    crawlJob.findUnique.mockResolvedValue({ id: "job_1", rootUrl: urls[0], urlCap: urls.length, status: "QUEUED", mode: "list" });
    const redis = fakeRedis();
    void redis.rpush("crawl:job_1:queue", ...urls.map((url) => JSON.stringify({ url, depth: 0 })));
    return redis;
  }

  it("fetches each listed URL once, discovers nothing, reads each host's robots.txt once", async () => {
    fetchRobots.mockImplementation(async () => allowAllRules());
    const redis = listJob(["https://a.example/1", "https://b.example/2", "https://a.example/3"]);
    fetchPage.mockImplementation(async (url: string) => htmlResponse(url, ["/linked"]));
    await runCrawl({ jobId: "job_1", redis: redis as never });
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual(["https://a.example/1", "https://b.example/2", "https://a.example/3"]);
    expect(fetchRobots.mock.calls.map((c) => new URL(c[0] as string).host).sort()).toEqual(["a.example", "b.example"]);
    expect(collectSitemapUrls).not.toHaveBeenCalled();
    expect((aggregateCrawl.mock.calls[0] as unknown[])[0]).toMatchObject({ listMode: true });
  });

  it("obeys the robots.txt of each URL's own host", async () => {
    fetchRobots.mockImplementation(async (origin: string) =>
      rulesFromBody(origin.includes("b.example") ? "User-agent: *\nDisallow: /" : "", `${origin}robots.txt`),
    );
    const redis = listJob(["https://a.example/1", "https://b.example/2"]);
    await runCrawl({ jobId: "job_1", redis: redis as never });
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual(["https://a.example/1"]);
  });

  it("a list that expired before the job ran ends list_expired, not silently empty", async () => {
    crawlJob.findUnique.mockResolvedValue({ id: "job_1", rootUrl: "https://a.example/", urlCap: 5, status: "QUEUED", mode: "list" });
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(terminalWrite()).toMatchObject({ status: "COMPLETED", stoppedReason: "list_expired", pagesCrawled: 0 });
  });
});
