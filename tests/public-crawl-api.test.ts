// tests/public-crawl-api.test.ts — the site crawler over the public API
// (Phase 3d-A), through the real route handlers with Prisma, Redis, the rate
// limiter and the crawl start stubbed:
//
//   AUTH       missing / revoked key → 401, wrong scope / unpaid → 403, on every route
//   START      the dashboard's body schema, callbackUrl (https, SSRF guard),
//              Idempotency-Key (replay, in progress, reused), the start rate
//              limit, tenant scoping, { crawlId, queuePosition, estimatedStart }
//   CALLBACK   signed with HMAC-SHA256 keyed by the key's secret hash (a test
//              client verifies it), one retry, nothing for a revoked key
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Fakes ───────────────────────────────────────────────────────────────────

const kv = new Map<string, string>();
const queryRows: unknown[][] = [];
const redis = {
  set: vi.fn(async (k: string, v: string, ...opts: unknown[]) => {
    if (opts.includes("NX") && kv.has(k)) return null;
    kv.set(k, v);
    return "OK";
  }),
  get: vi.fn(async (k: string) => kv.get(k) ?? null),
  del: vi.fn(async (k: string) => (kv.delete(k) ? 1 : 0)),
};
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => redis }));

vi.mock("@/lib/api-daily-quota", () => ({ consumeApiRequest: async () => ({ allowed: true }) }));

const limits = { api: true, start: true };
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async (key: string) => ({ success: key.startsWith("apikey:") ? limits.api : limits.start })),
}));

const paid = new Set(["t_a", "t_b"]);
vi.mock("@/lib/paid-plan", () => ({ hasPaidPlan: vi.fn(async (t: string) => paid.has(t)) }));

type KeyRow = { id: string; tenantId: string; keyHash: string; revokedAt: Date | null; scopes: string[] };
const keys: KeyRow[] = [];
type JobRow = Record<string, unknown> & { id: string; tenantId: string; status: string; createdAt: Date };
const jobs: JobRow[] = [];
const match = (row: Record<string, unknown>, where: Record<string, unknown>) =>
  Object.entries(where).every(([k, v]) => (v && typeof v === "object" && !(v instanceof Date) ? true : row[k] === v));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(async ({ where }: { where: { keyHash: string } }) => keys.find((k) => k.keyHash === where.keyHash) ?? null),
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; tenantId: string } }) => keys.find((k) => k.id === where.id && k.tenantId === where.tenantId) ?? null,
      ),
      update: vi.fn(async () => ({})),
    },
    $queryRaw: vi.fn(async () => queryRows.shift() ?? []),
    // Agency: the public API is Agency and up since 2026-11-14 (src/lib/api-access.ts).
    tenant: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, planType: "AGENCY" })) },
    crawlIssue: { findMany: vi.fn(async () => []) },
    crawlJob: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => jobs.find((j) => j.id === where.id) ?? null),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => jobs.find((j) => match(j, where)) ?? null),
      findMany: vi.fn(async (args: { where: { tenantId?: string } }) => (args?.where?.tenantId ? jobs.filter((j) => j.tenantId === args.where.tenantId) : [])),
      count: vi.fn(async ({ where }: { where: { status?: string; tenantId?: string } }) =>
        where.tenantId
          ? jobs.filter((j) => j.tenantId === where.tenantId && (j.status === "RUNNING" || j.status === "QUEUED") && j.id !== "self").length
          : jobs.filter((j) => j.status === where.status && j.id !== "self").length,
      ),
    },
  },
}));

const startCrawl = vi.fn(async (tenantId: string) => {
  const job = { id: `c${jobs.length + 1}`, tenantId, status: "QUEUED", createdAt: new Date(), startedAt: null };
  jobs.push(job);
  return job;
});
vi.mock("@/lib/site-crawler/service", () => ({ startCrawl: (...a: unknown[]) => startCrawl(...(a as [string])) }));

const crawlRoute = await import("@/app/api/public/v1/crawl/route");
const oneRoute = await import("@/app/api/public/v1/crawl/[id]/route");
const { deliverCrawlCallback, signCallback, SIGNATURE_HEADER } = await import("@/lib/site-crawler/callback");
const { queueEstimate } = await import("@/lib/site-crawler/public-api");

// ─── Keys ────────────────────────────────────────────────────────────────────

