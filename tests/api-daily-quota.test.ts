// The public API's daily allowance per workspace (src/lib/api-daily-quota.ts):
// PLAN_CONFIGS maxApiRequestsPerDay, a Redis INCR per UTC day, alongside the
// per-key 60/min window, wired into authenticatePublicRequest.
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  kv: new Map<string, number>(),
  down: false,
  expire: vi.fn(async () => 1),
  apiKey: { findUnique: vi.fn(), update: vi.fn(() => ({ catch: () => {} })) },
  tenant: { findUnique: vi.fn() },
  rateLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => ({
    incr: async (k: string) => {
      if (m.down) throw new Error("ECONNREFUSED");
      const v = (m.kv.get(k) ?? 0) + 1;
      m.kv.set(k, v);
      return v;
    },
    decr: async (k: string) => {
      const v = (m.kv.get(k) ?? 0) - 1;
      m.kv.set(k, v);
      return v;
    },
    expire: m.expire,
  }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { apiKey: m.apiKey, tenant: m.tenant } }));
vi.mock("@/lib/paid-plan", () => ({ hasPaidPlan: async () => true }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rateLimit }));

import { PLAN_CONFIGS } from "@/lib/plan-config";
import { apiDailyLimit, apiDailyQuotaKey, apiDailyResetsAt, consumeApiRequest } from "@/lib/api-daily-quota";
import { authenticatePublicRequest, __testing as keys } from "@/lib/api-keys";

const NOW = new Date("2026-11-14T15:30:00Z");

beforeEach(() => {
  m.kv.clear();
  m.down = false;
  vi.clearAllMocks();
});

describe("consumeApiRequest", () => {
  it("reads the limit from PLAN_CONFIGS, never a copy", () => {
    expect(apiDailyLimit("AGENCY")).toBe(PLAN_CONFIGS.AGENCY.quotaDefaults.maxApiRequestsPerDay);
    expect(apiDailyLimit("ENTERPRISE")).toBe(PLAN_CONFIGS.ENTERPRISE.quotaDefaults.maxApiRequestsPerDay);
  });

  it("keys per workspace per UTC day and resets at the next 00:00 UTC", () => {
    expect(apiDailyQuotaKey("t1", NOW)).toBe("echorank:api:requests:t1:2026-11-14");
    expect(apiDailyResetsAt(NOW).toISOString()).toBe("2026-11-15T00:00:00.000Z");
  });

  it("allows up to the limit, refuses the next one and gives its slot back", async () => {
    const limit = apiDailyLimit("AGENCY");
    m.kv.set(apiDailyQuotaKey("t1", NOW), limit - 1);
    expect(await consumeApiRequest("t1", "AGENCY", NOW)).toMatchObject({ allowed: true, used: limit, limit });
    expect(await consumeApiRequest("t1", "AGENCY", NOW)).toMatchObject({ allowed: false, used: limit, limit });
    expect(m.kv.get(apiDailyQuotaKey("t1", NOW))).toBe(limit);
    // Another workspace, and tomorrow, start from zero.
    expect((await consumeApiRequest("t2", "AGENCY", NOW)).used).toBe(1);
    expect((await consumeApiRequest("t1", "AGENCY", new Date("2026-11-15T00:00:01Z"))).used).toBe(1);
  });

  it("sets the TTL once, on the day's first request", async () => {
    await consumeApiRequest("t1", "AGENCY", NOW);
    await consumeApiRequest("t1", "AGENCY", NOW);
    expect(m.expire).toHaveBeenCalledTimes(1);
  });

  it("fails open when Redis is unreachable", async () => {
    m.down = true;
    expect((await consumeApiRequest("t1", "AGENCY", NOW)).allowed).toBe(true);
  });
});

describe("authenticatePublicRequest", () => {
  const key = `${keys.KEY_PREFIX}${"a".repeat(16)}.${"b".repeat(64)}`;
  const call = () =>
    authenticatePublicRequest(
      new Request("https://echorank360.com/api/public/v1/visibility/summary", { headers: { authorization: `Bearer ${key}` } }),
    );

  beforeEach(() => {
    m.apiKey.findUnique.mockResolvedValue({ id: "k1", tenantId: "t1", keyHash: keys.sha256("b".repeat(64)), revokedAt: null, scopes: ["public"] });
    m.tenant.findUnique.mockResolvedValue({ planType: "AGENCY" });
  });

  it("answers 429 daily_limit_reached with Retry-After once the day's allowance is spent", async () => {
    const limit = apiDailyLimit("AGENCY");
    m.kv.set(apiDailyQuotaKey("t1"), limit);
    const out = await call();
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.response.status).toBe(429);
    expect(Number(out.response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await out.response.json()).toMatchObject({ error: "daily_limit_reached", limit });
  });

  it("counts a request that passes", async () => {
    expect((await call()).ok).toBe(true);
    expect(m.kv.get(apiDailyQuotaKey("t1"))).toBe(1);
  });

  it("does not spend the day on a request the per-minute window refused", async () => {
    m.rateLimit.mockResolvedValueOnce({ success: false });
    const out = await call();
    expect(out.ok).toBe(false);
    expect(m.kv.get(apiDailyQuotaKey("t1"))).toBeUndefined();
  });

  it("does not spend the day on a plan without API access", async () => {
    m.tenant.findUnique.mockResolvedValue({ planType: "GROWTH" });
    expect((await call()).ok).toBe(false);
    expect(m.kv.size).toBe(0);
  });
});
