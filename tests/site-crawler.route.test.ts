// Site Crawler routes — auth on every endpoint, tenant isolation, quota
// enforcement, and the guard order.
//
// Prisma, the session guard, Redis and the queue are stubbed; everything else
// (zod, URL validation, quota arithmetic, DTO shaping, error mapping) is the
// real code path. No crawl is ever started and no socket is ever opened.
//
// The two properties worth stating plainly, because they are the ones a
// refactor could quietly break:
//   1. every endpoint refuses an unauthenticated caller with 401
//   2. another workspace's crawl id is a 404, never a leak

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanType } from "@/generated/prisma";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const crawlJob = {
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
};
const crawlPage = { findMany: vi.fn(), count: vi.fn() };
const crawlIssue = { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() };
const queryRaw = vi.fn();
const crawlSiteDefault = { findUnique: vi.fn(), upsert: vi.fn() };
const crawlSegment = { findMany: vi.fn() };
vi.mock("@/lib/prisma", () => ({
  prisma: { crawlJob, crawlPage, crawlIssue, crawlSiteDefault, crawlSegment, crawlPageMetric: { groupBy: async () => [] }, $queryRaw: (...a: unknown[]) => queryRaw(...a) },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, remaining: 2 })),
}));

const addJob = vi.fn<(...a: unknown[]) => Promise<{ id: string }>>(async () => ({
  id: "bull_1",
}));
vi.mock("@/infrastructure/queue/registry", () => ({ addJob: (...a: unknown[]) => addJob(...a) }));

const redisSet = vi.fn(async () => "OK");
const redisRpush = vi.fn(async () => 1);
const redisSadd = vi.fn(async () => 1);
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => ({ set: redisSet, rpush: redisRpush, sadd: redisSadd, expire: async () => 1 }),
}));

// ─── Subjects ───────────────────────────────────────────────────────────────

const { POST: startCrawl, GET: listCrawls } = await import("@/app/api/seo/v1/crawl/route");
const { GET: getCrawl } = await import("@/app/api/seo/v1/crawl/[id]/route");
const { GET: getIssues } = await import("@/app/api/seo/v1/crawl/[id]/issues/route");
const { GET: getPages } = await import("@/app/api/seo/v1/crawl/[id]/pages/route");
const { POST: cancel } = await import("@/app/api/seo/v1/crawl/[id]/cancel/route");
const { GET: exportCsv } = await import("@/app/api/seo/v1/crawl/[id]/export/route");
const { GET: getSummary } = await import("@/app/api/seo/v1/crawl/[id]/summary/route");
const { GET: getRules } = await import("@/app/api/seo/v1/crawl/[id]/rules/route");
const { GET: getRulePages } = await import("@/app/api/seo/v1/crawl/[id]/rules/[ruleId]/route");
const ruleParams = (id: string, ruleId: string) => ({ params: Promise.resolve({ id, ruleId }) });
const { GET: getDuplicates } = await import("@/app/api/seo/v1/crawl/[id]/duplicates/route");
const { GET: getRedirects } = await import("@/app/api/seo/v1/crawl/[id]/redirects/route");

const TENANT = "tenant_a";
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function authed(plan: PlanType = "GROWTH") {
  requirePaidPlan.mockResolvedValue({ tenantId: TENANT, tenant: { planType: plan } });
}

function unauthenticated() {
  // requireTenant()'s sentinel, which the mapper turns into a 401.
  requirePaidPlan.mockRejectedValue(new Error("Not authenticated"));
}

