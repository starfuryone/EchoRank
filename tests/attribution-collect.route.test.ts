// POST /api/collect — the attribution beacon.
//
// Covers what a route test can reach without a browser or a database: the
// authorization boundary (key → tenant, and nothing else), the two rate limits,
// the server-authoritative classification, the upsert shape, and the fact that
// every outcome looks identical from outside.
//
// Prisma, Redis and the rate limiter are stubbed; the key parser, the classifier
// and the whole request-handling path are the real code.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const aiVisit = { upsert: vi.fn() };
const attributionKey = { findUnique: vi.fn(), update: vi.fn(), findFirst: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { aiVisit, attributionKey } }));

const rateLimit = vi.fn(async (..._a: unknown[]) => ({ success: true, remaining: 10 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a) }));

const redisStore = new Map<string, string>();
const redis = {
  get: vi.fn(async (k: string) => redisStore.get(k) ?? null),
  set: vi.fn(async (k: string, v: string) => {
    redisStore.set(k, v);
    return "OK";
  }),
  del: vi.fn(async (k: string) => (redisStore.delete(k) ? 1 : 0)),
};
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => redis }));

// ─── Imports under test (after the mocks) ───────────────────────────────────

const { POST, OPTIONS, COLLECT_LIMIT_PER_IP, COLLECT_LIMIT_PER_TENANT_IP } = await import(
  "@/app/api/collect/route"
);
const { __testing } = await import("@/lib/attribution/keys");

// ─── Fixtures ───────────────────────────────────────────────────────────────

const KEY_A = `er_pub_${"a".repeat(24)}.${"1".repeat(48)}`;
const KEY_B = `er_pub_${"b".repeat(24)}.${"2".repeat(48)}`;
const VID = "0123456789abcdef0123456789abcdef";

function keyRow(key: string, tenantId: string, id: string) {
  const secret = key.split(".")[1];
  return { id, tenantId, keyHash: __testing.sha256(secret), revokedAt: null };
}

