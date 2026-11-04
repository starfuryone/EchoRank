// tests/free-crawler-limits.test.ts — the free public crawler's limits and
// abuse checks (commit 2), through POST /api/free/v1/site-crawler:
//   - cf-connecting-ip required; the URL through url-guard;
//   - the opt-out list (subdomains included), checked before Turnstile;
//   - Turnstile verified server-side (failed → 403, unconfigured → 503);
//   - one crawl per registrable domain per 24 h: a second request (any
//     subdomain, any IP) gets the first crawl's token and costs no allowance;
//   - 3 new starts per IP per UTC day (Redis INCR + TTL), refused at the 4th;
//   - the flag off → 404;
//   - /api/admin/free-crawler: staff only, add / remove, host normalised.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ─── Redis (INCR/EXPIRE/TTL/DECR/SET NX/DEL) ────────────────────────────────
const kv = new Map<string, { v: string; ttl: number }>();
const redis = {
  incr: vi.fn(async (k: string) => {
    const n = Number(kv.get(k)?.v ?? 0) + 1;
    kv.set(k, { v: String(n), ttl: kv.get(k)?.ttl ?? -1 });
    return n;
  }),
  decr: vi.fn(async (k: string) => {
    const n = Number(kv.get(k)?.v ?? 0) - 1;
    kv.set(k, { v: String(n), ttl: kv.get(k)?.ttl ?? -1 });
    return n;
  }),
  expire: vi.fn(async (k: string, s: number) => {
    const e = kv.get(k);
    if (e) e.ttl = s;
    return 1;
  }),
  ttl: vi.fn(async (k: string) => kv.get(k)?.ttl ?? -2),
  set: vi.fn(async (k: string, v: string, ...args: unknown[]) => {
    if (args.includes("NX") && kv.has(k)) return null;
    kv.set(k, { v, ttl: 30 });
    return "OK";
  }),
  del: vi.fn(async (k: string) => (kv.delete(k) ? 1 : 0)),
};
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => redis }));

// ─── Postgres ───────────────────────────────────────────────────────────────
const freeCrawls: { token: string; domain: string; host: string; ipHash: string; createdAt: Date; crawlJobId: string }[] = [];
const blocked = new Map<string, { host: string; note: string | null }>();
const jobs: Record<string, unknown>[] = [];
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: { upsert: vi.fn(async () => ({ id: "t_free" })) },
    crawlJob: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        jobs.push(data);
        return { id: `c${jobs.length}`, tenantId: data.tenantId };
      }),
    },
    freeCrawl: {
      findFirst: vi.fn(async ({ where }: { where: { domain: string; createdAt: { gt: Date } } }) => {
        const hit = freeCrawls.filter((f) => f.domain === where.domain && f.createdAt > where.createdAt.gt).at(-1);
        return hit ? { token: hit.token } : null;
      }),
      create: vi.fn(async ({ data }: { data: Omit<(typeof freeCrawls)[number], "createdAt"> }) => {
        freeCrawls.push({ ...data, createdAt: clock.now });
        return data;
      }),
    },
    freeCrawlBlockedHost: {
      findFirst: vi.fn(async ({ where }: { where: { host: { in: string[] } } }) => (where.host.in.some((h) => blocked.has(h)) ? { id: "b" } : null)),
      upsert: vi.fn(async ({ where, create }: { where: { host: string }; create: { host: string; note: string | null } }) => {
        blocked.set(where.host, create);
        return create;
      }),
      deleteMany: vi.fn(async ({ where }: { where: { host: string } }) => ({ count: blocked.delete(where.host) ? 1 : 0 })),
    },
  },
}));
const addJob = vi.fn(async () => ({ id: "j" }));
vi.mock("@/infrastructure/queue/registry", () => ({ addJob: (...a: unknown[]) => addJob(...(a as [])) }));

