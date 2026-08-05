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
vi.mock("@/lib/prisma", () => ({ prisma: { crawlJob, crawlPage, crawlIssue } }));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: true, remaining: 2 })),
}));

const addJob = vi.fn<(...a: unknown[]) => Promise<{ id: string }>>(async () => ({
  id: "bull_1",
}));
vi.mock("@/infrastructure/queue/registry", () => ({ addJob: (...a: unknown[]) => addJob(...a) }));

const redisSet = vi.fn(async () => "OK");
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => ({ set: redisSet }),
}));

// ─── Subjects ───────────────────────────────────────────────────────────────

const { POST: startCrawl, GET: listCrawls } = await import("@/app/api/seo/v1/crawl/route");
const { GET: getCrawl } = await import("@/app/api/seo/v1/crawl/[id]/route");
const { GET: getIssues } = await import("@/app/api/seo/v1/crawl/[id]/issues/route");
const { GET: getPages } = await import("@/app/api/seo/v1/crawl/[id]/pages/route");
const { POST: cancel } = await import("@/app/api/seo/v1/crawl/[id]/cancel/route");
const { GET: exportCsv } = await import("@/app/api/seo/v1/crawl/[id]/export/route");

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

beforeEach(() => {
  vi.clearAllMocks();
  crawlJob.count.mockResolvedValue(0);
  crawlJob.findMany.mockResolvedValue([]);
  crawlIssue.groupBy.mockResolvedValue([]);
  crawlIssue.count.mockResolvedValue(0);
  crawlIssue.findMany.mockResolvedValue([]);
  crawlPage.count.mockResolvedValue(0);
  crawlPage.findMany.mockResolvedValue([]);
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

  it("refuses a locked tier with 403 before it validates the URL", async () => {
    authed("AI_VISIBILITY");
    const res = await startCrawl(postRequest({ url: "https://example.com" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PLAN_LOCKED");
    expect(crawlJob.create).not.toHaveBeenCalled();
  });

  it("refuses once the monthly allowance is spent, with 429", async () => {
    authed("STARTER");
    crawlJob.count.mockResolvedValue(4); // STARTER allows 4
    const res = await startCrawl(postRequest({ url: "https://example.com" }));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("QUOTA_EXCEEDED");
    expect(addJob).not.toHaveBeenCalled();
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
    expect(text.split("\n")[0]).toBe("severity,type,url,status_code,detail");
    expect(text).toContain('"ERROR","TITLE_MISSING","https://example.com/a"');
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
