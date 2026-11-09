// The Link Authority Checker's API (2026-11-09): who may run a check, what a
// check costs the tenant's monthly allowance, and the old anonymous routes.
// The real requirePaidPlan runs against a faked session and billing rows; the
// DataForSEO layer (data.ts) is a fake that counts purchases; Redis is a map.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillingStatus, PlanType } from "@/generated/prisma";

const kv = vi.hoisted(() => new Map<string, string>());
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => ({
    get: async (k: string) => kv.get(k) ?? null,
    set: async (k: string, v: string) => {
      kv.set(k, v);
      return "OK";
    },
    incr: async (k: string) => {
      const n = Number(kv.get(k) ?? 0) + 1;
      kv.set(k, String(n));
      return n;
    },
    decr: async (k: string) => {
      const n = Number(kv.get(k) ?? 0) - 1;
      kv.set(k, String(n));
      return n;
    },
    expire: async () => 1,
  }),
}));

// The session and the billing rows requirePaidPlan reads.
const session = vi.hoisted(() => ({
  member: null as null | { tenantId: string; tenant: { id: string; planType: PlanType } },
  billingStatus: "ACTIVE" as BillingStatus,
  subscription: null as null | { status: BillingStatus; productKind: "PLAN" | "WATCHER" },
}));
vi.mock("@/lib/tenant", () => ({
  getCurrentTenant: async () => session.member,
  requireTenant: async () => {
    if (!session.member) throw new Error("Not authenticated or no tenant access");
    return session.member;
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: { findUnique: async () => session.subscription },
    tenant: { findUnique: async () => ({ billingStatus: session.billingStatus }) },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ success: true }) }));

// The data layer: a cache of known facts, and a log of what was bought.
const data = vi.hoisted(() => ({
  ranks: new Map<string, number | null>(),
  links: new Map<string, { referringDomains: number; backlinks: number; dofollowShare: number | null }>(),
  ref: new Map<string, { domain: string; authority: number | null; backlinks: number }[]>(),
  bought: [] as string[],
  tenants: new Set<string>(),
  fail: null as null | Error,
}));
vi.mock("@/lib/authority-checker/data", () => ({
  cachedRanks: async (domains: string[]) => ({
    known: Object.fromEntries(domains.filter((d) => data.ranks.has(d)).map((d) => [d, data.ranks.get(d)!])),
    missing: domains.filter((d) => !data.ranks.has(d)),
  }),
  buyRanks: async (tenantId: string, domains: string[]) => {
    if (domains.length === 0) return {};
    if (data.fail) throw data.fail;
    data.tenants.add(tenantId);
    data.bought.push(`ranks:${domains.join(",")}`);
    for (const d of domains) data.ranks.set(d, 50);
    return Object.fromEntries(domains.map((d) => [d, 50]));
  },
  cachedLinks: async (d: string) => data.links.get(d) ?? null,
  buyLinks: async (tenantId: string, d: string) => {
    if (data.fail) throw data.fail;
    data.tenants.add(tenantId);
    data.bought.push(`links:${d}`);
    const l = { referringDomains: 7, backlinks: 70, dofollowShare: 0.5 };
    data.links.set(d, l);
    return l;
  },
  cachedRefDomains: async (d: string) => data.ref.get(d) ?? null,
  buyRefDomains: async (tenantId: string, d: string) => {
    data.tenants.add(tenantId);
    data.bought.push(`ref:${d}`);
    const rows = [{ domain: "r.com", authority: 80, backlinks: 2 }];
    data.ref.set(d, rows);
    return rows;
  },
}));

import { GET as usage, POST as check } from "@/app/api/seo/v1/link-authority/route";
import { POST as oldCheck } from "@/app/api/free/v1/authority-checker/route";
import { GET as oldRead } from "@/app/api/free/v1/authority-checker/[token]/route";
import { POST as oldUnlock } from "@/app/api/free/v1/authority-checker/[token]/unlock/route";
import { GET as oldPdf } from "@/app/api/free/v1/authority-checker/[token]/pdf/route";
import { AUTHORITY_COPY } from "@/lib/authority-checker/copy";
import { LINK_AUTHORITY_API, LINK_AUTHORITY_TOOL_PATH } from "@/lib/authority-checker/config";
import {
  LinkAuthorityQuotaExceededError,
  linkAuthorityQuotaKey,
  linkAuthorityResetsAt,
  reserveLinkAuthorityCheck,
} from "@/lib/authority-checker/quota";
import { runLinkAuthorityCheck } from "@/lib/authority-checker/service";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { areaForApi, areaForPage, planAllowsApi, planAllowsPage } from "@/lib/plan-access";

const PAID_PLANS: PlanType[] = ["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY"];

