// tests/public-crawl-api-data.test.ts — the public crawl API's data routes
// (Phase 3d-A): /issues (cursor-paged findings, rule / family / kind /
// segment filters, legacy rows), /pages and /export (the dashboard handlers,
// run as the key's tenant through api-tenant-context), /cancel. Auth and
// tenant isolation on every route. The real paid-plan module answers, with a
// session lookup that throws: a dashboard handler that ran outside the key's
// context would fail loudly.
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/tenant", () => ({
  requireTenant: vi.fn(async () => {
    throw new Error("no session in the public API");
  }),
}));

type KeyRow = { id: string; tenantId: string; keyHash: string; revokedAt: Date | null; scopes: string[] };
const keys: KeyRow[] = [];
const crawls = [
  { id: "c1", tenantId: "t_a", config: { segments: [{ name: "Blog", rule: { kind: "urlPattern", pattern: "/blog/*" } }] } },
  { id: "c2", tenantId: "t_b", config: null },
];
const issueRows = Array.from({ length: 5 }, (_, i) => ({
  id: `i${i}`,
  ruleId: i === 4 ? null : "h1.missing",
  type: i === 4 ? "TITLE_TOO_LONG" : "h1.missing",
  kind: i === 4 ? null : "issue",
  priority: i === 4 ? null : "high",
  evidence: i === 4 ? null : { count: 0 },
  detail: i === 4 ? "72 chars" : null,
  crawlPage: { url: `https://shop.example/${i}`, statusCode: 200, foundOn: i ? "https://shop.example/" : null },
}));
const crawlIssueFindMany = vi.fn(async (args: { take: number }) => issueRows.slice(0, args.take));
const cancelCrawl = vi.fn(async (tenantId: string, id: string) => crawls.some((c) => c.id === id && c.tenantId === tenantId));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(async ({ where }: { where: { keyHash: string } }) => keys.find((k) => k.keyHash === where.keyHash) ?? null),
      update: vi.fn(async () => ({})),
    },
    subscription: {
      findUnique: vi.fn(async ({ where }: { where: { tenantId: string } }) =>
        where.tenantId === "t_unpaid" ? null : { status: "ACTIVE", productKind: "PLAN" },
      ),
    },
    tenant: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        planType: "GROWTH",
        billingStatus: where.id === "t_unpaid" ? "CANCELED" : "ACTIVE",
      })),
    },
    crawlJob: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; tenantId: string } }) => {
        const c = crawls.find((x) => x.id === where.id && x.tenantId === where.tenantId);
        return c
          ? {
              ...c,
              rootUrl: "https://shop.example/",
              mode: "spider",
              status: "CANCELLED",
              stoppedReason: "cancelled",
              createdAt: new Date(),
              startedAt: null,
              finishedAt: new Date(),
              pagesCrawled: 3,
              urlCap: 500,
              pagesRendered: 0,
              renderCap: 0,
              issueCount: 0,
              summary: null,
              scheduleId: null,
              apiKeyId: "k_a",
            }
          : null;
      }),
    },
    crawlIssue: { findMany: (args: { take: number }) => crawlIssueFindMany(args) },
  },
}));
vi.mock("@/lib/site-crawler/service", () => ({ cancelCrawl: (...a: [string, string]) => cancelCrawl(...a) }));

// The dashboard handlers: stand-ins that do what each real one does first —
// requirePaidPlan(), then a tenant-scoped lookup — and echo what they saw.
const seen: { route: string; tenantId: string; url: string }[] = [];
const stand = (route: string) => ({
  GET: async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { requirePaidPlan } = await import("@/lib/paid-plan");
    const tenant = await requirePaidPlan();
    const { id } = await params;
    seen.push({ route, tenantId: tenant.tenantId, url: req.url });
    if (!crawls.some((c) => c.id === id && c.tenantId === tenant.tenantId)) return Response.json({ code: "NOT_FOUND" }, { status: 404 });
    const csv = new URL(req.url).searchParams.get("format") === "csv" || route === "export";
    return csv
      ? new Response("URL,Status\r\n", { headers: { "content-type": "text/csv; charset=utf-8" } })
      : Response.json({ pages: [], nextCursor: null, route });
  },
});
vi.mock("@/app/api/seo/v1/crawl/[id]/pages/route", () => stand("pages"));
vi.mock("@/app/api/seo/v1/crawl/[id]/export/route", () => stand("export"));
vi.mock("@/app/api/seo/v1/crawl/[id]/external/route", () => stand("external"));