const turnstile = vi.hoisted(() => ({ outcome: "ok" as "ok" | "failed" | "unconfigured", calls: 0 }));
vi.mock("@/lib/snapshot/turnstile", () => ({
  verifyTurnstile: async () => {
    turnstile.calls++;
    return turnstile.outcome;
  },
}));
const flags = vi.hoisted(() => ({ free: true }));
vi.mock("@/lib/flags", async (orig) => {
  const real = await orig<typeof import("@/lib/flags")>();
  return { ...real, flag: (name: string) => (name === "crawl.free" ? flags.free : real.flag(name as never)) };
});
const platform = vi.hoisted(() => ({ email: "staff@echorank360.com" as string | null }));
vi.mock("@/lib/platform-admin", async () => {
  const { NextResponse } = await import("next/server");
  return { requirePlatformAdminApi: async () => (platform.email ? { email: platform.email } : NextResponse.json({ error: "forbidden" }, { status: 403 })) };
});

const clock = vi.hoisted(() => ({ now: new Date("2026-11-05T10:00:00Z") }));
vi.useFakeTimers({ toFake: ["Date"] });

const route = await import("@/app/api/free/v1/site-crawler/route");
const adminRoute = await import("@/app/api/admin/free-crawler/route");
const { FREE_CRAWL_IP_DAILY, normalizeBlockedHost } = await import("@/lib/site-crawler/free-crawl");

function start(body: Record<string, unknown>, ip: string | null = "203.0.113.7") {
  return route.POST(
    new Request("https://echorank360.com/api/free/v1/site-crawler", {
      method: "POST",
      headers: { "content-type": "application/json", ...(ip ? { "cf-connecting-ip": ip } : {}) },
      body: JSON.stringify({ turnstileToken: "XXXX.DUMMY.TOKEN", ...body }),
    }),
  );
}

beforeEach(() => {
  kv.clear();
  for (const f of Object.values(redis)) f.mockClear();
  freeCrawls.length = 0;
  blocked.clear();
  jobs.length = 0;
  addJob.mockClear();
  turnstile.outcome = "ok";
  turnstile.calls = 0;
  flags.free = true;
  platform.email = "staff@echorank360.com";
  clock.now = new Date("2026-11-05T10:00:00Z");
  vi.setSystemTime(clock.now);
});

