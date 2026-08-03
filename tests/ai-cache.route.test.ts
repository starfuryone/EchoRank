// Result caching for AI call sites.
//
// The load-bearing assertion in every block below is the same: a SECOND
// identical call produces no outbound request. That is the whole saving —
// prompt caching cannot engage anywhere in this codebase (Haiku 4.5 needs a
// 4096-token static prefix; our largest system prompt is ~105), so a repeat
// either costs full price or costs nothing.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

// No importOriginal here: @/lib/tenant pulls in auth -> prisma, which needs a
// DATABASE_URL this suite has no business requiring.
const requireTenant = vi.fn();
vi.mock("@/lib/tenant", () => ({
  requireTenant: () => requireTenant(),
  getCurrentTenant: () => requireTenant(),
  ACTIVE_TENANT_COOKIE: "echorank_active_tenant",
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const requireFeature = vi.fn(async () => undefined);
const requireQuota = vi.fn(async () => undefined);
vi.mock("@/lib/plan-enforcement", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/plan-enforcement")>()),
  requireFeature: (...a: unknown[]) => requireFeature(...(a as [])),
  requireQuota: (...a: unknown[]) => requireQuota(...(a as [])),
}));

const sidecarPost = vi.fn();
vi.mock("@/lib/av-sidecar", () => ({ sidecarPost: (...a: unknown[]) => sidecarPost(...a) }));

const resolveTenant = vi.fn();
vi.mock("@/lib/signals/auth-adapter", () => ({ resolveTenant: () => resolveTenant() }));

// A real-enough Redis: a Map with EX ignored (TTL is not what these test).
const store = new Map<string, string>();
const redis = {
  get: vi.fn(async (k: string) => store.get(k) ?? null),
  set: vi.fn(async (k: string, v: string) => { store.set(k, v); return "OK"; }),
};
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => redis,
  getSubscriberConnection: () => redis,
}));

const { POST: REMEDIATE } = await import("@/app/api/ai/visibility/remediate/route");
const { POST: KEYWORDS } = await import("@/app/api/ai/visibility/keywords/route");
const { POST: RESPOND } = await import("@/app/api/ai/respond/route");
const { aiCacheKey } = await import("@/lib/ai-cache");

const TENANT = "tenant_a";