const issuesRoute = await import("@/app/api/public/v1/crawl/[id]/issues/route");
const pagesRoute = await import("@/app/api/public/v1/crawl/[id]/pages/route");
const exportRoute = await import("@/app/api/public/v1/crawl/[id]/export/route");
const cancelRoute = await import("@/app/api/public/v1/crawl/[id]/cancel/route");

function makeKey(id: string, tenantId: string, scopes = ["public"], revoked = false): string {
  const idPart = createHash("md5").update(id).digest("hex").slice(0, 24);
  const secret = createHash("sha1").update(id).digest("hex").slice(0, 48);
  keys.push({ id, tenantId, keyHash: createHash("sha256").update(secret).digest("hex"), revokedAt: revoked ? new Date() : null, scopes });
  return `er_api_${idPart}.${secret}`;
}
const KEY_A = makeKey("k_a", "t_a");
const KEY_B = makeKey("k_b", "t_b");
const REVOKED = makeKey("k_r", "t_a", ["public"], true);
const PARTNER = makeKey("k_p", "t_a", ["partner"]);
const UNPAID = makeKey("k_u", "t_unpaid");

const req = (path: string, key?: string, method = "GET") =>
  new Request(`https://app.test${path}`, { method, headers: key ? { authorization: `Bearer ${key}` } : {} });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  seen.length = 0;
  crawlIssueFindMany.mockClear();
  cancelCrawl.mockClear();
});

const ROUTES: [string, (key?: string) => Promise<Response>][] = [
  ["issues", (k) => issuesRoute.GET(req("/api/public/v1/crawl/c1/issues", k), ctx("c1"))],
  ["pages", (k) => pagesRoute.GET(req("/api/public/v1/crawl/c1/pages", k), ctx("c1"))],
  ["export", (k) => exportRoute.GET(req("/api/public/v1/crawl/c1/export?view=issues", k), ctx("c1"))],
  ["cancel", (k) => cancelRoute.POST(req("/api/public/v1/crawl/c1/cancel", k, "POST"), ctx("c1"))],
];

describe.each(ROUTES)("%s: auth and isolation", (_name, call) => {
  it.each([
    ["no key", undefined, 401],
    ["a revoked key", REVOKED, 401],
    ["a partner key", PARTNER, 403],
    ["an unpaid tenant", UNPAID, 403],
    ["another workspace's key", KEY_B, 404],
  ])("%s → %i", async (_n, key, status) => {
    expect((await call(key)).status).toBe(status);
  });

  it("the key's own crawl → 200", async () => {
    expect((await call(KEY_A)).status).toBe(200);
  });
});