describe("POST /api/free/v1/site-crawler", () => {
  it("starts a crawl: 202 with a result token, queued on the system tenant at 100 URLs", async () => {
    const res = await start({ url: "https://shop.example.org/" });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toMatchObject({ reused: false });
    expect(body.token).toMatch(/^[\w-]{24}$/);
    expect(jobs[0]).toMatchObject({ tenantId: "t_free", urlCap: 100, mode: "spider", renderMode: "none" });
    expect(freeCrawls[0]).toMatchObject({ domain: "example.org", host: "shop.example.org" });
    expect(freeCrawls[0]!.ipHash).not.toContain("203.0.113.7");
  });

  it.each([
    ["no cf-connecting-ip", { url: "https://example.org/" }, null, 400, "no_ip"],
    ["a private host", { url: "http://127.0.0.1/" }, "203.0.113.7", 400, "invalid_url"],
    ["not a URL", { url: "javascript:alert(1)" }, "203.0.113.7", 400, "invalid_url"],
    ["no body", {}, "203.0.113.7", 400, "invalid_request"],
  ])("refuses %s", async (_name, body, ip, status, error) => {
    const res = await start(body, ip as string | null);
    expect([res.status, (await res.json()).error]).toEqual([status, error]);
    expect(jobs).toHaveLength(0);
  });

  it("refuses a blocked host and its subdomains, before Turnstile and without spending an allowance", async () => {
    blocked.set("example.org", { host: "example.org", note: null });
    for (const url of ["https://example.org/", "https://www.blog.example.org/x"]) {
      const res = await start({ url });
      expect([res.status, (await res.json()).error]).toEqual([403, "blocked"]);
    }
    expect(turnstile.calls).toBe(0);
    expect(redis.incr).not.toHaveBeenCalled();
    expect((await start({ url: "https://example.net/" })).status).toBe(202);
  });

  it("Turnstile: a failed challenge is 403, an unconfigured secret 503; neither starts a crawl", async () => {
    turnstile.outcome = "failed";
    let res = await start({ url: "https://example.org/" });
    expect([res.status, (await res.json()).error]).toEqual([403, "turnstile"]);
    turnstile.outcome = "unconfigured";
    res = await start({ url: "https://example.org/" });
    expect([res.status, (await res.json()).error]).toEqual([503, "unavailable"]);
    expect(jobs).toHaveLength(0);
  });

  it("one crawl per registrable domain per 24 h: a repeat (any subdomain, any IP) gets the first result and costs no allowance", async () => {
    const first = await (await start({ url: "https://www.shop.co.uk/" })).json();
    redis.incr.mockClear();
    vi.setSystemTime(new Date(clock.now.getTime() + 23 * 3_600_000));
    const again = await start({ url: "https://blog.shop.co.uk/" }, "198.51.100.9");
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ token: first.token, reused: true });
    expect(redis.incr).not.toHaveBeenCalled();
    expect(jobs).toHaveLength(1);
    // After the window: a new crawl.
    vi.setSystemTime(new Date(clock.now.getTime() + 25 * 3_600_000));
    expect((await start({ url: "https://shop.co.uk/" }, "198.51.100.9")).status).toBe(202);
    expect(jobs).toHaveLength(2);
  });

  it(`${3} new starts per IP per UTC day (INCR with a TTL to midnight), the 4th refused`, async () => {
    expect(FREE_CRAWL_IP_DAILY).toBe(3);
    for (const d of ["a.org", "b.org", "c.org"]) expect((await start({ url: `https://${d}/` })).status).toBe(202);
    const res = await start({ url: "https://d.org/" });
    expect([res.status, (await res.json()).error]).toEqual([429, "rate_limited"]);
    const [key, entry] = [...kv.entries()].find(([k]) => k.includes("site-crawler"))!;
    expect(key).toContain("203.0.113.7");
    expect(entry.ttl).toBeGreaterThan(0);
    expect(entry.ttl).toBeLessThanOrEqual(86_400);
    // Another IP is not affected.
    expect((await start({ url: "https://d.org/" }, "198.51.100.9")).status).toBe(202);
  });

  it("is a 404 with the flag off", async () => {
    flags.free = false;
    expect((await start({ url: "https://example.org/" })).status).toBe(404);
  });
});

describe("POST /api/admin/free-crawler (staff only)", () => {
  const form = (fields: Record<string, string>, headers: Record<string, string> = {}) =>
    adminRoute.POST(new Request("https://app.test/api/admin/free-crawler", { method: "POST", headers, body: new URLSearchParams(fields) }));

  it("adds and removes a host, normalised, then the free crawler refuses / accepts it", async () => {
    const res = await form({ action: "add", host: "https://WWW.Example.org/path", note: "owner asked 2026-11-05" });
    expect([res.status, res.headers.get("location")]).toEqual([303, "https://app.test/admin/free-crawler?saved=add"]);
    expect(blocked.has("example.org")).toBe(true);
    expect((await start({ url: "https://example.org/" })).status).toBe(403);
    await form({ action: "remove", host: "example.org" });
    expect(blocked.size).toBe(0);
    expect((await start({ url: "https://example.org/" })).status).toBe(202);
  });

  it("refuses non-staff, a bad host and a cross-site form", async () => {
    platform.email = null;
    expect((await form({ action: "add", host: "example.org" })).status).toBe(403);
    platform.email = "staff@echorank360.com";
    expect((await form({ action: "add", host: "not a host" })).status).toBe(400);
    expect((await form({ action: "add", host: "example.org" }, { origin: "https://evil.example", host: "app.test" })).status).toBe(403);
    expect(blocked.size).toBe(0);
  });

  it.each([
    ["example.org", "example.org"],
    ["WWW.example.org", "example.org"],
    ["https://blog.example.co.uk:8443/x", "blog.example.co.uk"],
    ["localhost", null],
    ["", null],
  ])("normalizeBlockedHost(%j) = %j", (raw, out) => {
    expect(normalizeBlockedHost(raw)).toBe(out);
  });
});