function post(url: string, body: unknown) {
  return new Request(`https://echorank360.com${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  requirePaidPlan.mockResolvedValue({ tenantId: TENANT, tenant: { planType: "GROWTH" } });
  requireTenant.mockResolvedValue({ tenantId: TENANT, tenant: { planType: "GROWTH" } });
  resolveTenant.mockResolvedValue({ tenantId: TENANT });
  sidecarPost.mockResolvedValue({ status: 200, data: { fixes: ["a"], ok: true } });
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ content: [{ type: "text", text: "Thanks for the review." }] }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

// ── Key derivation ──────────────────────────────────────────────────────────

describe("cache keys", () => {
  it("is stable regardless of object key order", () => {
    expect(aiCacheKey("n", TENANT, { a: 1, b: 2 })).toBe(aiCacheKey("n", TENANT, { b: 2, a: 1 }));
  });

  it("separates tenants", () => {
    expect(aiCacheKey("n", "t1", { a: 1 })).not.toBe(aiCacheKey("n", "t2", { a: 1 }));
  });

  it("separates namespaces and inputs", () => {
    expect(aiCacheKey("n1", TENANT, { a: 1 })).not.toBe(aiCacheKey("n2", TENANT, { a: 1 }));
    expect(aiCacheKey("n", TENANT, { a: 1 })).not.toBe(aiCacheKey("n", TENANT, { a: 2 }));
  });
});

// ── remediate ───────────────────────────────────────────────────────────────

describe("remediate", () => {
  const body = { url: "https://echorank360.com/", crawl: true };

  it("calls the sidecar once, then serves the repeat from cache", async () => {
    const first = await REMEDIATE(post("/api/ai/visibility/remediate", body));
    expect(first.status).toBe(200);
    expect((await first.json()).cached).toBe(false);
    expect(sidecarPost).toHaveBeenCalledTimes(1);

    const second = await REMEDIATE(post("/api/ai/visibility/remediate", body));
    const payload = await second.json();
    expect(payload.cached).toBe(true);
    expect(payload.fixes).toEqual(["a"]);
    expect(sidecarPost, "second call must not reach the sidecar").toHaveBeenCalledTimes(1);
  });

  it("does not consume quota on a cache hit", async () => {
    await REMEDIATE(post("/api/ai/visibility/remediate", body));
    expect(requireQuota).toHaveBeenCalledTimes(1);
    await REMEDIATE(post("/api/ai/visibility/remediate", body));
    expect(requireQuota, "a stored result must not cost an allowance").toHaveBeenCalledTimes(1);
  });

  it("misses when the url changes", async () => {
    await REMEDIATE(post("/api/ai/visibility/remediate", body));
    await REMEDIATE(post("/api/ai/visibility/remediate", { ...body, url: "https://other.com/" }));
    expect(sidecarPost).toHaveBeenCalledTimes(2);
  });

  it("misses when crawl flips", async () => {
    await REMEDIATE(post("/api/ai/visibility/remediate", body));
    await REMEDIATE(post("/api/ai/visibility/remediate", { ...body, crawl: false }));
    expect(sidecarPost).toHaveBeenCalledTimes(2);
  });

  it("bypasses the cache with fresh:true, and refreshes it", async () => {
    await REMEDIATE(post("/api/ai/visibility/remediate", body));
    const res = await REMEDIATE(post("/api/ai/visibility/remediate", { ...body, fresh: true }));
    expect((await res.json()).cached).toBe(false);
    expect(sidecarPost).toHaveBeenCalledTimes(2);
  });

  it("is scoped per tenant", async () => {
    await REMEDIATE(post("/api/ai/visibility/remediate", body));
    requireTenant.mockResolvedValue({ tenantId: "tenant_b", tenant: { planType: "GROWTH" } });
    await REMEDIATE(post("/api/ai/visibility/remediate", body));
    expect(sidecarPost).toHaveBeenCalledTimes(2);
  });

  it("NEVER caches a failure", async () => {
    sidecarPost.mockResolvedValue({ status: 502, data: { error: "sidecar down" } });
    const first = await REMEDIATE(post("/api/ai/visibility/remediate", body));
    expect(first.status).toBe(502);

    sidecarPost.mockResolvedValue({ status: 200, data: { fixes: ["recovered"] } });
    const second = await REMEDIATE(post("/api/ai/visibility/remediate", body));
    expect(second.status).toBe(200);
    expect((await second.json()).fixes).toEqual(["recovered"]);
  });
});

// ── keywords (AI path only) ─────────────────────────────────────────────────

describe("keywords ai-enhance", () => {
  const aiBody = { url: "https://echorank360.com/", ai: true };

  beforeEach(() => {
    sidecarPost.mockResolvedValue({ status: 200, data: { seed_keywords: ["a", "b"] } });
  });

  it("caches the AI path", async () => {
    const first = await KEYWORDS(post("/api/ai/visibility/keywords", aiBody));
    expect((await first.json()).cached).toBe(false);
    const second = await KEYWORDS(post("/api/ai/visibility/keywords", aiBody));
    expect((await second.json()).cached).toBe(true);
    expect(sidecarPost).toHaveBeenCalledTimes(1);
  });

  it("does NOT cache the heuristic path", async () => {
    // ai=false spends nothing, so caching would only serve a stale crawl.
    const b = { url: "https://echorank360.com/", ai: false };
    await KEYWORDS(post("/api/ai/visibility/keywords", b));
    await KEYWORDS(post("/api/ai/visibility/keywords", b));
    expect(sidecarPost).toHaveBeenCalledTimes(2);
  });

  it("keys ai=true separately from ai=false", async () => {
    await KEYWORDS(post("/api/ai/visibility/keywords", aiBody));
    await KEYWORDS(post("/api/ai/visibility/keywords", { ...aiBody, ai: false }));
    expect(sidecarPost).toHaveBeenCalledTimes(2);
  });

  it("does not cache an error payload returned with status 200", async () => {
    sidecarPost.mockResolvedValue({ status: 200, data: { error: "fetch failed" } });
    await KEYWORDS(post("/api/ai/visibility/keywords", aiBody));
    sidecarPost.mockResolvedValue({ status: 200, data: { seed_keywords: ["ok"] } });
    const second = await KEYWORDS(post("/api/ai/visibility/keywords", aiBody));
    expect((await second.json()).seed_keywords).toEqual(["ok"]);
  });
});

// ── respond ─────────────────────────────────────────────────────────────────

describe("respond", () => {
  const body = { reviewText: "Great service, fixed my sink fast.", rating: 5, tone: "warm" };

  it("calls Anthropic once, then serves the repeat from cache", async () => {
    const first = await RESPOND(post("/api/ai/respond", body));
    expect(first.status).toBe(200);
    expect((await first.json()).cached).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("api.anthropic.com");

    const second = await RESPOND(post("/api/ai/respond", body));
    const payload = await second.json();
    expect(payload.cached).toBe(true);
    expect(payload.draft).toBe("Thanks for the review.");
    expect(fetchMock, "second call must not reach Anthropic").toHaveBeenCalledTimes(1);
  });

  it("sends claude-haiku-4-5 on the wire", async () => {
    await RESPOND(post("/api/ai/respond", body));
    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.model).toBe("claude-haiku-4-5");
  });

  it("misses when the tone changes", async () => {
    await RESPOND(post("/api/ai/respond", body));
    await RESPOND(post("/api/ai/respond", { ...body, tone: "formal" }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("misses when the review text changes", async () => {
    await RESPOND(post("/api/ai/respond", body));
    await RESPOND(post("/api/ai/respond", { ...body, reviewText: "Different review." }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("bypasses with fresh:true", async () => {
    await RESPOND(post("/api/ai/respond", body));
    await RESPOND(post("/api/ai/respond", { ...body, fresh: true }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("NEVER caches a provider failure", async () => {
    fetchMock.mockResolvedValue(new Response("rate limited", { status: 429 }));
    const first = await RESPOND(post("/api/ai/respond", body));
    expect(first.status).toBe(502);

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ content: [{ type: "text", text: "Recovered." }] }), { status: 200 }),
    );
    const second = await RESPOND(post("/api/ai/respond", body));
    expect(second.status).toBe(200);
    expect((await second.json()).draft).toBe("Recovered.");
  });

  it("is scoped per tenant", async () => {
    await RESPOND(post("/api/ai/respond", body));
    resolveTenant.mockResolvedValue({ tenantId: "tenant_b" });
    await RESPOND(post("/api/ai/respond", body));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// ── Cache degradation ───────────────────────────────────────────────────────

describe("a broken cache never breaks a call", () => {
  it("still answers when Redis reads and writes throw", async () => {
    redis.get.mockRejectedValue(new Error("redis down"));
    redis.set.mockRejectedValue(new Error("redis down"));
    const res = await RESPOND(post("/api/ai/respond", { reviewText: "Fine work." }));
    expect(res.status).toBe(200);
    expect((await res.json()).draft).toBe("Thanks for the review.");
  });
});
