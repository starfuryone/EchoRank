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

// aggregate: the monthly page allowance's sum (page-allowance.ts); a tenant row
// without planType (the default here) skips the check entirely.
const crawlJob = { findUnique: vi.fn(), update: vi.fn(), aggregate: vi.fn(async () => ({ _sum: { pagesCrawled: 0 } })) };
// `create` is not called by the runner any more: the batch goes in as
// multi-row INSERTs (createMany). The fake transaction below replays each
// buffered page row through it, with its issues nested as before, so the
// assertions in this file read one call per page. pageBatches records the
// real shape: page rows per createMany.
const crawlPage = { create: vi.fn(), findFirst: vi.fn(), count: vi.fn(async () => 0), findMany: vi.fn(async () => [] as { url: string }[]) };
const crawlIssue = { count: vi.fn(async () => 0) };
const crawlLink = { createMany: vi.fn() };
const crawlExtraction = { createMany: vi.fn() };
const pageBatches: number[] = [];
const executeRaw = vi.fn(async () => 0);
const tenantRow: { current: Record<string, unknown> } = { current: { name: "Acme", spellingAcceptedWords: ["Acmeware"] } };
vi.mock("@/lib/prisma", () => ({
  prisma: {
    crawlJob,
    crawlPage,
    crawlIssue,
    $executeRaw: (...a: unknown[]) => executeRaw(...(a as [])),
    // resolveLinkGraph's window lookup: no edge past the first window.
    $queryRaw: async () => [],
    // Spell check: the workspace's accepted words (Phase 3c).
    tenant: { findUnique: async () => tenantRow.current },
    // The runner writes a batch inside a transaction; run the callback inline.
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const pages: Record<string, unknown>[] = [];
      const issues: Record<string, unknown>[] = [];
      const out = await fn({
        crawlPage: { createMany: async ({ data }: { data: Record<string, unknown>[] }) => (pages.push(...data), { count: data.length }) },
        crawlIssue: { createMany: async ({ data }: { data: Record<string, unknown>[] }) => (issues.push(...data), { count: data.length }) },
        crawlLink,
        crawlExtraction,
      });
      pageBatches.push(pages.length);
      for (const p of pages) {
        // The nested-create shape the old row-by-row writes used: an issue without its own id or page id.
        const own = issues
          .filter((i) => i.crawlPageId === p.id)
          .map((i) => Object.fromEntries(Object.entries(i).filter(([k]) => k !== "id" && k !== "crawlPageId")));
        await crawlPage.create({ data: { ...p, issues: { create: own } } });
      }
      return out;
    },
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

  const self = {
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
    /** The runner's one script, POP_TO_INFLIGHT: LPOP count from KEYS[1], copy to KEYS[2]. */
    async eval(_script: string, _n: number, queueKey: string, inflightKey: string, count: number) {
      const list = lists.get(queueKey) ?? [];
      const items = list.splice(0, count);
      if (items.length) lists.set(inflightKey, [...items]);
      return items;
    },
    async lrange(key: string) {
      return [...(lists.get(key) ?? [])];
    },
    async smembers(key: string) {
      return [...(sets.get(key) ?? [])];
    },
    async exists(key: string) {
      return flags.has(key) || (lists.get(key)?.length ?? 0) > 0 || (sets.get(key)?.size ?? 0) > 0 ? 1 : 0;
    },
    async sismember(key: string, member: string) {
      return sets.get(key)?.has(member) ? 1 : 0;
    },
    /** Records the inlink HINCRBY batch so the dedupe rule can be asserted; SADD answers like Redis. */
    pipeline() {
      const ops: (() => Promise<unknown>)[] = [];
      const chain = {
        sadd(key: string, member: string) {
          ops.push(() => self.sadd(key, member));
          return chain;
        },
        hincrby(key: string, field: string, by: number) {
          if (key.endsWith(":inlinks")) credits.push({ field, by });
          ops.push(async () => 1);
          return chain;
        },
        hsetnx() {
          ops.push(async () => 1);
          return chain;
        },
        expire() {
          ops.push(async () => 1);
          return chain;
        },
        async exec() {
          const out: [null, unknown][] = [];
          for (const op of ops) out.push([null, await op()]);
          return out;
        },
      };
      return chain;
    },
    /** MULTI for the inflight list: DEL / RPUSH / LPUSH / EXPIRE, applied on exec. */
    multi() {
      const ops: (() => void)[] = [];
      const chain = {
        del(...keys: string[]) {
          ops.push(() => keys.forEach((k) => lists.delete(k)));
          return chain;
        },
        rpush(key: string, ...values: string[]) {
          ops.push(() => lists.set(key, [...(lists.get(key) ?? []), ...values]));
          return chain;
        },
        lpush(key: string, ...values: string[]) {
          ops.push(() => lists.set(key, [...[...values].reverse(), ...(lists.get(key) ?? [])]));
          return chain;
        },
        expire() {
          return chain;
        },
        async exec() {
          ops.forEach((op) => op());
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
  return self;
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

  it("stops cleanly at the monthly page allowance (monthly_allowance), COMPLETED, never past it", async () => {
    const { PLAN_CONFIGS } = await import("@/lib/plan-config");
    const limit = PLAN_CONFIGS.STARTER.crawlPagesPerMonth!;
    const before = tenantRow.current;
    tenantRow.current = { ...before, planType: "STARTER", source: "customer" };
    // Other crawls this month left exactly 2 pages.
    crawlJob.aggregate.mockResolvedValue({ _sum: { pagesCrawled: limit - 2 } });
    crawlJob.findUnique.mockResolvedValue({ id: "job_m", rootUrl: "https://example.com/", urlCap: 50, status: "QUEUED" });
    fetchPage.mockImplementation(async (url: string) => htmlResponse(url, ["/a", "/b", "/c", "/d", "/e"]));
    try {
      const outcome = await runCrawl({ jobId: "job_m", redis: fakeRedis() as never });
      expect(outcome.stoppedReason).toBe("monthly_allowance");
      expect(outcome.status).toBe("COMPLETED");
      expect(outcome.pagesCrawled).toBe(2);
      // The month is read with this job left out (its own count is added live).
      expect((crawlJob.aggregate.mock.calls as unknown as [{ where: unknown }][])[0]![0]).toMatchObject({ where: { id: { not: "job_m" } } });
    } finally {
      tenantRow.current = before;
      crawlJob.aggregate.mockResolvedValue({ _sum: { pagesCrawled: 0 } });
    }
  });

  it("the free crawler's system tenant is exempt from the monthly allowance", async () => {
    const before = tenantRow.current;
    tenantRow.current = { ...before, planType: "AGENCY", source: "free" };
    crawlJob.aggregate.mockClear();
    crawlJob.findUnique.mockResolvedValue({ id: "job_f", rootUrl: "https://example.com/", urlCap: 2, status: "QUEUED" });
    fetchPage.mockImplementation(async (url: string) => htmlResponse(url, ["/a", "/b"]));
    try {
      const outcome = await runCrawl({ jobId: "job_f", redis: fakeRedis() as never });
      expect(outcome.stoppedReason).not.toBe("monthly_allowance");
      expect(crawlJob.aggregate).not.toHaveBeenCalled();
    } finally {
      tenantRow.current = before;
    }
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

  it("a free crawl (system tenant, source free) stops at 10 minutes; a paid one does not", async () => {
    const at11 = () => {
      let calls = 0;
      return () => (calls++ === 0 ? 0 : 11 * 60 * 1000);
    };
    tenantRow.current = { name: "Free site crawler (system)", spellingAcceptedWords: [], source: "free" };
    try {
      expect((await runCrawl({ jobId: "job_1", redis: fakeRedis() as never, now: at11() })).stoppedReason).toBe("time_cap");
    } finally {
      tenantRow.current = { name: "Acme", spellingAcceptedWords: ["Acmeware"] };
    }
    expect((await runCrawl({ jobId: "job_1", redis: fakeRedis() as never, now: at11() })).stoppedReason).not.toBe("time_cap");
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

  it("retries the terminal write when the pool times out, so a finished crawl is not left RUNNING", async () => {
    // The 48-crawl load test: 12 crawls finishing together, the terminal write
    // waited past pg-pool's 5 s connect timeout. One retry (1 s) here.
    let failedOnce = false;
    crawlJob.update.mockImplementation(async ({ data }: { data: { finishedAt?: Date } }) => {
      if (data.finishedAt && !failedOnce) {
        failedOnce = true;
        throw new Error("timeout exceeded when trying to connect");
      }
      return {};
    });

    const outcome = await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(outcome.status).toBe("COMPLETED");
    const terminal = (crawlJob.update.mock.calls as unknown as [{ data: { finishedAt?: Date; status?: string } }][]).filter(([a]) => a.data.finishedAt);
    expect(terminal).toHaveLength(2);
    expect(terminal[1][0].data.status).toBe("COMPLETED");
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
    // The page's id is generated with the batch (row-id.ts), before its row exists.
    const p1 = crawlPage.create.mock.calls[0]![0].data.id;
    expect(p1).toMatch(/^c[0-9a-z]{24}$/);
    expect(rows).toEqual([
      { crawlJobId: "job_1", pageId: p1, extractorIndex: 1, values: ["H"] },
      { crawlJobId: "job_1", pageId: p1, extractorIndex: 2, values: ["https://example.com/"] },
    ]);
    // w19 and w190..w199
    expect(crawlPage.create.mock.calls[0]![0].data.searchHits).toEqual({ "0": 11, "1": 0 });
  });

  it("records each page's segments: URL, depth, status and extracted value (Phase 4b)", async () => {
    withConfig(
      { extractors: [{ name: "h1", kind: "css", expr: "h1" }] },
      {
        segments: [
          { name: "Root", rule: { kind: "depthMax", max: 0 } },
          { name: "A pages", rule: { kind: "urlPattern", pattern: "/a*" } },
          { name: "H is h", rule: { kind: "extractorValue", index: 0, equals: "h" } },
          { name: "OK", rule: { kind: "statusClass", cls: "2xx" } },
        ],
      },
    );
    site({ "https://example.com/": ["/a"] });
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    const byUrl = Object.fromEntries(crawlPage.create.mock.calls.map((c) => [c[0].data.url, c[0].data.segmentIds]));
    expect(byUrl).toEqual({ "https://example.com/": [0, 2, 3], "https://example.com/a": [1, 2, 3] });
  });

  it("a crawl without segments stores none", async () => {
    withConfig({});
    site({ "https://example.com/": [] });
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(crawlPage.create.mock.calls[0]![0].data.segmentIds).toEqual([]);
  });

  it("raises extraction.empty and search.match from the page's own results (Phase 4b)", async () => {
    withConfig({
      extractors: [
        { name: "Heading", kind: "css", expr: "h1" },
        { name: "Price", kind: "css", expr: "[itemprop=price]" },
      ],
      searches: [{ name: "words", pattern: "w19", isRegex: false }],
    });
    site({ "https://example.com/": [] });
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    const issues = crawlPage.create.mock.calls[0]![0].data.issues.create as { ruleId: string; evidence: unknown }[];
    expect(issues.find((i) => i.ruleId === "extraction.empty")?.evidence).toEqual({ empty: "Price", count: 1 });
    expect(issues.find((i) => i.ruleId === "search.match")?.evidence).toEqual({ searches: "words (11)", matches: 11 });
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
    const all = crawlLink.createMany.mock.calls[0]![0].data as { toUrl: string; anchor: string; nofollow: boolean; position: number; fromPageId: string; isExternal?: boolean }[];
    const edges = all.filter((e) => !e.isExternal);
    expect(edges.map((e) => [e.toUrl, e.anchor, e.nofollow])).toEqual([
      ["https://example.com/a", "First", false],
      ["https://example.com/b", "B", true],
    ]);
    // Phase 4g: the outbound link is stored too, as an external row.
    expect(all.filter((e) => e.isExternal).map((e) => [e.toUrl, e.anchor])).toEqual([["https://other.test/", "Out"]]);
    expect(edges[0]!.fromPageId).toBe(crawlPage.create.mock.calls[0]![0].data.id);
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

// ─── Phase 4e: custom JavaScript and AMP ───────────────────────────────────

describe("custom JavaScript and AMP (Phase 4e)", () => {
  const KEY = "test-key-not-a-secret";
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends the snippets with each render and stores one js row per snippet value", async () => {
    vi.stubEnv("GSC_TOKEN_ENCRYPTION_KEY", KEY);
    const config = sealCrawlConfig(
      CrawlConfigInputSchema.parse({ js: [{ name: "dl", preset: "dataLayer" }, { name: "more", preset: "loadMore", selector: "#more" }] }),
      null,
      KEY,
    );
    crawlJob.findUnique.mockResolvedValue({ id: "job_1", rootUrl: "https://example.com/", urlCap: 1, status: "QUEUED", renderMode: "all", renderCap: 5, pagesRendered: 0, config });
    fetchPage.mockImplementation(async (url: string) => htmlResponse(url));
    const bodies: { snippets?: string[] }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        bodies.push(body);
        return new Response(
          JSON.stringify({ finalUrl: body.url, status: 200, jsRedirect: null, offSite: false, html: htmlResponse(body.url).html, consoleErrors: 0, consoleSample: null, viewport: null, bodyFontPx: null, tapTargets: null, axe: null, snippets: ['[{"event":"x"}]', "error: boom"] }),
          { status: 200 },
        );
      }),
    );
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(bodies[0]!.snippets).toHaveLength(2);
    expect(bodies[0]!.snippets![0]).toContain("window.dataLayer");
    expect(bodies[0]!.snippets![1]).toContain('"#more"');
    const js = crawlExtraction.createMany.mock.calls.map((c) => c[0].data).flat().filter((r: { kind?: string }) => r.kind === "js");
    const p1 = crawlPage.create.mock.calls[0]![0].data.id;
    expect(js).toEqual([
      { crawlJobId: "job_1", pageId: p1, kind: "js", extractorIndex: 0, values: ['[{"event":"x"}]'] },
      { crawlJobId: "job_1", pageId: p1, kind: "js", extractorIndex: 1, values: ["error: boom"] },
    ]);
  });

  it("queues a page's rel=amphtml target, and stores ampHtml / isAmp", async () => {
    crawlJob.findUnique.mockResolvedValue({ id: "job_1", rootUrl: "https://example.com/", urlCap: 10, status: "QUEUED" });
    fetchPage.mockImplementation(async (url: string) => {
      const r = htmlResponse(url);
      if (url === "https://example.com/") r.html = r.html.replace("</head>", '<link rel="amphtml" href="/amp/"></head>');
      if (url === "https://example.com/amp") r.html = r.html.replace("<html>", "<html amp>");
      return r;
    });
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    // Normalised like every crawled URL, so the stored ampHtml joins the AMP page's row.
    expect(fetchPage.mock.calls.map((c) => c[0])).toContain("https://example.com/amp");
    const rows = crawlPage.create.mock.calls.map((c) => c[0].data);
    expect(rows.find((r) => r.url === "https://example.com/")).toMatchObject({ ampHtml: "https://example.com/amp", isAmp: false });
    expect(rows.find((r) => r.url === "https://example.com/amp")).toMatchObject({ isAmp: true });
  });
});

// ─── Phase 4e: forms login ─────────────────────────────────────────────────

describe("forms login (Phase 4e)", () => {
  const KEY = "test-key-not-a-secret";
  const loginInput = {
    loginUrl: "https://example.com/login",
    usernameSelector: "#u",
    passwordSelector: "#p",
    submitSelector: "#go",
    successCheck: { kind: "urlPrefix" as const, value: "https://example.com/account" },
    username: "ada",
    password: "pw-very-secret",
  };
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function crawlWith(sidecar: unknown) {
    vi.stubEnv("GSC_TOKEN_ENCRYPTION_KEY", KEY);
    const { sealLogin } = await import("@/lib/site-crawler/login");
    const config = { ...sealCrawlConfig(CrawlConfigInputSchema.parse({}), null, KEY), login: sealLogin(loginInput, null, KEY) };
    crawlJob.findUnique.mockResolvedValue({ id: "job_1", rootUrl: "https://example.com/", urlCap: 20, status: "QUEUED", config });
    const loginCalls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        loginCalls.push(url);
        expect(url.endsWith("/login")).toBe(true);
        expect(JSON.parse(init.body as string).password).toBe("pw-very-secret");
        return new Response(JSON.stringify(sidecar), { status: 200 });
      }),
    );
    fetchPage.mockImplementation(async (url: string) => {
      const r = htmlResponse(url, url === "https://example.com/" ? ["/account", "/logout", "/blog"] : []);
      if (url === "https://example.com/") r.html = r.html.replace("</body>", '<a href="/bye">Sign out</a><a rel="nofollow" href="/private">p</a></body>');
      return r;
    });
    const store = new Map<string, string>();
    const deleted: string[] = [];
    const redis = {
      ...fakeRedis(),
      get: async (k: string) => store.get(k) ?? null,
      set: async (k: string, v: string) => (store.set(k, v), "OK"),
      del: async (...keys: string[]) => (deleted.push(...keys), keys.length),
    };
    await runCrawl({ jobId: "job_1", redis: redis as never });
    return { loginCalls, store, deleted };
  }

  it("logs in once, sends the session to the site only, never follows logout or nofollow links", async () => {
    const { loginCalls, store, deleted } = await crawlWith({ ok: true, cookies: [{ name: "sid", value: "s3", domain: "example.com", path: "/" }] });
    expect(loginCalls).toHaveLength(1);
    const opts = fetchPage.mock.calls[0]![1];
    expect(opts.cookiesFor("https://example.com/account")).toBe("sid=s3");
    expect(opts.cookiesFor("https://cdn.other.net/x")).toBeNull();
    const fetched = fetchPage.mock.calls.map((c) => c[0] as string);
    expect(fetched).toEqual(expect.arrayContaining(["https://example.com/account", "https://example.com/blog"]));
    expect(fetched.some((u) => /logout|bye|private/.test(u))).toBe(false);
    // The jar was in Redis encrypted for the crawl, and is deleted when it ends.
    expect([...store.values()].join("")).not.toContain("s3");
    expect(deleted).toContain("crawl:job_1:login");
    expect(terminalWrite()).toMatchObject({ status: "COMPLETED", summary: expect.objectContaining({ login: { status: "ok" } }) });
  });

  it("a failed login does not fail the crawl: it runs without the session and says why", async () => {
    await crawlWith({ ok: false, reason: "success_check_failed" });
    expect(fetchPage.mock.calls[0]![1].cookiesFor).toBeUndefined();
    expect(terminalWrite()).toMatchObject({ status: "COMPLETED", summary: expect.objectContaining({ login: { status: "failed", reason: "success_check_failed" } }) });
    // Unauthenticated, ordinary rules apply: the logout URL is just a link (rel=nofollow still not followed by default).
    expect(fetchPage.mock.calls.map((c) => c[0])).toContain("https://example.com/logout");
  });
});

// ─── Phase 4g: external links ──────────────────────────────────────────────

describe("external links (Phase 4g)", () => {
  it("stores outbound links per page, deduped by URL, at most 50, never as internal edges", async () => {
    crawlJob.findUnique.mockResolvedValue({ id: "job_1", rootUrl: "https://example.com/", urlCap: 1, status: "QUEUED" });
    const outbound = [...Array.from({ length: 60 }, (_, i) => `https://other${i}.net/p`), "https://other0.net/p", "mailto:x@example.org"];
    fetchPage.mockImplementation(async (url: string) => htmlResponse(url, ["/in", ...outbound]));
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    const edges = crawlLink.createMany.mock.calls.flatMap((c) => c[0].data) as { toUrl: string; isExternal?: boolean }[];
    const ext = edges.filter((e) => e.isExternal);
    expect(ext).toHaveLength(50);
    expect(new Set(ext.map((e) => e.toUrl)).size).toBe(50);
    expect(ext.every((e) => /^https:\/\/other\d+\.net\/p$/.test(e.toUrl))).toBe(true);
    expect(edges.filter((e) => !e.isExternal).map((e) => e.toUrl)).toEqual(["https://example.com/in"]);
  });
});

// ─── Phase 4g: text snippets for the post-crawl AI / semantic steps ────────

describe("text snippets (Phase 4g)", () => {
  const KEY = "test-key-not-a-secret";
  afterEach(() => vi.unstubAllEnvs());
  const crawl = async (input: Record<string, unknown> | null) => {
    vi.stubEnv("GSC_TOKEN_ENCRYPTION_KEY", KEY);
    const config = input ? sealCrawlConfig(CrawlConfigInputSchema.parse(input), null, KEY) : undefined;
    crawlJob.findUnique.mockResolvedValue({ id: "job_1", rootUrl: "https://example.com/", urlCap: 1, status: "QUEUED", ...(config ? { config } : {}) });
    fetchPage.mockImplementation(async (url: string) => {
      const r = htmlResponse(url);
      r.html = r.html.replace("</body>", `<p>${"long ".repeat(2000)}</p></body>`);
      return r;
    });
    await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    return crawlPage.create.mock.calls[0]![0].data.textSnippet as string | undefined;
  };

  it("keeps the visible text, at most 6,000 chars, when AI prompts or semantic duplicates are opted in", async () => {
    const withAi = await crawl({ ai: { provider: "claude", prompts: [{ preset: "summary" }], top: { pages: 5, segment: null } } });
    expect(withAi).toContain("w1 w2 w3");
    expect(withAi!.length).toBe(6000);
    crawlPage.create.mockClear();
    expect((await crawl({ semantic: { pages: 5, segment: null } }))?.length).toBe(6000);
  });

  it("keeps nothing otherwise", async () => {
    expect(await crawl(null)).toBeUndefined();
  });
});

// ─── Batched writes and restarts (crawl concurrency) ────────────────────────

describe("batched writes and restarts", () => {
  const ROOT = "https://example.com/";
  const PAGES = Array.from({ length: 59 }, (_, i) => `https://example.com/p${i + 1}`);
  /** Every page row written so far, across runs (the fake Postgres). */
  let written: string[] = [];

  beforeEach(() => {
    written = [];
    pageBatches.length = 0;
    crawlJob.findUnique.mockResolvedValue({ id: "job_1", tenantId: "t1", rootUrl: ROOT, urlCap: 100, status: "QUEUED", startedAt: null, pagesRendered: 0 });
    fetchPage.mockImplementation(async (url: string) => htmlResponse(url, url === ROOT ? PAGES : []));
    crawlPage.create.mockImplementation(async ({ data }: { data: { url: string } }) => {
      written.push(data.url);
      return { id: "x" };
    });
    crawlPage.count.mockImplementation(async () => written.length);
    crawlPage.findMany.mockImplementation((async ({ where }: { where: { url: { in: string[] } } }) =>
      written.filter((u) => where.url.in.includes(u)).map((url) => ({ url }))) as never);
  });

  it("writes a batch as multi-row INSERTs: 60 pages in four page statements (the root, 25, 25, 9), not 60", async () => {
    const outcome = await runCrawl({ jobId: "job_1", redis: fakeRedis() as never });
    expect(outcome).toMatchObject({ status: "COMPLETED", pagesCrawled: 60 });
    expect(pageBatches).toEqual([1, 25, 25, 9]);
    expect(new Set(written).size).toBe(60);
  });

  it("a shutdown mid-crawl returns INTERRUPTED: rows written, row left RUNNING, frontier kept, nothing cleaned up", async () => {
    const redis = fakeRedis();
    const outcome = await runCrawl({ jobId: "job_1", redis: redis as never, shouldStop: () => pageBatches.length >= 2 });
    expect(outcome).toMatchObject({ status: "INTERRUPTED", pagesCrawled: 26 });
    expect(written).toHaveLength(26);
    // No terminal write: the last update is the batch's progress, not a status.
    expect(crawlJob.update.mock.calls.some((c) => (c[0] as { data: { status?: string } }).data.status === "COMPLETED")).toBe(false);
    expect(aggregateCrawl).not.toHaveBeenCalled();
    expect(redis.lists.get("crawl:job_1:queue")).toHaveLength(34);
    expect(redis.lists.get("crawl:job_1:inflight") ?? []).toEqual([]);
  });

  it("a stop inside a batch writes the pages in hand and hands the untouched rest back to inflight", async () => {
    const redis = fakeRedis();
    let fetched = 0;
    fetchPage.mockImplementation(async (url: string) => (fetched++, htmlResponse(url, url === ROOT ? PAGES : [])));
    // The root's batch is one page; stop once the second batch has started fetching.
    const outcome = await runCrawl({ jobId: "job_1", redis: redis as never, shouldStop: () => fetched >= 5 });
    expect(outcome.status).toBe("INTERRUPTED");
    const inflight = redis.lists.get("crawl:job_1:inflight") ?? [];
    expect(written.length + inflight.length + (redis.lists.get("crawl:job_1:queue")?.length ?? 0)).toBe(60);
    expect(inflight.length).toBeGreaterThan(0);
    for (const raw of inflight) expect(written).not.toContain(JSON.parse(raw).url);
  });

  it("the next process resumes it: every page exactly once, counts from Postgres, the first start kept", async () => {
    const redis = fakeRedis();
    await runCrawl({ jobId: "job_1", redis: redis as never, shouldStop: () => pageBatches.length >= 2 });
    expect(written).toHaveLength(26);
    const firstStart = new Date(Date.now() - 60_000);
    crawlJob.findUnique.mockResolvedValue({ id: "job_1", tenantId: "t1", rootUrl: ROOT, urlCap: 100, status: "RUNNING", startedAt: firstStart, pagesRendered: 0 });
    crawlJob.update.mockClear();
    const outcome = await runCrawl({ jobId: "job_1", redis: redis as never, resume: true });
    expect(outcome).toMatchObject({ status: "COMPLETED", pagesCrawled: 60 });
    expect(written).toHaveLength(60);
    expect(new Set(written).size).toBe(60);
    // A resume never re-stamps startedAt (the one-hour clock is the crawl's).
    expect(crawlJob.update.mock.calls.some((c) => "startedAt" in (c[0] as { data: object }).data)).toBe(false);
  });

  it("a crash after the rows were written but before inflight was cleared: those pages are not fetched again", async () => {
    const redis = fakeRedis();
    // The state a SIGKILL leaves between the transaction and the inflight clear:
    // the root and p1 written, both still in inflight, p2 and p3 queued.
    written = [ROOT, PAGES[0]!];
    redis.sets.set("crawl:job_1:seen", new Set([ROOT, ...PAGES.slice(0, 3)]));
    redis.lists.set("crawl:job_1:inflight", [JSON.stringify({ url: PAGES[0], depth: 1 }), JSON.stringify({ url: PAGES[1], depth: 1 })]);
    redis.lists.set("crawl:job_1:queue", [JSON.stringify({ url: PAGES[2], depth: 1 })]);
    crawlJob.findUnique.mockResolvedValue({ id: "job_1", tenantId: "t1", rootUrl: ROOT, urlCap: 100, status: "RUNNING", startedAt: new Date(), pagesRendered: 0 });
    fetchPage.mockClear();
    const outcome = await runCrawl({ jobId: "job_1", redis: { ...redis, exists: async (k: string) => (k.endsWith(":seen") ? 1 : 0) } as never, resume: true });
    const fetchedUrls = fetchPage.mock.calls.map((c) => c[0]);
    // p1 (written) is not fetched again; p2 (in flight, no row) is, first, then p3.
    expect(fetchedUrls).toEqual([PAGES[1], PAGES[2]]);
    expect(outcome).toMatchObject({ status: "COMPLETED", pagesCrawled: 4 });
    expect(new Set(written).size).toBe(written.length);
  });

  it("a re-done batch credits inlinks once: the credited set remembers the source pages", async () => {
    const redis = fakeRedis();
    // The crash between the credits and the rows: the root was credited, never written.
    redis.sets.set("crawl:job_1:seen", new Set([ROOT]));
    redis.sets.set("crawl:job_1:credited", new Set([ROOT]));
    redis.lists.set("crawl:job_1:inflight", [JSON.stringify({ url: ROOT, depth: 0 })]);
    crawlJob.findUnique.mockResolvedValue({ id: "job_1", tenantId: "t1", rootUrl: ROOT, urlCap: 1, status: "RUNNING", startedAt: new Date(), pagesRendered: 0 });
    await runCrawl({ jobId: "job_1", redis: { ...redis, exists: async (k: string) => (k.endsWith(":seen") ? 1 : 0) } as never, resume: true });
    expect(written).toEqual([ROOT]);
    expect(credits).toEqual([]);
  });

  it("a resume whose frontier expired fails the crawl and says why, rather than re-crawling from the root", async () => {
    crawlJob.findUnique.mockResolvedValue({ id: "job_1", tenantId: "t1", rootUrl: ROOT, urlCap: 100, status: "RUNNING", startedAt: new Date(), pagesRendered: 0 });
    const outcome = await runCrawl({ jobId: "job_1", redis: fakeRedis() as never, resume: true });
    expect(outcome.status).toBe("FAILED");
    expect(outcome.stoppedReason).toMatch(/^frontier_lost/);
    expect(fetchPage).not.toHaveBeenCalled();
  });
});