const secretOf = new Map<string, string>();
function makeKey(id: string, tenantId: string, scopes = ["public"], revoked = false): string {
  const idPart = createHash("md5").update(id).digest("hex").slice(0, 24);
  const secret = createHash("sha1").update(id).digest("hex").slice(0, 48);
  secretOf.set(id, secret);
  keys.push({ id, tenantId, keyHash: createHash("sha256").update(secret).digest("hex"), revokedAt: revoked ? new Date() : null, scopes });
  return `er_api_${idPart}.${secret}`;
}
const KEY_A = makeKey("k_a", "t_a");
const KEY_B = makeKey("k_b", "t_b");
const REVOKED = makeKey("k_r", "t_a", ["public"], true);
const PARTNER = makeKey("k_p", "t_a", ["partner"]);
const UNPAID = makeKey("k_u", "t_unpaid");

const post = (body: unknown, opts: { key?: string; headers?: Record<string, string> } = {}) =>
  crawlRoute.POST(
    new Request("https://app.test/api/public/v1/crawl", {
      method: "POST",
      headers: { "content-type": "application/json", ...(opts.key ? { authorization: `Bearer ${opts.key}` } : {}), ...opts.headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  queryRows.length = 0;
  kv.clear();
  jobs.length = 0;
  startCrawl.mockClear();
  limits.api = true;
  limits.start = true;
});

// ─── Start ───────────────────────────────────────────────────────────────────

describe("POST /api/public/v1/crawl", () => {
  it.each([
    ["no key", undefined, 401, "missing_bearer_key"],
    ["a revoked key", REVOKED, 401, "invalid_or_revoked_key"],
    ["a partner-scoped key", PARTNER, 403, "wrong_scope"],
    ["an unpaid tenant", UNPAID, 403, "subscription_inactive"],
  ])("%s → %i", async (_n, key, status, error) => {
    const res = await post({ url: "https://shop.example/" }, { key });
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe(error);
    expect(startCrawl).not.toHaveBeenCalled();
  });

  it("the per-key API limit answers 429 before anything runs", async () => {
    limits.api = false;
    expect((await post({ url: "https://shop.example/" }, { key: KEY_A })).status).toBe(429);
    expect(startCrawl).not.toHaveBeenCalled();
  });

  it("starts with the dashboard's body, as the key's tenant, and answers with the queue position", async () => {
    jobs.push({ id: "older", tenantId: "t_b", status: "QUEUED", createdAt: new Date(Date.now() - 60_000) });
    const config = { maxUrls: 200, extractors: [{ name: "Price", kind: "css", expr: ".price", attr: null, multiple: false }] };
    const res = await post({ url: "https://shop.example/", renderMode: "thin", config, callbackUrl: "https://hooks.echopilot.app/echorank" }, { key: KEY_A });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toMatchObject({ crawlId: "c2", status: "queued" });
    expect(typeof body.queuePosition).toBe("number");
    expect(body.estimatedStart).toMatch(/^\d{4}-/);
    const [tenantId, plan, url, render, opts] = startCrawl.mock.calls[0] as unknown as [string, string, string, string, Record<string, unknown>];
    expect([tenantId, plan, url, render]).toEqual(["t_a", "AGENCY", "https://shop.example/", "thin"]);
    expect(opts).toMatchObject({ config: { maxUrls: 200 }, mode: "spider", api: { apiKeyId: "k_a", callbackUrl: "https://hooks.echopilot.app/echorank" } });
  });

  it.each([
    [{ url: "https://shop.example/", renderMode: "sometimes" }, "invalid_request"],
    [{ url: "https://shop.example/", mode: "sitemap" }, "invalid_request"],
    ["{not json", "invalid_json"],
  ])("refuses a body the dashboard would refuse: %j", async (body, error) => {
    const res = await post(body, { key: KEY_A });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(error);
  });

  it.each([
    ["http://hooks.echopilot.app/x", "https_only"],
    ["https://127.0.0.1/x", "private_host"],
    ["https://user:pw@hooks.echopilot.app/x", "has_credentials"],
    ["https://localhost/x", null],
  ])("callbackUrl %s is refused", async (callbackUrl, reason) => {
    const res = await post({ url: "https://shop.example/", callbackUrl }, { key: KEY_A });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_callback_url");
    if (reason) expect(body.reason).toBe(reason);
    expect(startCrawl).not.toHaveBeenCalled();
  });

  it("the start rate limit (3 a minute, as in the dashboard) answers 429", async () => {
    limits.start = false;
    const res = await post({ url: "https://shop.example/" }, { key: KEY_A });
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("RATE_LIMITED");
  });

  it("Idempotency-Key: a retry returns the same crawl; a different body is refused; a failure frees the key", async () => {
    const headers = { "idempotency-key": "order-42" };
    const first = await post({ url: "https://shop.example/" }, { key: KEY_A, headers });
    expect(first.status).toBe(202);
    const again = await post({ url: "https://shop.example/" }, { key: KEY_A, headers });
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ crawlId: (await first.json()).crawlId, replayed: true });
    expect(startCrawl).toHaveBeenCalledTimes(1);
    expect((await post({ url: "https://other.example/" }, { key: KEY_A, headers })).status).toBe(422);
    // Per tenant: another workspace's same key is its own.
    expect((await post({ url: "https://shop.example/" }, { key: KEY_B, headers })).status).toBe(202);
    // A refused start releases the key, so the retry can start.
    limits.start = false;
    expect((await post({ url: "https://shop.example/" }, { key: KEY_A, headers: { "idempotency-key": "order-43" } })).status).toBe(429);
    limits.start = true;
    expect((await post({ url: "https://shop.example/" }, { key: KEY_A, headers: { "idempotency-key": "order-43" } })).status).toBe(202);
  });

  it("Idempotency-Key: a second request while the first is still starting gets 409", async () => {
    const { idempotencyRedisKey } = await import("@/lib/site-crawler/idempotency");
    kv.set(
      idempotencyRedisKey("t_a", "order-9"),
      JSON.stringify({
        pending: true,
        body: createHash("sha256")
          .update(JSON.stringify({ url: "https://shop.example/" }))
          .digest("hex"),
      }),
    );
    expect((await post({ url: "https://shop.example/" }, { key: KEY_A, headers: { "idempotency-key": "order-9" } })).status).toBe(409);
  });
});