function postRequest(body: unknown) {
  return new Request("https://app.test/api/seo/v1/crawl", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const JOB_ROW = {
  id: "crawl_1",
  tenantId: TENANT,
  rootUrl: "https://example.com/",
  status: "COMPLETED",
  urlCap: 5000,
  pagesCrawled: 12,
  issueCount: 3,
  stoppedReason: null,
  startedAt: new Date("2026-08-05T00:00:00Z"),
  finishedAt: new Date("2026-08-05T00:05:00Z"),
  createdAt: new Date("2026-08-05T00:00:00Z"),
};

/** groupBy answers by its `by`: severity totals vs the per-rule tally. */
function bySeverityOrType(typeRows: unknown[], severityRows: unknown[]) {
  crawlIssue.groupBy.mockImplementation(async (args: { by: string[] }) =>
    args.by.includes("severity") ? severityRows : typeRows,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  crawlJob.count.mockResolvedValue(0);
  crawlJob.findMany.mockResolvedValue([]);
  crawlIssue.groupBy.mockResolvedValue([]);
  crawlIssue.count.mockResolvedValue(0);
  crawlIssue.findMany.mockResolvedValue([]);
  crawlPage.count.mockResolvedValue(0);
  crawlPage.findMany.mockResolvedValue([]);
  queryRaw.mockResolvedValue([]);
  crawlSegment.findMany.mockResolvedValue([]);
});

// ─── Auth ───────────────────────────────────────────────────────────────────

describe("authentication", () => {
  const endpoints: [string, () => Promise<Response>][] = [
    ["POST /crawl", () => startCrawl(postRequest({ url: "https://example.com" }))],
    ["GET /crawl", () => listCrawls()],
    ["GET /crawl/[id]", () => getCrawl(new Request("https://app.test/x"), params("crawl_1"))],
    [
      "GET /crawl/[id]/issues",
      () => getIssues(new Request("https://app.test/x"), params("crawl_1")),
    ],
    ["GET /crawl/[id]/pages", () => getPages(new Request("https://app.test/x"), params("crawl_1"))],
    ["POST /crawl/[id]/cancel", () => cancel(new Request("https://app.test/x"), params("crawl_1"))],
    [
      "GET /crawl/[id]/export",
      () => exportCsv(new Request("https://app.test/x"), params("crawl_1")),
    ],
    [
      "GET /crawl/[id]/summary",
      () => getSummary(new Request("https://app.test/x"), params("crawl_1")),
    ],
    [
      "GET /crawl/[id]/duplicates",
      () => getDuplicates(new Request("https://app.test/x"), params("crawl_1")),
    ],
    [
      "GET /crawl/[id]/redirects",
      () => getRedirects(new Request("https://app.test/x"), params("crawl_1")),
    ],
    ["GET /crawl/[id]/rules", () => getRules(new Request("https://app.test/x"), params("crawl_1"))],
    [
      "GET /crawl/[id]/rules/[ruleId]",
      () => getRulePages(new Request("https://app.test/x"), ruleParams("crawl_1", "h1.missing")),
    ],
  ];

  for (const [name, call] of endpoints) {
    it(`${name} refuses an unauthenticated caller with 401`, async () => {
      unauthenticated();
      const res = await call();
      expect(res.status, name).toBe(401);
    });
  }
});

// ─── Tenant isolation ───────────────────────────────────────────────────────

describe("tenant isolation", () => {
  const endpoints: [string, () => Promise<Response>][] = [
    ["GET /crawl/[id]", () => getCrawl(new Request("https://app.test/x"), params("other_tenant"))],
    [
      "GET /crawl/[id]/issues",
      () => getIssues(new Request("https://app.test/x"), params("other_tenant")),
    ],
    [
      "GET /crawl/[id]/pages",
      () => getPages(new Request("https://app.test/x"), params("other_tenant")),
    ],
    [
      "POST /crawl/[id]/cancel",
      () => cancel(new Request("https://app.test/x"), params("other_tenant")),
    ],
    [
      "GET /crawl/[id]/export",
      () => exportCsv(new Request("https://app.test/x"), params("other_tenant")),
    ],
    [
      "GET /crawl/[id]/summary",
      () => getSummary(new Request("https://app.test/x"), params("other_tenant")),
    ],
    [
      "GET /crawl/[id]/duplicates",
      () => getDuplicates(new Request("https://app.test/x"), params("other_tenant")),
    ],
    [
      "GET /crawl/[id]/redirects",
      () => getRedirects(new Request("https://app.test/x"), params("other_tenant")),
    ],
    ["GET /crawl/[id]/rules", () => getRules(new Request("https://app.test/x"), params("other_tenant"))],
    [
      "GET /crawl/[id]/rules/[ruleId]",
      () => getRulePages(new Request("https://app.test/x"), ruleParams("other_tenant", "h1.missing")),
    ],
  ];

  for (const [name, call] of endpoints) {
    it(`${name} returns 404 for another workspace's id`, async () => {
      authed();
      // The lookup filters on id AND tenantId, so a foreign id finds nothing.
      crawlJob.findFirst.mockResolvedValue(null);
      const res = await call();
      expect(res.status, name).toBe(404);
    });
  }

  it("always scopes the lookup by tenantId", async () => {
    authed();
    crawlJob.findFirst.mockResolvedValue(JOB_ROW);
    await getCrawl(new Request("https://app.test/x"), params("crawl_1"));

    const where = crawlJob.findFirst.mock.calls[0]![0]!.where;
    expect(where).toMatchObject({ id: "crawl_1", tenantId: TENANT });
  });

  it("scopes the list to the caller's tenant", async () => {
    authed();
    await listCrawls();
    expect(crawlJob.findMany.mock.calls[0]![0]!.where).toEqual({ tenantId: TENANT });
  });

  it("History (?history=1): tenant-scoped, exact site and status, cursor pages of 20, sites, health and kinds", async () => {
    authed();
    const row = (i: number) => ({ ...JOB_ROW, id: `c${i}`, scheduleId: i === 0 ? "sch_1" : null, summary: { health: { score: 64 }, issuesByKind: { issue: 4, warning: 2, opportunity: 1 } } });
    crawlJob.findFirst.mockResolvedValue({ id: "c_prev", createdAt: new Date("2026-11-01T00:00:00Z") });
    crawlJob.findMany
      .mockResolvedValueOnce(Array.from({ length: 21 }, (_, i) => row(i)))
      .mockResolvedValueOnce([{ rootUrl: "https://b.example/" }, { rootUrl: "https://a.example/x" }, { rootUrl: "http://a.example/" }, { rootUrl: "nope" }]);
    crawlJob.count.mockResolvedValue(51);
    const res = await listCrawls(new Request("https://app.test/api/seo/v1/crawl?history=1&host=Shop.example&status=STOPPED&cursor=c_prev"));
    // The cursor is read tenant-scoped.
    expect(crawlJob.findFirst.mock.calls[0]![0]!.where).toEqual({ id: "c_prev", tenantId: TENANT });
    const args = crawlJob.findMany.mock.calls[0]![0]!;
    const where = {
      tenantId: TENANT,
      AND: [
        {
          OR: [
            { rootUrl: { startsWith: "http://shop.example/", mode: "insensitive" } },
            { rootUrl: { equals: "http://shop.example", mode: "insensitive" } },
            { rootUrl: { startsWith: "https://shop.example/", mode: "insensitive" } },
            { rootUrl: { equals: "https://shop.example", mode: "insensitive" } },
          ],
        },
        { status: "COMPLETED", stoppedReason: { in: ["url_cap", "time_cap"] } },
      ],
    };
    const created = new Date("2026-11-01T00:00:00Z");
    expect(args.where).toEqual({ AND: [where, { OR: [{ createdAt: { lt: created } }, { createdAt: created, id: { lt: "c_prev" } }] }] });
    expect(args).toMatchObject({ take: 21, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    expect(crawlJob.count.mock.calls[0]![0]!.where).toEqual(where);
    // The site list is the tenant's, whatever the filters.
    expect(crawlJob.findMany.mock.calls[1]![0]!.where).toEqual({ tenantId: TENANT });
    const body = await res.json();
    expect(body).toMatchObject({ total: 51, pageSize: 20, nextCursor: "c19", hosts: ["a.example", "b.example"] });
    expect(body.crawls).toHaveLength(20);
    expect(body.crawls[0]).toMatchObject({ health: 64, kinds: { issue: 4, warning: 2, opportunity: 1 }, scheduled: true });
    expect(body.crawls[1].scheduled).toBe(false);

    // An unknown status filters nothing rather than everything; another tenant's (or a missing) cursor is page 1.
    crawlJob.findMany.mockReset();
    crawlJob.findMany.mockResolvedValue([]);
    crawlJob.findFirst.mockResolvedValue(null);
    const last = await listCrawls(new Request("https://app.test/api/seo/v1/crawl?history=1&status=BOGUS&cursor=other_tenant"));
    expect(crawlJob.findMany.mock.calls[0]![0]!.where).toEqual({ AND: [{ tenantId: TENANT, AND: [] }, {}] });
    expect((await last.json()).nextCursor).toBeNull();
  });

  it("History status filters: Completed is a clean finish; Failed includes an expired list", async () => {
    authed();
    crawlJob.findMany.mockResolvedValue([]);
    const whereFor = async (status: string) => {
      crawlJob.findMany.mockClear();
      await listCrawls(new Request(`https://app.test/api/seo/v1/crawl?history=1&status=${status}`));
      return crawlJob.findMany.mock.calls[0]![0]!.where.AND[0].AND[0];
    };
    expect(await whereFor("COMPLETED")).toEqual({ status: "COMPLETED", stoppedReason: null });
    expect(await whereFor("FAILED")).toEqual({ OR: [{ status: "FAILED" }, { status: "COMPLETED", stoppedReason: "list_expired" }] });
    expect(await whereFor("CANCELLED")).toEqual({ status: "CANCELLED" });
    expect(await whereFor("ACTIVE")).toEqual({ status: { in: ["QUEUED", "RUNNING"] } });
  });
});

// ─── Start ──────────────────────────────────────────────────────────────────

describe("POST /crawl", () => {
  it("creates a queued crawl and enqueues the job", async () => {
    authed("GROWTH");
    crawlJob.create.mockResolvedValue({ ...JOB_ROW, status: "QUEUED" });

    const res = await startCrawl(postRequest({ url: "https://example.com" }));
    expect(res.status).toBe(202);

    // The cap is copied from the plan, never taken from the request.
    expect(crawlJob.create.mock.calls[0]![0]!.data).toMatchObject({
      tenantId: TENANT,
      urlCap: 5000,
      status: "QUEUED",
    });
    expect(addJob).toHaveBeenCalledWith(
      "site-crawl",
      "crawl",
      expect.objectContaining({ tenantId: TENANT }),
    );
  });

  it("defaults to render mode none and copies the plan's rendered-page cap", async () => {
    authed("GROWTH");
    crawlJob.create.mockResolvedValue({ ...JOB_ROW, status: "QUEUED" });
    await startCrawl(postRequest({ url: "https://example.com" }));
    expect(crawlJob.create.mock.calls[0]![0]!.data).toMatchObject({ renderMode: "none", renderCap: 500 });
  });

  it("accepts a render mode, capped by the plan, never by the request", async () => {
    authed("STARTER");
    crawlJob.create.mockResolvedValue({ ...JOB_ROW, status: "QUEUED" });
    const res = await startCrawl(postRequest({ url: "https://example.com", renderMode: "all", renderCap: 99999 }));
    expect(res.status).toBe(202);
    expect(crawlJob.create.mock.calls[0]![0]!.data).toMatchObject({ renderMode: "all", renderCap: 100 });
  });

  it("rejects an unknown render mode with 400", async () => {
    authed();
    const res = await startCrawl(postRequest({ url: "https://example.com", renderMode: "everything" }));
    expect(res.status).toBe(400);
    expect(crawlJob.create).not.toHaveBeenCalled();
  });

  it("rejects a malformed body with 400", async () => {
    authed();
    const res = await startCrawl(postRequest({}));
    expect(res.status).toBe(400);
    expect(crawlJob.create).not.toHaveBeenCalled();
  });

  it("rejects a private-network URL with 400 and never enqueues", async () => {
    authed();
    for (const url of ["http://127.0.0.1/", "http://169.254.169.254/", "http://box.internal/"]) {
      const res = await startCrawl(postRequest({ url }));
      expect(res.status, url).toBe(400);
    }
    expect(addJob).not.toHaveBeenCalled();
  });

  it("accepts a legacy AI_VISIBILITY row, folded onto STARTER", async () => {
    // The tier is retired and no sellable tier is crawl-locked, so the
    // PLAN_LOCKED branch is a retained guard rather than a reachable state.
    authed("AI_VISIBILITY");
    const res = await startCrawl(postRequest({ url: "https://example.com" }));
    expect(res.status).toBe(202);
  });

  it("refuses once the monthly allowance is spent, with 429", async () => {
    authed("STARTER");
    crawlJob.count.mockResolvedValue(4); // STARTER allows 4
    const res = await startCrawl(postRequest({ url: "https://example.com" }));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("QUOTA_EXCEEDED");
    expect(addJob).not.toHaveBeenCalled();
  });

  describe("configuration (Phase 4a)", () => {
    beforeEach(() => {
      vi.stubEnv("GSC_TOKEN_ENCRYPTION_KEY", "test-key-not-a-secret");
      crawlSiteDefault.findUnique.mockResolvedValue(null);
    });

    it("copies the host's saved segments onto the crawl, capped by the plan (Phase 4b)", async () => {
      authed("STARTER");
      crawlJob.create.mockResolvedValue({ ...JOB_ROW, status: "QUEUED" });
      crawlSegment.findMany.mockResolvedValue([
        { name: "Blog", rule: { kind: "urlPattern", pattern: "/blog/*" } },
        { name: "Broken", rule: { kind: "statusClass", cls: "4xx" } },
        { name: "Bad", rule: { kind: "nope" } },
      ]);
      await startCrawl(postRequest({ url: "https://www.example.com/x" }));
      expect(crawlSegment.findMany.mock.calls[0]![0]).toMatchObject({
        where: { tenantId: TENANT, host: "www.example.com" },
        orderBy: { position: "asc" },
        take: 3,
      });
      expect(crawlJob.create.mock.calls[0]![0]!.data.config.segments).toEqual([
        { name: "Blog", rule: { kind: "urlPattern", pattern: "/blog/*" } },
        { name: "Broken", rule: { kind: "statusClass", cls: "4xx" } },
      ]);
    });

    it("a host without segments keeps a config-less crawl config-less", async () => {
      authed("GROWTH");
      crawlJob.create.mockResolvedValue({ ...JOB_ROW, status: "QUEUED" });
      await startCrawl(postRequest({ url: "https://example.com" }));
      expect(crawlJob.create.mock.calls[0]![0]!.data.config).toBeUndefined();
    });

    it("stores the config sealed and lowers the URL cap to max URLs", async () => {
      authed("GROWTH");
      crawlJob.create.mockResolvedValue({ ...JOB_ROW, status: "QUEUED" });
      const res = await startCrawl(postRequest({ url: "https://example.com", config: { maxUrls: 300, cookies: "sid=secret" } }));
      expect(res.status).toBe(202);
      const data = crawlJob.create.mock.calls[0]![0]!.data;
      expect(data.urlCap).toBe(300);
      expect(JSON.stringify(data.config)).not.toContain("sid=secret");
    });

    it("never raises the cap above the plan's", async () => {
      authed("STARTER");
      crawlJob.create.mockResolvedValue({ ...JOB_ROW, status: "QUEUED" });
      await startCrawl(postRequest({ url: "https://example.com", config: { maxUrls: 1_000_000 } }));
      expect(crawlJob.create.mock.calls[0]![0]!.data.urlCap).toBe(2500);
    });

    it("a custom robots.txt runs in test mode on an unverified site, replace mode on a verified one", async () => {
      authed("GROWTH");
      crawlJob.create.mockResolvedValue({ ...JOB_ROW, status: "QUEUED" });
      await startCrawl(postRequest({ url: "https://example.com", config: { customRobots: "User-agent: *\nDisallow: /x" } }));
      expect(crawlJob.create.mock.calls[0]![0]!.data.config.customRobotsMode).toBe("test");
      crawlSiteDefault.findUnique.mockResolvedValue({ verifiedAt: new Date(), config: null });
      await startCrawl(postRequest({ url: "https://example.com", config: { customRobots: "User-agent: *\nDisallow: /x" } }));
      expect(crawlJob.create.mock.calls[1]![0]!.data.config.customRobotsMode).toBe("replace");
    });

    it("refuses verified-only options on an unverified site, before spending quota", async () => {
      authed("STARTER");
      crawlJob.count.mockResolvedValue(4);
      const res = await startCrawl(postRequest({ url: "https://example.com", config: { userAgent: "googlebot_desktop" } }));
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: "INVALID_CONFIG", problems: [{ field: "userAgent", code: "requires_verified_site" }] });
      expect(crawlJob.create).not.toHaveBeenCalled();
    });

    it("saves the config as the site's default when asked", async () => {
      authed("GROWTH");
      crawlJob.create.mockResolvedValue({ ...JOB_ROW, status: "QUEUED" });
      await startCrawl(postRequest({ url: "https://www.example.com/x", config: { speed: 1 }, saveAsDefault: true }));
      expect(crawlSiteDefault.upsert.mock.calls[0]![0]).toMatchObject({
        where: { tenantId_host: { tenantId: TENANT, host: "www.example.com" } },
        update: { config: expect.objectContaining({ speed: 1 }) },
      });
    });

    it("never echoes secrets in the response", async () => {
      authed("GROWTH");
      crawlJob.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({ ...JOB_ROW, ...args.data }));
      const res = await startCrawl(postRequest({ url: "https://example.com", config: { basicAuth: { user: "u", password: "pw-123" } } }));
      const body = await res.text();
      expect(body).not.toContain("pw-123");
      expect(JSON.parse(body).config.basicAuth).toEqual({ user: "u", password: { set: true } });
    });
  });

  describe("list mode (Phase 4a)", () => {
    const listPost = (urls: string[], extra: Record<string, unknown> = {}) =>
      startCrawl(postRequest({ mode: "list", urls, ...extra }));

    it("seeds the frontier with the guarded list, any host, and sizes the cap to it", async () => {
      authed("GROWTH");
      crawlJob.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({ ...JOB_ROW, ...args.data }));
      const res = await listPost(["https://a.example.com/x", "https://b.example.org/", "http://127.0.0.1/", "url", "https://a.example.com/x"]);
      expect(res.status).toBe(202);
      expect(await res.json()).toMatchObject({ mode: "list", listSkipped: 2 });
      expect(crawlJob.create.mock.calls[0]![0]!.data).toMatchObject({ mode: "list", urlCap: 2, rootUrl: "https://a.example.com/x" });
      const pushed = (redisRpush.mock.calls as unknown as [string, ...string[]][]).flatMap(([, ...v]) => v.map((x) => JSON.parse(x).url));
      expect(pushed).toEqual(["https://a.example.com/x", "https://b.example.org/"]);
    });

    it.each([
      ["empty", [] as string[], "empty"],
      ["only private addresses", ["http://10.0.0.1/", "http://localhost/"], "empty"],
    ])("400 on %s", async (_n, urls, reason) => {
      authed("GROWTH");
      const res = await listPost(urls);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: "INVALID_LIST", reason });
      expect(crawlJob.create).not.toHaveBeenCalled();
    });

    it("refuses a list longer than the plan's URLs per crawl, or the configured max", async () => {
      authed("STARTER");
      const many = Array.from({ length: 2501 }, (_, i) => `https://a.example.com/${i}`);
      expect(await (await listPost(many)).json()).toMatchObject({ code: "INVALID_LIST", reason: "too_long", cap: 2500 });
      expect(await (await listPost(many.slice(0, 20), { config: { maxUrls: 10 } })).json()).toMatchObject({ reason: "too_long", cap: 10 });
      expect(redisRpush).not.toHaveBeenCalled();
    });
  });

  it("spends no quota on an invalid URL", async () => {
    // URL validation runs before the quota check, so a typo does not cost the
    // tenant their last crawl of the month.
    authed("STARTER");
    crawlJob.count.mockResolvedValue(3);
    const res = await startCrawl(postRequest({ url: "http://localhost/" }));
    expect(res.status).toBe(400);
    expect(crawlJob.create).not.toHaveBeenCalled();
  });
});