const post = (body: unknown) =>
  check(new Request(`https://echorank360.com${LINK_AUTHORITY_API}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));
const run = (domain = "a.com", competitors: string[] = ["b.com", "c.com"]) => post({ domain, competitors, locale: "en" });

function signIn(plan: PlanType, opts: { status?: BillingStatus; subscription?: typeof session.subscription } = {}) {
  session.member = { tenantId: `t-${plan}`, tenant: { id: `t-${plan}`, planType: plan } };
  session.billingStatus = opts.status ?? "ACTIVE";
  session.subscription = opts.subscription ?? null;
}

beforeEach(() => {
  kv.clear();
  session.member = null;
  session.billingStatus = "ACTIVE";
  session.subscription = null;
  data.ranks.clear();
  data.links.clear();
  data.ref.clear();
  data.bought = [];
  data.tenants.clear();
  data.fail = null;
});

describe("who may run a check", () => {
  it("anonymous → 401 on POST and GET, nothing bought", async () => {
    const res = await run();
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("unauthorized");
    expect((await usage(new Request(`https://echorank360.com${LINK_AUTHORITY_API}`))).status).toBe(401);
    expect(data.bought).toEqual([]);
  });

  it("anonymous with an invalid body is still 401: the session is checked first", async () => {
    expect((await post({ nope: true })).status).toBe(401);
  });

  it("a free tenant (never subscribed) → 403 plan_required, nothing bought", async () => {
    signIn("STARTER", { status: "NONE" });
    const res = await run();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("plan_required");
    expect(body.error).toBe(AUTHORITY_COPY.en.errors.plan_required);
    expect(data.bought).toEqual([]);
  });

  it.each(["CANCELED", "PAST_DUE"] as BillingStatus[])("a %s tenant → 403", async (status) => {
    signIn("GROWTH", { status });
    expect((await run()).status).toBe(403);
  });

  it("trials follow requirePaidPlan: TRIALING alone → 403, with a Stripe PLAN row → 200, watcher-only → 403", async () => {
    signIn("STARTER", { status: "TRIALING" });
    expect((await run()).status).toBe(403);

    signIn("STARTER", { status: "TRIALING", subscription: { status: "TRIALING", productKind: "PLAN" } });
    expect((await run()).status).toBe(200);

    signIn("STARTER", { status: "TRIALING", subscription: { status: "TRIALING", productKind: "WATCHER" } });
    expect((await run("z.com", [])).status).toBe(403);
  });

  it.each(PAID_PLANS)("%s → 200 with the full report: summary, comparison, referring domains", async (plan) => {
    signIn(plan);
    const res = await run("a.com", ["b.com", "c.com", "d.com"]);
    expect(res.status).toBe(200);
    const r = await res.json();
    expect(r.domain).toBe("a.com");
    expect(r.authority).toBe(50);
    expect(r.links).toEqual({ referringDomains: 7, backlinks: 70, dofollowShare: 0.5 });
    expect(r.comparison.map((row: { domain: string }) => row.domain)).toEqual(["a.com", "b.com", "c.com", "d.com"]);
    expect(r.referringDomains).toEqual([{ domain: "r.com", authority: 80, backlinks: 2 }]);
    expect(r.cached).toBe(false);
    expect(r.usage).toMatchObject({ used: 1, limit: PLAN_CONFIGS[plan].linkAuthorityChecksPerMonth });
    // Charged to the tenant, not to a shared internal account.
    expect([...data.tenants]).toEqual([`t-${plan}`]);
    expect(r).not.toHaveProperty("token");
    expect(r).not.toHaveProperty("unlocked");
  });

  it("more than three competitors → 400, after the session check", async () => {
    signIn("GROWTH");
    const res = await run("a.com", ["b.com", "c.com", "d.com", "e.com"]);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("too_many_competitors");
  });

  it("the plan allowlist opens the tool and its API on the AI-only plan, and no other SEO tool", () => {
    expect(areaForPage(LINK_AUTHORITY_TOOL_PATH)).toBe("link_authority");
    expect(areaForApi(LINK_AUTHORITY_API, "POST")).toBe("link_authority");
    for (const plan of PAID_PLANS) {
      expect(planAllowsPage(plan, LINK_AUTHORITY_TOOL_PATH), plan).toBe(true);
      expect(planAllowsApi(plan, LINK_AUTHORITY_API, "POST"), plan).toBe(true);
    }
    expect(planAllowsPage("AI_VISIBILITY", "/visibility/tools/backlinks")).toBe(false);
    expect(planAllowsApi("AI_VISIBILITY", "/api/seo/v1/backlinks/analyze", "POST")).toBe(false);
  });
});