describe("queue estimate", () => {
  it("position 1 starts now when a slot is free; behind a full box, after the average crawl", async () => {
    const now = new Date("2026-11-05T10:00:00Z");
    const self = { id: "self", status: "QUEUED" as const, createdAt: now, startedAt: null };
    expect(await queueEstimate(self, now)).toEqual({ queuePosition: 1, estimatedStart: now.toISOString() });
    jobs.push({ id: "r1", tenantId: "t_b", status: "RUNNING", createdAt: now }, { id: "r2", tenantId: "t_b", status: "RUNNING", createdAt: now });
    // Six slots (the default): two running leave room.
    expect((await queueEstimate(self, now)).estimatedStart).toBe(now.toISOString());
    // A two-slot box is full.
    const est = await queueEstimate(self, now, 2);
    expect(est.estimatedStart).toBe(new Date(now.getTime() + 10 * 60_000).toISOString());
    expect(await queueEstimate({ ...self, status: "COMPLETED" }, now)).toEqual({ queuePosition: null, estimatedStart: null });
    expect((await queueEstimate({ ...self, status: "RUNNING", startedAt: now }, now)).queuePosition).toBe(0);
  });

  it("fair share: free box slots do not help a workspace already running its plan's crawls (Agency: 3)", async () => {
    const now = new Date("2026-11-05T10:00:00Z");
    const self = { id: "self", tenantId: "t_b", status: "QUEUED" as const, createdAt: now, startedAt: null };
    jobs.push({ id: "r1", tenantId: "t_b", status: "RUNNING", createdAt: now });
    jobs.push({ id: "r2", tenantId: "t_b", status: "RUNNING", createdAt: now });
    // Two of its three running: it starts now.
    expect((await queueEstimate(self, now)).estimatedStart).toBe(now.toISOString());
    jobs.push({ id: "r3", tenantId: "t_b", status: "RUNNING", createdAt: now });
    expect((await queueEstimate(self, now)).estimatedStart).toBe(new Date(now.getTime() + 10 * 60_000).toISOString());
    // Another workspace with the same box load starts now.
    expect((await queueEstimate({ ...self, tenantId: "t_a" }, now)).estimatedStart).toBe(now.toISOString());
  });
});

// ─── Callback ────────────────────────────────────────────────────────────────