function beacon(body: unknown, ip = "203.0.113.10"): Request {
  return new Request("https://echorank360.com/api/collect", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8", "cf-connecting-ip": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const GOOD = { k: KEY_A, v: VID, u: "https://example.com/pricing", r: "https://chatgpt.com/" };

beforeEach(() => {
  vi.clearAllMocks();
  redisStore.clear();
  rateLimit.mockResolvedValue({ success: true, remaining: 10 });
  attributionKey.findUnique.mockImplementation(async ({ where }: { where: { keyHash: string } }) => {
    const a = keyRow(KEY_A, "tenant-a", "key-a");
    const b = keyRow(KEY_B, "tenant-b", "key-b");
    if (where.keyHash === a.keyHash) return a;
    if (where.keyHash === b.keyHash) return b;
    return null;
  });
  aiVisit.upsert.mockResolvedValue({});
  // The lastUsedAt write is fire-and-forget (`void …update().catch()`), so the
  // stub has to return a thenable the way the real client does.
  attributionKey.update.mockResolvedValue({});
});

// ─── Uniform response ───────────────────────────────────────────────────────

describe("every outcome is an indistinguishable 204", () => {
  it("stores a real beacon and returns 204 with no body", async () => {
    const res = await POST(beacon(GOOD));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(aiVisit.upsert).toHaveBeenCalledOnce();
  });

  it.each([
    ["unknown key", { ...GOOD, k: `er_pub_${"f".repeat(24)}.${"9".repeat(48)}` }],
    ["malformed key", { ...GOOD, k: "er_api_nope" }],
    ["missing key", { ...GOOD, k: undefined }],
    ["bad visitor id", { ...GOOD, v: "not-hex" }],
    ["missing visitor id", { ...GOOD, v: undefined }],
    ["missing landing url", { ...GOOD, u: undefined }],
    ["non-AI referrer", { ...GOOD, r: "https://www.facebook.com/" }],
    ["plain Bing search", { ...GOOD, r: "https://www.bing.com/search?q=widgets" }],
  ])("%s → 204, nothing written", async (_name, body) => {
    const res = await POST(beacon(body));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(aiVisit.upsert).not.toHaveBeenCalled();
  });

  it("survives junk that is not JSON at all", async () => {
    const res = await POST(beacon("<html>not json</html>"));
    expect(res.status).toBe(204);
    expect(aiVisit.upsert).not.toHaveBeenCalled();
  });

  it("refuses a body larger than the cap before parsing it", async () => {
    const res = await POST(beacon(JSON.stringify({ ...GOOD, pad: "x".repeat(8000) })));
    expect(res.status).toBe(204);
    expect(aiVisit.upsert).not.toHaveBeenCalled();
  });

  it("answers a CORS preflight", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});

// ─── Tenant isolation ───────────────────────────────────────────────────────

describe("tenant isolation", () => {
  it("writes to the tenant the KEY resolves to, never one from the body", async () => {
    await POST(beacon({ ...GOOD, k: KEY_B, tenantId: "tenant-a" }));
    const args = aiVisit.upsert.mock.calls[0][0];
    expect(args.where.tenantId_visitorId_source_landingPath.tenantId).toBe("tenant-b");
    expect(args.create.tenantId).toBe("tenant-b");
  });

  it("two keys write to two tenants for identical payloads", async () => {
    await POST(beacon({ ...GOOD, k: KEY_A }));
    await POST(beacon({ ...GOOD, k: KEY_B }));
    const tenants = aiVisit.upsert.mock.calls.map(
      (c) => c[0].where.tenantId_visitorId_source_landingPath.tenantId,
    );
    expect(tenants).toEqual(["tenant-a", "tenant-b"]);
  });

  it("a revoked key writes nothing", async () => {
    attributionKey.findUnique.mockResolvedValueOnce({
      ...keyRow(KEY_A, "tenant-a", "key-a"),
      revokedAt: new Date(),
    });
    await POST(beacon(GOOD));
    expect(aiVisit.upsert).not.toHaveBeenCalled();
  });

  it("the unique constraint is tenant-first, so a write cannot escape its tenant", async () => {
    await POST(beacon(GOOD));
    const where = aiVisit.upsert.mock.calls[0][0].where;
    expect(Object.keys(where)).toEqual(["tenantId_visitorId_source_landingPath"]);
    expect(Object.keys(where.tenantId_visitorId_source_landingPath)[0]).toBe("tenantId");
  });
});

// ─── Rate limits ────────────────────────────────────────────────────────────

describe("rate limits", () => {
  it("checks the per-IP budget BEFORE resolving the key", async () => {
    rateLimit.mockResolvedValueOnce({ success: false, remaining: 0 });
    await POST(beacon(GOOD));
    expect(attributionKey.findUnique).not.toHaveBeenCalled();
    expect(aiVisit.upsert).not.toHaveBeenCalled();
  });

  it("checks a per-tenant-per-IP budget after the key resolves", async () => {
    rateLimit
      .mockResolvedValueOnce({ success: true, remaining: 10 })
      .mockResolvedValueOnce({ success: false, remaining: 0 });
    await POST(beacon(GOOD));
    expect(attributionKey.findUnique).toHaveBeenCalled();
    expect(aiVisit.upsert).not.toHaveBeenCalled();
  });

  it("keys the two buckets on IP and on tenant+IP, with the documented limits", async () => {
    await POST(beacon(GOOD, "198.51.100.7"));
    expect(rateLimit).toHaveBeenNthCalledWith(
      1,
      "collect:ip:198.51.100.7",
      COLLECT_LIMIT_PER_IP,
      60_000,
    );
    expect(rateLimit).toHaveBeenNthCalledWith(
      2,
      "collect:tenant-a:198.51.100.7",
      COLLECT_LIMIT_PER_TENANT_IP,
      60_000,
    );
  });
});

// ─── Server-authoritative classification ────────────────────────────────────

describe("the server classifies, the client does not", () => {
  it("derives the source from the referrer it was sent", async () => {
    await POST(beacon({ ...GOOD, r: "https://www.perplexity.ai/search/x" }));
    expect(aiVisit.upsert.mock.calls[0][0].create.source).toBe("perplexity");
  });

  it("ignores a source the caller tries to declare", async () => {
    await POST(beacon({ ...GOOD, r: "https://claude.ai/", source: "chatgpt", s: "chatgpt" }));
    expect(aiVisit.upsert.mock.calls[0][0].create.source).toBe("claude");
  });

  it("refuses to invent a source for traffic it cannot prove is AI", async () => {
    await POST(beacon({ ...GOOD, r: "", u: "https://example.com/pricing" }));
    expect(aiVisit.upsert).not.toHaveBeenCalled();
  });
});

// ─── What gets stored ───────────────────────────────────────────────────────

describe("upsert semantics", () => {
  it("firstSeen is set on create and NEVER present in update", async () => {
    // The 28-day trend is keyed on firstSeen. If a repeat visit could move it,
    // every returning visitor would re-date their own first arrival and inflate
    // the chart. This assertion is the guard on that.
    await POST(beacon(GOOD));
    const args = aiVisit.upsert.mock.calls[0][0];
    expect(args.create.firstSeen).toBeInstanceOf(Date);
    expect(args.update).not.toHaveProperty("firstSeen");
  });

  it("a repeat arrival bumps lastSeen and increments hits", async () => {
    await POST(beacon(GOOD));
    const args = aiVisit.upsert.mock.calls[0][0];
    expect(args.update.lastSeen).toBeInstanceOf(Date);
    expect(args.update.hits).toEqual({ increment: 1 });
  });

  it("the natural key is (tenant, visitor, source, landingPath)", async () => {
    await POST(beacon(GOOD));
    expect(aiVisit.upsert.mock.calls[0][0].where.tenantId_visitorId_source_landingPath).toEqual({
      tenantId: "tenant-a",
      visitorId: VID,
      source: "chatgpt",
      landingPath: "/pricing",
    });
  });

  it("stores the path only, and captures utm from the landing URL", async () => {
    await POST(
      beacon({
        ...GOOD,
        u: "https://example.com/pricing?utm_source=chatgpt.com&utm_campaign=launch#plans",
      }),
    );
    const create = aiVisit.upsert.mock.calls[0][0].create;
    expect(create.landingPath).toBe("/pricing");
    expect(create.utm).toEqual({ utm_source: "chatgpt.com", utm_campaign: "launch" });
  });

  it("strips the query from the stored referrer", async () => {
    await POST(beacon({ ...GOOD, r: "https://www.bing.com/chat?q=my+private+question" }));
    expect(aiVisit.upsert.mock.calls[0][0].create.referrer).toBe("https://www.bing.com/chat");
  });

  it("omits utm entirely when the landing URL carries none", async () => {
    await POST(beacon(GOOD));
    expect(aiVisit.upsert.mock.calls[0][0].create.utm).toBeUndefined();
  });
});

// ─── Key caching ────────────────────────────────────────────────────────────

describe("key resolution is cached", () => {
  it("hits the database once, then serves the tenant from Redis", async () => {
    await POST(beacon(GOOD));
    await POST(beacon(GOOD));
    expect(attributionKey.findUnique).toHaveBeenCalledOnce();
    expect(aiVisit.upsert).toHaveBeenCalledTimes(2);
  });

  it("caches a miss too, so a wrong key on a live site is not a query per view", async () => {
    const bogus = { ...GOOD, k: `er_pub_${"c".repeat(24)}.${"3".repeat(48)}` };
    await POST(beacon(bogus));
    await POST(beacon(bogus));
    expect(attributionKey.findUnique).toHaveBeenCalledOnce();
    expect(aiVisit.upsert).not.toHaveBeenCalled();
  });

  it("records lastUsedAt on the cache miss, not on every beacon", async () => {
    await POST(beacon(GOOD));
    await POST(beacon(GOOD));
    await POST(beacon(GOOD));
    expect(attributionKey.update).toHaveBeenCalledOnce();
  });
});