describe("the monthly allowance", () => {
  it("the quota refuses check N+1 with used / limit, the reset date and the upgrade link; nothing is bought", async () => {
    signIn("AI_VISIBILITY");
    const limit = PLAN_CONFIGS.AI_VISIBILITY.linkAuthorityChecksPerMonth!;
    for (let i = 0; i < limit; i++) expect((await run(`site${i}.com`, [])).status, `check ${i + 1}`).toBe(200);
    const before = data.bought.length;
    const res = await run("one-more.com", []);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("quota");
    expect(body.usage).toEqual({ used: limit, limit, resetsAt: linkAuthorityResetsAt().toISOString() });
    expect(body.upgradeHref).toBe("/billing");
    expect(data.bought.length).toBe(before);
    // The refused check gave its reservation back.
    expect(kv.get(linkAuthorityQuotaKey("t-AI_VISIBILITY"))).toBe(String(limit));
  });

  it("cache hits don't count, even at the limit", async () => {
    signIn("AI_VISIBILITY");
    expect((await run("a.com", ["b.com"])).status).toBe(200);
    const again = await (await run("a.com", ["b.com"])).json();
    expect(again.cached).toBe(true);
    expect(again.usage.used).toBe(1);

    kv.set(linkAuthorityQuotaKey("t-AI_VISIBILITY"), String(PLAN_CONFIGS.AI_VISIBILITY.linkAuthorityChecksPerMonth));
    const atLimit = await run("a.com", ["b.com"]);
    expect(atLimit.status).toBe(200);
    expect((await atLimit.json()).cached).toBe(true);
  });

  it("a partly cached check buys only what is missing, and counts once", async () => {
    signIn("STARTER");
    await run("a.com", []);
    data.bought = [];
    const r = await (await run("a.com", ["b.com"])).json();
    expect(data.bought).toEqual(["ranks:b.com", "links:b.com"]);
    expect(r.cached).toBe(false);
    expect(r.usage.used).toBe(2);
  });

  it("a failed purchase gives the check back", async () => {
    signIn("GROWTH");
    data.fail = new Error("upstream down");
    const res = await run();
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("upstream");
    expect(Number(kv.get(linkAuthorityQuotaKey("t-GROWTH")) ?? 0)).toBe(0);
  });

  it("the counter resets monthly: the month is in the key, and a new month starts at zero", async () => {
    const oct = new Date("2026-10-31T23:59:00Z");
    const nov = new Date("2026-11-01T00:00:00Z");
    expect(linkAuthorityQuotaKey("t1", oct)).toBe("echorank:link-authority:checks:t1:2026-10");
    expect(linkAuthorityQuotaKey("t1", nov)).toBe("echorank:link-authority:checks:t1:2026-11");
    expect(linkAuthorityResetsAt(oct).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    for (let i = 0; i < 10; i++) await reserveLinkAuthorityCheck("t1", "AI_VISIBILITY", oct);
    await expect(reserveLinkAuthorityCheck("t1", "AI_VISIBILITY", oct)).rejects.toBeInstanceOf(LinkAuthorityQuotaExceededError);
    await expect(reserveLinkAuthorityCheck("t1", "AI_VISIBILITY", nov)).resolves.toMatchObject({ used: 1, limit: 10 });
  });

  it("through the service: October's last check is refused, November's first runs", async () => {
    kv.set(linkAuthorityQuotaKey("t1", new Date("2026-10-15T00:00:00Z")), "10");
    const input = { tenantId: "t1", plan: "AI_VISIBILITY" as PlanType, domain: "a.com", competitors: [] };
    await expect(runLinkAuthorityCheck(input, new Date("2026-10-20T00:00:00Z"))).rejects.toBeInstanceOf(LinkAuthorityQuotaExceededError);
    const r = await runLinkAuthorityCheck(input, new Date("2026-11-02T00:00:00Z"));
    expect(r.usage).toMatchObject({ used: 1, limit: 10, resetsAt: "2026-12-01T00:00:00.000Z" });
  });

  it("GET returns this month's usage for a paid tenant", async () => {
    signIn("AGENCY");
    await run();
    const u = await (await usage(new Request(`https://echorank360.com${LINK_AUTHORITY_API}`))).json();
    expect(u).toMatchObject({ used: 1, limit: 300 });
  });
});

describe("the anonymous routes are gone", () => {
  it("every old /api/free/v1/authority-checker route answers 410 and buys nothing", async () => {
    for (const res of [oldCheck(), oldRead(), oldUnlock(), oldPdf()]) {
      expect(res.status).toBe(410);
      expect((await res.json()).code).toBe("gone");
    }
    expect(data.bought).toEqual([]);
  });
});