describe("GET /crawl/{id}/issues", () => {
  it("returns findings with rule, family, kind, priority, page and evidence; legacy rows mapped; cursor", async () => {
    const res = await issuesRoute.GET(req("/api/public/v1/crawl/c1/issues?limit=4", KEY_A), ctx("c1"));
    const body = await res.json();
    expect(body.issues).toHaveLength(4);
    expect(body.issues[0]).toEqual({
      id: "i0",
      ruleId: "h1.missing",
      family: "h1",
      kind: "issue",
      priority: "high",
      url: "https://shop.example/0",
      statusCode: 200,
      foundOn: null,
      evidence: { count: 0 },
    });
    expect(body.nextCursor).toBe("i3");
    const all = await (await issuesRoute.GET(req("/api/public/v1/crawl/c1/issues", KEY_A), ctx("c1"))).json();
    expect(all.issues[4]).toMatchObject({ ruleId: "page_titles.over_60_chars", family: "page_titles", evidence: { detail: "72 chars" } });
    expect(all.nextCursor).toBeNull();
  });

  it("filters narrow to rule ids (legacy types included), by segment, after the cursor; 200 rows at most", async () => {
    await issuesRoute.GET(req("/api/public/v1/crawl/c1/issues?family=page_titles&kind=warning&segment=0&cursor=i2&limit=999", KEY_A), ctx("c1"));
    const args = crawlIssueFindMany.mock.calls[0]![0] as unknown as { where: Record<string, unknown>; take: number; orderBy: unknown };
    expect(args.take).toBe(201);
    expect(args.orderBy).toEqual({ id: "asc" });
    expect(args.where).toMatchObject({ crawlJobId: "c1", id: { gt: "i2" } });
    const or = args.where.OR as { ruleId?: unknown; type?: { in: string[] } }[];
    const ids = (or[0]!.ruleId as { in: string[] }).in;
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id.startsWith("page_titles."))).toBe(true);
    expect(or.some((o) => o.type?.in.includes("TITLE_TOO_LONG"))).toBe(true);
    expect(JSON.stringify(args.where)).toContain("segmentIds");
  });

  it.each([
    ["ruleId=nope.rule", "unknown_rule"],
    ["family=nope", "unknown_family"],
    ["kind=error", "unknown_kind"],
  ])("refuses %s", async (q, error) => {
    const res = await issuesRoute.GET(req(`/api/public/v1/crawl/c1/issues?${q}`, KEY_A), ctx("c1"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(error);
  });

  it("an unknown segment is a 400", async () => {
    expect((await issuesRoute.GET(req("/api/public/v1/crawl/c1/issues?segment=7", KEY_A), ctx("c1"))).status).toBe(400);
  });
});

describe("GET /crawl/{id}/pages and /export: the dashboard handlers, as the key's tenant", () => {
  it("pages: forwards cursor, segment and status; 200 rows at most; runs as the key's tenant", async () => {
    const res = await pagesRoute.GET(req("/api/public/v1/crawl/c1/pages?cursor=p9&segment=0&status=4xx&limit=900&q=ignored", KEY_A), ctx("c1"));
    expect(res.status).toBe(200);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.tenantId).toBe("t_a");
    const q = new URL(seen[0]!.url).searchParams;
    expect(Object.fromEntries(q)).toEqual({ pageSize: "200", cursor: "p9", segment: "0", status: "4xx" });
  });

  it.each([
    ["issues", "export", null],
    ["broken-links", "export", "broken-links"],
    ["redirects", "export", "redirects"],
    ["pages", "pages", null],
    ["external", "external", null],
  ])("export view=%s streams the dashboard's %s CSV", async (view, route, forwardedView) => {
    const res = await exportRoute.GET(req(`/api/public/v1/crawl/c1/export?view=${view}&segment=0`, KEY_A), ctx("c1"));
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(seen[0]!.route).toBe(route);
    expect(seen[0]!.tenantId).toBe("t_a");
    const q = new URL(seen[0]!.url).searchParams;
    expect(q.get("view")).toBe(forwardedView);
    expect(q.get("segment")).toBe("0");
  });

  it("an unknown view is a 400, and the context never leaks past the call", async () => {
    expect((await exportRoute.GET(req("/api/public/v1/crawl/c1/export?view=everything", KEY_A), ctx("c1"))).status).toBe(400);
    await pagesRoute.GET(req("/api/public/v1/crawl/c1/pages", KEY_A), ctx("c1"));
    const { requirePaidPlan } = await import("@/lib/paid-plan");
    await expect(requirePaidPlan()).rejects.toThrow("no session in the public API");
  });
});

describe("POST /crawl/{id}/cancel", () => {
  it("cancels the key's crawl and answers with its status", async () => {
    const res = await cancelRoute.POST(req("/api/public/v1/crawl/c1/cancel", KEY_A, "POST"), ctx("c1"));
    expect(await res.json()).toMatchObject({ crawlId: "c1", status: "cancelled" });
    expect(cancelCrawl).toHaveBeenCalledWith("t_a", "c1");
  });
});