/** What a receiver does: recompute the HMAC over the raw body with sha256(secret), compare in constant time. */
function verifyAsClient(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", createHash("sha256").update(secret).digest("hex")).update(body).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

describe("completion callback", () => {
  const job = (extra: Record<string, unknown> = {}) => ({
    id: "c9",
    tenantId: "t_a",
    rootUrl: "https://shop.example/",
    mode: "spider",
    status: "COMPLETED",
    stoppedReason: null,
    createdAt: new Date("2026-11-05T10:00:00Z"),
    startedAt: new Date("2026-11-05T10:01:00Z"),
    finishedAt: new Date("2026-11-05T10:11:00Z"),
    pagesCrawled: 120,
    urlCap: 500,
    pagesRendered: 0,
    renderCap: 0,
    issueCount: 7,
    config: null,
    scheduleId: null,
    apiKeyId: "k_a",
    callbackUrl: "https://hooks.echopilot.app/echorank",
    summary: {
      health: { score: 81 },
      highPages: 4,
      statusCodes: { "200": 118, "404": 2 },
      issues: { "h1.missing": { count: 7, kind: "issue", priority: "high" } },
      issuesByKind: { issue: 7, warning: 0, opportunity: 0 },
    },
    ...extra,
  });

  it("POSTs {crawlId, status, summary} signed so the key's holder can verify it", async () => {
    jobs.push(job() as never);
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    const retry = vi.fn();
    expect(await deliverCrawlCallback("c9", 1, { fetch: fetchMock as never, retry })).toBe("sent");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://hooks.echopilot.app/echorank");
    expect(init).toMatchObject({ method: "POST", redirect: "manual" });
    const body = String(init.body);
    expect(JSON.parse(body)).toMatchObject({
      crawlId: "c9",
      status: "completed",
      summary: { health: 81, issueCount: 7, highPriorityPages: 4, totals: { byFamily: { h1: 7 } } },
    });
    const sig = init.headers[SIGNATURE_HEADER];
    expect(verifyAsClient(body, sig, secretOf.get("k_a")!)).toBe(true);
    expect(verifyAsClient(body, sig, secretOf.get("k_b")!)).toBe(false);
    expect(verifyAsClient(body.replace("81", "99"), sig, secretOf.get("k_a")!)).toBe(false);
    expect(signCallback(body, keys[0]!.keyHash)).toBe(sig);
    expect(retry).not.toHaveBeenCalled();
  });

  it("one retry: a failed first attempt schedules the second; a failed second is dropped", async () => {
    jobs.push(job({ status: "FAILED", stoppedReason: "boom: internal detail" }) as never);
    const fail = vi.fn(async () => new Response(null, { status: 500 }));
    const retry = vi.fn(async () => undefined);
    expect(await deliverCrawlCallback("c9", 1, { fetch: fail as never, retry })).toBe("retry");
    expect(retry).toHaveBeenCalledWith("c9", 60_000);
    const body = JSON.parse(String((fail.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    // A failure says failed, never the internal error.
    expect(body).toMatchObject({ status: "failed", summary: { stoppedReason: null } });
    const network = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(await deliverCrawlCallback("c9", 2, { fetch: network as never, retry })).toBe("failed");
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("sends nothing without a callback, for a running crawl, for a revoked key, or to a URL the guard now refuses", async () => {
    const fetchMock = vi.fn();
    const deps = { fetch: fetchMock as never, retry: vi.fn() };
    jobs.push(
      job({ id: "n1", callbackUrl: null }) as never,
      job({ id: "n2", status: "RUNNING" }) as never,
      job({ id: "n3", apiKeyId: "k_r" }) as never,
      job({ id: "n4", callbackUrl: "https://10.0.0.1/x" }) as never,
    );
    for (const id of ["n1", "n2", "n3", "n4"]) expect(await deliverCrawlCallback(id, 1, deps)).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── Status and list ─────────────────────────────────────────────────────────

const get = (path: string, key?: string) => new Request(`https://app.test${path}`, { headers: key ? { authorization: `Bearer ${key}` } : {} });
const idParams = (id: string) => ({ params: Promise.resolve({ id }) });
const row = (extra: Record<string, unknown> = {}) => ({
  id: "c1",
  tenantId: "t_a",
  rootUrl: "https://shop.example/",
  mode: "spider",
  status: "COMPLETED",
  stoppedReason: "url_cap",
  createdAt: new Date("2026-11-05T10:00:00Z"),
  startedAt: new Date("2026-11-05T10:01:00Z"),
  finishedAt: new Date("2026-11-05T10:31:00Z"),
  pagesCrawled: 500,
  urlCap: 500,
  pagesRendered: 40,
  renderCap: 100,
  issueCount: 12,
  scheduleId: null,
  apiKeyId: "k_a",
  config: { segments: [{ name: "Blog", rule: { kind: "urlPattern", pattern: "/blog/*" } }] },
  summary: {
    health: { score: 64 },
    highPages: 9,
    statusCodes: { "200": 490, "404": 10 },
    issues: { "h1.missing": { count: 5, kind: "issue", priority: "high" }, "images.missing_alt": { count: 7, kind: "warning", priority: "medium" } },
    issuesByKind: { issue: 5, warning: 7, opportunity: 0 },
  },
  ...extra,
});

describe("GET /api/public/v1/crawl/{id}", () => {
  it.each([
    ["no key", undefined, 401],
    ["a revoked key", REVOKED, 401],
    ["a partner key", PARTNER, 403],
    ["an unpaid tenant", UNPAID, 403],
  ])("%s → %i", async (_n, key, status) => {
    jobs.push(row() as never);
    expect((await oneRoute.GET(get("/api/public/v1/crawl/c1", key), idParams("c1"))).status).toBe(status);
  });

  it("another workspace's crawl is a 404", async () => {
    jobs.push(row() as never);
    const res = await oneRoute.GET(get("/api/public/v1/crawl/c1", KEY_B), idParams("c1"));
    expect(res.status).toBe(404);
  });

  it("a settled crawl: progress, health, summary, totals by kind and family, segments", async () => {
    jobs.push(row() as never);
    queryRows.push(
      [{ seg: 0, n: 120 }],
      [
        { seg: 0, severity: "ERROR", n: 3 },
        { seg: 0, severity: "WARNING", n: 4 },
      ],
    );
    const res = await oneRoute.GET(get("/api/public/v1/crawl/c1", KEY_A), idParams("c1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      crawlId: "c1",
      host: "shop.example",
      status: "completed",
      stoppedReason: "url_cap",
      viaApi: true,
      progress: { phase: "completed", pagesCrawled: 500, urlCap: 500, pagesRendered: 40, renderCap: 100 },
      health: 64,
      summary: { issueCount: 12, durationMs: 30 * 60_000, statusCodes: { "200": 490, "404": 10 }, highPriorityPages: 9 },
      totals: { byKind: { issue: 5, warning: 7, opportunity: 0 }, byFamily: { h1: 5, images: 7 } },
      segments: [{ index: 0, name: "Blog", pages: 120, findings: 7 }],
      queuePosition: null,
    });
  });

  it("a queued crawl: no summary yet, a queue position; a failed one hides its internal reason", async () => {
    jobs.push(row({ status: "QUEUED", startedAt: null, finishedAt: null, summary: null, stoppedReason: null }) as never);
    const body = await (await oneRoute.GET(get("/api/public/v1/crawl/c1", KEY_A), idParams("c1"))).json();
    expect(body).toMatchObject({ status: "queued", summary: null, totals: null, segments: [], health: null });
    expect(body.queuePosition).toBeGreaterThanOrEqual(1);
    expect(body.estimatedStart).toMatch(/^\d{4}-/);
    jobs.length = 0;
    jobs.push(row({ status: "FAILED", stoppedReason: "TypeError: at /opt/echorank/…" }) as never);
    const failed = await (await oneRoute.GET(get("/api/public/v1/crawl/c1", KEY_A), idParams("c1"))).json();
    expect(failed).toMatchObject({ status: "failed", stoppedReason: null });
  });
});

describe("GET /api/public/v1/crawl (list)", () => {
  it("lists only the key's tenant's crawls, by exact host, limit capped at 100", async () => {
    jobs.push(row({ id: "a1" }) as never, row({ id: "b1", tenantId: "t_b" }) as never);
    const { prisma } = await import("@/lib/prisma");
    const findMany = prisma.crawlJob.findMany as unknown as ReturnType<typeof vi.fn>;
    findMany.mockClear();
    const res = await crawlRoute.GET(get("/api/public/v1/crawl?host=Shop.Example&limit=500", KEY_A));
    const body = await res.json();
    expect(body.crawls.map((c: { crawlId: string }) => c.crawlId)).toEqual(["a1"]);
    const args = findMany.mock.calls[0]![0];
    expect(args.where.tenantId).toBe("t_a");
    expect(args.where.OR[2]).toEqual({ rootUrl: { startsWith: "https://shop.example/", mode: "insensitive" } });
    expect(args.take).toBe(100);
    expect((await crawlRoute.GET(get("/api/public/v1/crawl?limit=0", KEY_A))).status).toBe(400);
    expect((await crawlRoute.GET(get("/api/public/v1/crawl"))).status).toBe(401);
  });
});

// ─── MCP ─────────────────────────────────────────────────────────────────────

describe("MCP: start_crawl, get_crawl_status, get_crawl_issues, list_crawls", async () => {
  const mcpRoute = await import("@/app/api/public/v1/mcp/route");
  const { NextRequest } = await import("next/server");
  const rpc = async (key: string | undefined, method: string, params?: unknown) => {
    const res = await mcpRoute.POST(
      new NextRequest("https://app.test/api/public/v1/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, ...(params ? { params } : {}) }),
      }),
    );
    return { status: res.status, body: (await res.json()) as { result?: Record<string, unknown>; error?: unknown } };
  };
  const call = async (key: string, name: string, args: Record<string, unknown> = {}) =>
    (await rpc(key, "tools/call", { name, arguments: args })).body.result as {
      isError?: boolean;
      structuredContent?: Record<string, unknown>;
      content: { text: string }[];
    };

  it("handshake: initialize, then tools/list carries the four crawl tools with JSON schemas", async () => {
    expect((await rpc(undefined, "initialize")).status).toBe(401);
    const init = await rpc(KEY_A, "initialize", { protocolVersion: "2025-06-18" });
    expect(init.body.result).toMatchObject({ protocolVersion: "2025-06-18", capabilities: { tools: {} } });
    const list = (await rpc(KEY_A, "tools/list")).body.result as {
      tools: { name: string; inputSchema: { type: string; required?: string[] }; annotations: { readOnlyHint: boolean } }[];
    };
    const byName = Object.fromEntries(list.tools.map((t) => [t.name, t]));
    for (const n of ["start_crawl", "get_crawl_status", "get_crawl_issues", "list_crawls"]) expect(byName[n]!.inputSchema.type).toBe("object");
    expect(byName.get_crawl_status!.inputSchema.required).toEqual(["crawlId"]);
    expect(byName.start_crawl!.annotations.readOnlyHint).toBe(false);
    expect(byName.list_crawls!.annotations.readOnlyHint).toBe(true);
  });

  it("start_crawl starts as the key's tenant, records the key, and answers with the queue position", async () => {
    const r = await call(KEY_A, "start_crawl", { url: "https://shop.example/", renderMode: "thin", maxUrls: 50 });
    expect(r.isError).toBeUndefined();
    expect(r.structuredContent).toMatchObject({ crawlId: "c1", status: "queued" });
    expect(typeof r.structuredContent!.queuePosition).toBe("number");
    const [tenantId, , url, render, opts] = startCrawl.mock.calls[0] as unknown as [
      string,
      string,
      string,
      string,
      { config: { maxUrls: number }; api: unknown },
    ];
    expect([tenantId, url, render, opts.config.maxUrls]).toEqual(["t_a", "https://shop.example/", "thin", 50]);
    expect(opts.api).toEqual({ apiKeyId: "k_a", callbackUrl: null });
    expect(r.content[0]!.text).toContain("c1");
    // The same refusals as the REST start.
    expect((await call(KEY_A, "start_crawl", { url: "https://shop.example/", callbackUrl: "http://x.example/" })).isError).toBe(true);
    expect((await call(KEY_A, "start_crawl", { mode: "list" })).isError).toBe(true);
    limits.start = false;
    const limited = await call(KEY_A, "start_crawl", { url: "https://shop.example/" });
    expect([limited.isError, limited.content[0]!.text]).toEqual([true, "Too many crawls in a row. Wait a minute."]);
  });

  it("get_crawl_status, list_crawls and get_crawl_issues read only the key's tenant", async () => {
    jobs.push(row() as never);
    const own = await call(KEY_A, "get_crawl_status", { crawlId: "c1" });
    expect(own.structuredContent).toMatchObject({ crawlId: "c1", status: "completed", health: 64, totals: { byFamily: { h1: 5, images: 7 } } });
    expect(own.content[0]!.text).toContain("64/100");
    const other = await call(KEY_B, "get_crawl_status", { crawlId: "c1" });
    expect([other.isError, other.content[0]!.text]).toEqual([true, "No crawl with that id in this workspace."]);
    expect((await call(KEY_B, "get_crawl_issues", { crawlId: "c1" })).isError).toBe(true);
    expect((await call(KEY_A, "list_crawls", {})).structuredContent).toMatchObject({ crawls: [{ crawlId: "c1" }] });
    expect((await call(KEY_B, "list_crawls", {})).structuredContent).toEqual({ crawls: [] });
    expect((await call(KEY_A, "get_crawl_status", {})).isError).toBe(true);
  });
});