// ─── Read endpoints ─────────────────────────────────────────────────────────

describe("GET /crawl/[id]", () => {
  it("returns the crawl with severity counts once settled", async () => {
    authed();
    crawlJob.findFirst.mockResolvedValue(JOB_ROW);
    crawlIssue.groupBy.mockResolvedValue([
      { severity: "ERROR", _count: { _all: 2 } },
      { severity: "WARNING", _count: { _all: 1 } },
    ]);

    const res = await getCrawl(new Request("https://app.test/x"), params("crawl_1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.severityCounts).toEqual({ ERROR: 2, WARNING: 1, NOTICE: 0 });
  });

  it("counts a crawl with no summary from crawl_issues: one of each severity is 1 / 1 / 1", async () => {
    // The header-tile bug: a Phase 2 crawl showed 0 / 0 / 0 while Overview
    // showed the real split. Both now read getIssueTotals.
    authed();
    crawlJob.findFirst.mockResolvedValue({ ...JOB_ROW, summary: null });
    crawlIssue.groupBy.mockResolvedValue([
      { severity: "ERROR", _count: { _all: 1 } },
      { severity: "WARNING", _count: { _all: 1 } },
      { severity: "NOTICE", _count: { _all: 1 } },
    ]);
    const body = await (await getCrawl(new Request("https://app.test/x"), params("crawl_1"))).json();
    expect(body.severityCounts).toEqual({ ERROR: 1, WARNING: 1, NOTICE: 1 });
    // By crawlJobId, like Overview — not through crawlPage, which missed nothing
    // today but would diverge the moment a finding has no page.
    expect(crawlIssue.groupBy.mock.calls[0]![0]).toMatchObject({ by: ["severity"], where: { crawlJobId: "crawl_1" } });
  });

  it("trusts summary.totals when it has the current shape, and only then", async () => {
    authed();
    crawlJob.findFirst.mockResolvedValue({ ...JOB_ROW, summary: { totals: { ERROR: 4, WARNING: 5, NOTICE: 6 } } });
    let body = await (await getCrawl(new Request("https://app.test/x"), params("crawl_1"))).json();
    expect(body.severityCounts).toEqual({ ERROR: 4, WARNING: 5, NOTICE: 6 });
    expect(crawlIssue.groupBy).not.toHaveBeenCalled();

    crawlJob.findFirst.mockResolvedValue({ ...JOB_ROW, summary: { totals: { ERROR: 4 } } });
    crawlIssue.groupBy.mockResolvedValue([{ severity: "NOTICE", _count: { _all: 7 } }]);
    body = await (await getCrawl(new Request("https://app.test/x"), params("crawl_1"))).json();
    expect(body.severityCounts).toEqual({ ERROR: 0, WARNING: 0, NOTICE: 7 });
  });

  it("skips the groupBy while the crawl is still running", async () => {
    // This endpoint is polled every 3 s; a groupBy per poll is a cost the
    // running view does not need.
    authed();
    crawlJob.findFirst.mockResolvedValue({ ...JOB_ROW, status: "RUNNING" });
    await getCrawl(new Request("https://app.test/x"), params("crawl_1"));
    expect(crawlIssue.groupBy).not.toHaveBeenCalled();
  });
});

describe("GET /crawl/[id]/issues", () => {
  beforeEach(() => {
    authed();
    crawlJob.findFirst.mockResolvedValue({ id: "crawl_1" });
  });

  it("rejects an unknown severity rather than returning an empty page", async () => {
    const res = await getIssues(
      new Request("https://app.test/x?severity=CATASTROPHE"),
      params("crawl_1"),
    );
    expect(res.status).toBe(400);
  });

  it("rejects an unknown issue type", async () => {
    const res = await getIssues(new Request("https://app.test/x?type=MADE_UP"), params("crawl_1"));
    expect(res.status).toBe(400);
  });

  it("passes valid filters through to the query", async () => {
    await getIssues(
      new Request("https://app.test/x?severity=ERROR&type=TITLE_MISSING"),
      params("crawl_1"),
    );
    expect(crawlIssue.findMany.mock.calls[0]![0]!.where).toMatchObject({
      severity: "ERROR",
      type: "TITLE_MISSING",
      crawlPage: { crawlJobId: "crawl_1" },
    });
  });

  it("caps an outsized pageSize", async () => {
    await getIssues(new Request("https://app.test/x?pageSize=99999"), params("crawl_1"));
    expect(crawlIssue.findMany.mock.calls[0]![0]!.take).toBeLessThanOrEqual(200);
  });
});

describe("GET /crawl/[id]/export", () => {
  it("streams CSV with a header row and a download filename", async () => {
    authed();
    crawlJob.findFirst.mockResolvedValue({ id: "crawl_1", rootUrl: "https://example.com/" });
    crawlIssue.findMany.mockResolvedValue([
      {
        id: "i1",
        type: "TITLE_MISSING",
        severity: "ERROR",
        detail: null,
        crawlPage: { url: "https://example.com/a", statusCode: 200 },
      },
    ]);

    const res = await exportCsv(new Request("https://app.test/x"), params("crawl_1"));
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");

    const text = await res.text();
    // The header row and the quoting style both CHANGED when this endpoint was
    // moved onto the shared serializer (src/lib/csv-export.ts): headers are now
    // human-readable rather than snake_case, and fields are quoted only when
    // RFC 4180 requires it rather than unconditionally. Both are deliberate —
    // every other export in the app looks like this, and the file is opened in
    // a spreadsheet rather than parsed by a documented API contract.
    expect(text.split("\r\n")[0]).toBe("Severity,Type,URL,Status code,Detail");
    expect(text).toContain("ERROR,TITLE_MISSING,https://example.com/a");
  });

  it("quotes fields so a comma in a detail cannot shift columns", async () => {
    authed();
    crawlJob.findFirst.mockResolvedValue({ id: "crawl_1", rootUrl: "https://example.com/" });
    crawlIssue.findMany.mockResolvedValue([
      {
        id: "i1",
        type: "THIN_CONTENT",
        severity: "WARNING",
        detail: 'a, b and a "quote"',
        crawlPage: { url: "https://example.com/a", statusCode: 200 },
      },
    ]);

    const text = await exportCsv(new Request("https://app.test/x"), params("crawl_1")).then((r) =>
      r.text(),
    );
    expect(text).toContain('"a, b and a ""quote"""');
  });
});

describe("POST /crawl/[id]/cancel", () => {
  it("sets the Redis cancel flag for a running crawl", async () => {
    authed();
    crawlJob.findFirst
      .mockResolvedValueOnce({ id: "crawl_1", status: "RUNNING" })
      .mockResolvedValueOnce({ ...JOB_ROW, status: "RUNNING" });

    const res = await cancel(new Request("https://app.test/x"), params("crawl_1"));
    expect(res.status).toBe(200);
    expect(redisSet).toHaveBeenCalledWith("crawl:crawl_1:cancel", "1", "EX", expect.any(Number));
    // RUNNING is left for the worker to settle cooperatively.
    expect(crawlJob.update).not.toHaveBeenCalled();
  });

  it("marks a queued crawl cancelled directly — no worker is watching it", async () => {
    authed();
    crawlJob.findFirst
      .mockResolvedValueOnce({ id: "crawl_1", status: "QUEUED" })
      .mockResolvedValueOnce({ ...JOB_ROW, status: "CANCELLED" });

    await cancel(new Request("https://app.test/x"), params("crawl_1"));
    expect(crawlJob.update.mock.calls[0]![0]!.data).toMatchObject({ status: "CANCELLED" });
  });

  it("is idempotent on an already-finished crawl", async () => {
    authed();
    crawlJob.findFirst
      .mockResolvedValueOnce({ id: "crawl_1", status: "COMPLETED" })
      .mockResolvedValueOnce(JOB_ROW);

    const res = await cancel(new Request("https://app.test/x"), params("crawl_1"));
    expect(res.status).toBe(200);
    expect(redisSet).not.toHaveBeenCalled();
  });
});

// ─── Phase 2 endpoints ──────────────────────────────────────────────────────

describe("GET /crawl/[id]/summary", () => {
  it("returns the stored summary for a completed crawl", async () => {
    authed();
    crawlJob.findFirst.mockResolvedValue({
      id: "crawl_1",
      status: "COMPLETED",
      summary: { statusCodes: { "200": 5 }, aggregationMs: 12 },
    });

    const res = await getSummary(new Request("https://app.test/x"), params("crawl_1"));
    expect(res.status).toBe(200);
    expect((await res.json()).statusCodes["200"]).toBe(5);
  });

  it("404s while the crawl is still running", async () => {
    // A half-built summary would make the Overview flicker between wrong numbers.
    authed();
    crawlJob.findFirst.mockResolvedValue({ id: "crawl_1", status: "RUNNING", summary: null });
    const res = await getSummary(new Request("https://app.test/x"), params("crawl_1"));
    expect(res.status).toBe(404);
  });

  it("passes a 3a summary's own tallies through, without counting again", async () => {
    authed();
    const issues = { "h1.missing": { count: 2, kind: "issue", priority: "medium" } };
    crawlJob.findFirst.mockResolvedValue({
      id: "crawl_1",
      status: "COMPLETED",
      summary: {
        statusCodes: {},
        issues,
        issuesByKind: { issue: 2, warning: 0, opportunity: 0 },
        totals: { ERROR: 2, WARNING: 0, NOTICE: 0 },
      },
    });
    const body = await (await getSummary(new Request("https://app.test/x"), params("crawl_1"))).json();
    expect(body).toMatchObject({ issues, computed: false, totals: { ERROR: 2, WARNING: 0, NOTICE: 0 } });
    expect(crawlIssue.groupBy).not.toHaveBeenCalled();
  });

  it("computes tallies from crawl_issues for a Phase 2 summary, mapping legacy types", async () => {
    authed();
    crawlJob.findFirst.mockResolvedValue({ id: "crawl_1", status: "COMPLETED", summary: { statusCodes: { "200": 5 } } });
    bySeverityOrType(
      [
        { ruleId: null, type: "TITLE_MISSING", _count: { _all: 3 } },
        { ruleId: null, type: "DUPLICATE_TITLE", _count: { _all: 2 } },
        { ruleId: null, type: "NOT_A_TYPE", _count: { _all: 9 } },
      ],
      [{ severity: "ERROR", _count: { _all: 14 } }],
    );
    const body = await (await getSummary(new Request("https://app.test/x"), params("crawl_1"))).json();
    expect(crawlIssue.groupBy.mock.calls[0]![0]).toMatchObject({ where: { crawlJobId: "crawl_1" } });
    expect(body.statusCodes["200"]).toBe(5);
    expect(body.issues).toEqual({
      "page_titles.missing": { count: 3, kind: "issue", priority: "high" },
      "page_titles.duplicate": { count: 2, kind: "issue", priority: "medium" },
    });
    expect(body.issuesByKind).toEqual({ issue: 5, warning: 0, opportunity: 0 });
    expect(body.computed).toBe(true);
    expect(body.totals).toEqual({ ERROR: 14, WARNING: 0, NOTICE: 0 });
  });

  it("answers a pre-Phase-2 crawl (no summary) with the computed tallies alone", async () => {
    authed();
    crawlJob.findFirst.mockResolvedValue({ id: "crawl_1", status: "COMPLETED", summary: null });
    bySeverityOrType(
      [{ ruleId: null, type: "HTTP_4XX", _count: { _all: 1 } }],
      [{ severity: "ERROR", _count: { _all: 1 } }],
    );
    const res = await getSummary(new Request("https://app.test/x"), params("crawl_1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      partial: true,
      computed: true,
      issues: { "response_codes.internal_4xx": { count: 1, kind: "issue", priority: "high" } },
      issuesByKind: { issue: 1, warning: 0, opportunity: 0 },
      totals: { ERROR: 1, WARNING: 0, NOTICE: 0 },
      // Phase 4d: the Overview tiles' data, empty for a crawl with no joined sources.
      metricOverview: { coverage: { gsc: 0, psi: 0, ga4: 0, backlinks: 0, gsc_inspection: 0 }, status: {} },
    });
  });

  it("gives Overview the same totals the header tiles get", async () => {
    authed();
    const row = { ...JOB_ROW, summary: { statusCodes: {} } };
    crawlJob.findFirst.mockResolvedValue(row);
    bySeverityOrType([], [
      { severity: "ERROR", _count: { _all: 49 } },
      { severity: "WARNING", _count: { _all: 151 } },
      { severity: "NOTICE", _count: { _all: 42 } },
    ]);
    const overview = await (await getSummary(new Request("https://app.test/x"), params("crawl_1"))).json();
    const header = await (await getCrawl(new Request("https://app.test/x"), params("crawl_1"))).json();
    expect(overview.totals).toEqual({ ERROR: 49, WARNING: 151, NOTICE: 42 });
    expect(header.severityCounts).toEqual(overview.totals);
  });
});

describe("GET /crawl/[id]/duplicates", () => {
  beforeEach(() => {
    authed();
    crawlJob.findFirst.mockResolvedValue({ id: "crawl_1" });
  });

  it("rejects an unknown duplicate type", async () => {
    const res = await getDuplicates(
      new Request("https://app.test/x?type=colour"),
      params("crawl_1"),
    );
    expect(res.status).toBe(400);
  });

  it("accepts each supported type", async () => {
    for (const kind of ["title", "meta", "content"]) {
      const res = await getDuplicates(
        new Request(`https://app.test/x?type=${kind}`),
        params("crawl_1"),
      );
      expect(res.status, kind).toBe(200);
    }
  });

  it("hides the content hash — the URLs are what a reader needs", async () => {
    queryRaw.mockResolvedValue([
      { value: "abc123hash", members: 3, urls: ["https://e.com/a", "https://e.com/b"] },
    ]);
    const res = await getDuplicates(
      new Request("https://app.test/x?type=content"),
      params("crawl_1"),
    );
    const body = await res.json();
    expect(body.groups[0].value).toBeNull();
    expect(body.groups[0].urls).toHaveLength(2);
    // 3 members but 2 URLs returned: the list is a capped sample.
    expect(body.groups[0].truncated).toBe(true);
  });
});

describe("GET /crawl/[id]/redirects", () => {
  it("parses the hop list out of the stored detail", async () => {
    authed();
    crawlJob.findFirst.mockResolvedValue({ id: "crawl_1" });
    crawlIssue.count.mockResolvedValue(1);
    crawlIssue.findMany.mockResolvedValue([
      {
        id: "i1",
        type: "REDIRECT_CHAIN",
        severity: "WARNING",
        detail: "2 hops: https://e.com/a → https://e.com/b → https://e.com/c",
        crawlPage: { url: "https://e.com/a", statusCode: 301, redirectTarget: "https://e.com/b" },
      },
    ]);

    const res = await getRedirects(new Request("https://app.test/x"), params("crawl_1"));
    const body = await res.json();
    expect(body.redirects[0].hops).toEqual([
      "https://e.com/a",
      "https://e.com/b",
      "https://e.com/c",
    ]);
  });
});

describe("GET /crawl/[id]/pages — Phase 2 filters", () => {
  beforeEach(() => {
    authed();
    crawlJob.findFirst.mockResolvedValue({ id: "crawl_1" });
  });

  it("filters on inSitemap", async () => {
    await getPages(new Request("https://app.test/x?inSitemap=true"), params("crawl_1"));
    expect(crawlPage.findMany.mock.calls[0]![0]!.where).toMatchObject({ inSitemap: true });
  });

  it("filters on depth and an inlink range", async () => {
    await getPages(
      new Request("https://app.test/x?depth=2&minInlinks=1&maxInlinks=5"),
      params("crawl_1"),
    );
    expect(crawlPage.findMany.mock.calls[0]![0]!.where).toMatchObject({
      depth: 2,
      inlinkCount: { gte: 1, lte: 5 },
    });
  });

  it("rejects a non-boolean inSitemap rather than ignoring it", async () => {
    // Silently dropping the filter would look like it matched everything.
    const res = await getPages(new Request("https://app.test/x?inSitemap=maybe"), params("crawl_1"));
    expect(res.status).toBe(400);
  });

  it("rejects a negative or fractional numeric filter", async () => {
    for (const q of ["depth=-1", "minInlinks=1.5", "depth=abc"]) {
      const res = await getPages(new Request(`https://app.test/x?${q}`), params("crawl_1"));
      expect(res.status, q).toBe(400);
    }
  });

  it("applies no filters when none are given", async () => {
    await getPages(new Request("https://app.test/x"), params("crawl_1"));
    expect(crawlPage.findMany.mock.calls[0]![0]!.where).toEqual({ crawlJobId: "crawl_1" });
  });
});

// ─── Phase 3a: Issues by rule ───────────────────────────────────────────────

describe("GET /crawl/[id]/rules", () => {
  it("lists fired rules issues-first, then by priority and URL count, with the share of the crawl", async () => {
    authed();
    crawlJob.findFirst.mockResolvedValue({
      id: "crawl_1",
      pagesCrawled: 200,
      summary: {
        issues: {
          "images.not_next_gen_format": { count: 90, kind: "opportunity", priority: "low" },
          "h1.missing": { count: 10, kind: "issue", priority: "medium" },
          "response_codes.internal_4xx": { count: 4, kind: "issue", priority: "high" },
          "directives.noindex": { count: 2, kind: "warning", priority: "high" },
        },
        issuesByKind: { issue: 14, warning: 2, opportunity: 90 },
      },
    });
    const body = await (await getRules(new Request("https://app.test/x"), params("crawl_1"))).json();
    expect(body.rules.map((r: { ruleId: string }) => r.ruleId)).toEqual([
      "response_codes.internal_4xx",
      "h1.missing",
      "directives.noindex",
      "images.not_next_gen_format",
    ]);
    expect(body.rules[1]).toMatchObject({ family: "h1", urls: 10, share: 5 });
  });
});

describe("GET /crawl/[id]/rules/[ruleId]", () => {
  it("400s an unknown rule id", async () => {
    authed();
    crawlJob.findFirst.mockResolvedValue({ id: "crawl_1" });
    const res = await getRulePages(new Request("https://app.test/x"), ruleParams("crawl_1", "not.a_rule"));
    expect(res.status).toBe(400);
  });

  it("matches pre-3a rows through their legacy type, and returns evidence", async () => {
    authed();
    crawlJob.findFirst.mockResolvedValue({ id: "crawl_1" });
    crawlIssue.count.mockResolvedValue(2);
    crawlIssue.findMany.mockResolvedValue([
      { id: "i1", evidence: { length: 72 }, detail: null, crawlPage: { url: "https://example.com/a", statusCode: 200 } },
      { id: "i2", evidence: null, detail: "72 chars", crawlPage: { url: "https://example.com/b", statusCode: 200 } },
    ]);
    const body = await (
      await getRulePages(new Request("https://app.test/x?page=1"), ruleParams("crawl_1", "page_titles.over_60_chars"))
    ).json();
    expect(crawlIssue.findMany.mock.calls[0]![0]!.where).toEqual({
      crawlJobId: "crawl_1",
      OR: [{ ruleId: "page_titles.over_60_chars" }, { ruleId: null, type: { in: ["TITLE_TOO_LONG"] } }],
    });
    expect(body.rows.map((r: { evidence: unknown }) => r.evidence)).toEqual([{ length: 72 }, { detail: "72 chars" }]);
    expect(body.total).toBe(2);
  });
});

describe("GET /crawl/[id]/issues with a rule id", () => {
  it("accepts a registry rule id as the type filter and matches old rows too", async () => {
    authed();
    crawlJob.findFirst.mockResolvedValue({ id: "crawl_1" });
    const res = await getIssues(new Request("https://app.test/x?type=h1.missing"), params("crawl_1"));
    expect(res.status).toBe(200);
    expect(crawlIssue.findMany.mock.calls[0]![0]!.where).toMatchObject({
      crawlJobId: "crawl_1",
      OR: [{ ruleId: "h1.missing" }, { ruleId: null, type: { in: ["H1_MISSING"] } }],
    });
  });
});

describe("Issues-by-rule CSV", () => {
  it("streams the rule list with names, ids, kinds and shares", async () => {
    authed();
    crawlJob.findFirst.mockResolvedValue({
      id: "crawl_1",
      pagesCrawled: 4,
      summary: { issues: { "h1.missing": { count: 1, kind: "issue", priority: "medium" } }, issuesByKind: { issue: 1, warning: 0, opportunity: 0 } },
    });
    const res = await getRules(new Request("https://app.test/x?format=csv"), params("crawl_1"));
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    const text = await res.text();
    expect(text).toContain("Issue,Rule id,Family,Kind,Priority,URLs,% of crawled");
    expect(text).toContain("Missing H1,h1.missing,h1,issue,medium,1,25");
  });

  it("streams one rule's findings with evidence, old rows through their detail, and guards formulas", async () => {
    authed();
    crawlJob.findFirst.mockResolvedValue({ id: "crawl_1" });
    crawlIssue.findMany
      .mockResolvedValueOnce([
        { id: "i1", ruleId: "page_titles.over_60_chars", type: "page_titles.over_60_chars", evidence: { length: 72, title: "=HYPERLINK(1)" }, detail: null, crawlPage: { url: "https://example.com/a", statusCode: 200 } },
        { id: "i2", ruleId: null, type: "TITLE_TOO_LONG", evidence: null, detail: "72 chars", crawlPage: { url: "https://example.com/b", statusCode: 200 } },
      ])
      .mockResolvedValue([]);
    const res = await getRulePages(new Request("https://app.test/x?format=csv"), ruleParams("crawl_1", "page_titles.over_60_chars"));
    const text = await res.text();
    expect(text).toContain("URL,Status code,Rule id,Issue,Evidence");
    expect(text).toContain("https://example.com/a,200,page_titles.over_60_chars,Title over 60 characters,");
    expect(text).not.toMatch(/,=HYPERLINK/);
    expect(text).toContain("https://example.com/b,200,TITLE_TOO_LONG,TITLE_TOO_LONG,72 chars");
  });

  it("still 400s an unknown rule before streaming anything", async () => {
    authed();
    crawlJob.findFirst.mockResolvedValue({ id: "crawl_1" });
    const res = await getRulePages(new Request("https://app.test/x?format=csv"), ruleParams("crawl_1", "nope.nope"));
    expect(res.status).toBe(400);
  });
});
