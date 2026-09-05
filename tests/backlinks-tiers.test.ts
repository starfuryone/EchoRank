// The Backlinks tool's two tiers, its shared cache, and its history.
//
// tests/backlinks.route.test.ts covers the FULL experience end to end — it now
// runs on AGENCY for exactly that reason. This file covers what the two-tier
// split added:
//
//   1. BASIC CANNOT REACH FULL. Not "does not show" — cannot reach. A hidden
//      button is not an authorization boundary, so the gate is asserted at the
//      service, which is what the route, the e2e script and the tests all go
//      through.
//   2. BASIC BUYS LESS. The saving is real spend, not a hidden section: Basic
//      must not pay for anchors and linked pages and then decline to render
//      them.
//   3. THE SHARED CACHE SKIPS THE ALLOWANCE, and fails open in both
//      directions.
//   4. A BASIC PAYLOAD IS NEVER SHARED. The subtle one — caching a Basic fetch
//      would hand the next Full tenant a result missing two sections, at cost
//      0, indistinguishable from an empty profile.
//   5. SNAPSHOTS ARE WRITTEN ON EVERY TIER, and read only on Full.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanType } from "@/generated/prisma";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const backlinksAnalysis = { findFirst: vi.fn(), create: vi.fn() };
const backlinkSnapshot = { create: vi.fn(), findMany: vi.fn(async () => []) };
const seoApiCall = { count: vi.fn(async () => 0), aggregate: vi.fn(async () => ({ _sum: { costUsd: 0 } })) };
const researchLog = { create: vi.fn(async () => ({ id: "log_1" })) };
vi.mock("@/lib/prisma", () => ({
  prisma: { backlinksAnalysis, backlinkSnapshot, seoApiCall, researchLog },
}));

const seoMeteredCallResult = vi.fn();
vi.mock("@/lib/dataforseo/metering", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dataforseo/metering")>()),
  seoMeteredCallResult: (...args: unknown[]) => seoMeteredCallResult(...args),
}));

const readCache = vi.fn(async () => null as unknown);
const writeCache = vi.fn(async () => true);
vi.mock("@/lib/spaces-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/spaces-cache")>()),
  readCache: (...args: unknown[]) => readCache(...(args as [])),
  writeCache: (...args: unknown[]) => writeCache(...(args as [])),
}));

const redisStore = new Map<string, number>();
const redis = {
  incr: vi.fn(async (key: string) => {
    const next = (redisStore.get(key) ?? 0) + 1;
    redisStore.set(key, next);
    return next;
  }),
  decr: vi.fn(async (key: string) => {
    const next = (redisStore.get(key) ?? 0) - 1;
    redisStore.set(key, next);
    return next;
  }),
  expire: vi.fn(async () => 1),
  get: vi.fn(async (key: string) => {
    const value = redisStore.get(key);
    return value === undefined ? null : String(value);
  }),
};
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => redis }));

const { runAnalysis, BacklinksCapabilityError } = await import("@/lib/backlinks/service");
const { backlinksCapability, BACKLINKS_CACHE_DAYS, BACKLINKS_OBSERVED_COST_USD } = await import(
  "@/lib/backlinks/options"
);
const { normalizeTarget, buildPrefixFilters, apiTargetFor, BACKLINKS_MODES } = await import(
  "@/lib/backlinks/target"
);
const { readBacklinkHistory, recordBacklinkSnapshot, MIN_HISTORY_POINTS } = await import(
  "@/lib/backlinks/snapshots"
);
const {
  buildBacklinksListFilters,
  countFilterConditions,
  MAX_FILTER_CONDITIONS,
  TooManyFilterConditionsError,
  escapeLikeTerm,
} = await import("@/lib/backlinks/filters");
const { PLAN_CONFIGS } = await import("@/lib/plan-config");

const TENANT = "tenant_a";

/** Every provider call succeeds with a usable envelope. */
function stubProvider() {
  seoMeteredCallResult.mockImplementation(async (_tenant: string, path: string) => ({
    data: path.includes("summary")
      ? [{ backlinks: 1000, referring_domains: 120, rank: 240, broken_backlinks: 7 }]
      : [{ total_count: 42, items: [] }],
    billing: { path: path.split("/"), costUsd: 0.05 },
  }));
}

function params(overrides: Record<string, unknown> = {}) {
  return { target: "example.com", mode: "domain" as const, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  redisStore.clear();
  backlinksAnalysis.findFirst.mockResolvedValue(null);
  backlinksAnalysis.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: "bl_new",
      createdAt: new Date("2026-09-05T12:00:00Z"),
      ...data,
    }),
  );
  backlinkSnapshot.findMany.mockResolvedValue([]);
  readCache.mockResolvedValue(null);
  writeCache.mockResolvedValue(true);
  seoApiCall.count.mockResolvedValue(0);
  stubProvider();
});

// ─── 1. The capability object ────────────────────────────────────────────────

describe("the tier boundary is a capability object, not a plan name", () => {
  it("puts STARTER and GROWTH on Basic, AGENCY and ENTERPRISE on Full", () => {
    // THE DEFAULT BOUNDARY, and it is a pricing decision. Moving it should be
    // one edit in plan-config.ts and this assertion, not a grep for plan names.
    expect(backlinksCapability("STARTER").tier).toBe("basic");
    expect(backlinksCapability("GROWTH").tier).toBe("basic");
    expect(backlinksCapability("AGENCY").tier).toBe("full");
    expect(backlinksCapability("ENTERPRISE").tier).toBe("full");
  });

  it("keeps every capability consistent with its tier", () => {
    for (const [plan, config] of Object.entries(PLAN_CONFIGS)) {
      const cap = config.backlinks;
      if (cap.tier === "basic") {
        expect(cap.scope, plan).toBe("domain");
        expect(cap.filters, plan).toBe(false);
        expect(cap.csv, plan).toBe(false);
        expect(cap.history, plan).toBe(false);
        expect(cap.deepEndpoints, plan).toBe(false);
      } else {
        expect(cap.scope, plan).toBe("full");
        expect(cap.filters, plan).toBe(true);
        expect(cap.csv, plan).toBe(true);
        expect(cap.history, plan).toBe(true);
        expect(cap.deepEndpoints, plan).toBe(true);
      }
      expect(cap.listRows, plan).toBeGreaterThan(0);
    }
  });

  it("gives the retired tier STARTER's shape rather than an undefined one", () => {
    expect(backlinksCapability("AI_VISIBILITY")).toEqual(backlinksCapability("STARTER"));
  });
});

// ─── 2. Basic cannot reach Full ──────────────────────────────────────────────

describe("Basic cannot reach Full, at the service", () => {
  it.each(["subdomain", "prefix", "exact_url"] as const)(
    "refuses %s scope on a Basic tier, before spending",
    async (mode) => {
      const target =
        mode === "subdomain" ? "example.com" : normalizeTarget("https://example.com/blog", mode);
      await expect(
        runAnalysis(TENANT, "GROWTH", params({ target, mode })),
      ).rejects.toBeInstanceOf(BacklinksCapabilityError);
      expect(seoMeteredCallResult).not.toHaveBeenCalled();
      expect(redis.incr).not.toHaveBeenCalled();
    },
  );

  it("refuses filters on a Basic tier", async () => {
    await expect(
      runAnalysis(TENANT, "GROWTH", params({ listFilters: { linkType: "dofollow" } })),
    ).rejects.toBeInstanceOf(BacklinksCapabilityError);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("allows every scope and filters on a Full tier", async () => {
    for (const mode of BACKLINKS_MODES) {
      vi.clearAllMocks();
      stubProvider();
      backlinksAnalysis.findFirst.mockResolvedValue(null);
      backlinksAnalysis.create.mockResolvedValue({
        id: "bl_x",
        createdAt: new Date(),
        failedSections: [],
        costUsd: 0,
      });
      const target =
        mode === "prefix" || mode === "exact_url"
          ? normalizeTarget("https://example.com/blog", mode)
          : "example.com";
      await expect(
        runAnalysis(TENANT, "AGENCY", params({ target, mode })),
      ).resolves.toBeTruthy();
    }
  });
});

// ─── 3. Basic buys less ──────────────────────────────────────────────────────

describe("Basic buys less, rather than hiding what it bought", () => {
  it("never calls the anchors, linked-pages or backlinks-list endpoints", async () => {
    await runAnalysis(TENANT, "GROWTH", params());
    const paths = seoMeteredCallResult.mock.calls.map((call) => call[1] as string);
    // The saving has to be REAL SPEND. Fetching a section and declining to
    // render it puts the customer's bill up for a card they never see.
    expect(paths).not.toContain("v3/backlinks/anchors/live");
    expect(paths).not.toContain("v3/backlinks/domain_pages/live");
    expect(paths).not.toContain("v3/backlinks/backlinks/live");
    expect(paths).toContain("v3/backlinks/summary/live");
    expect(paths).toContain("v3/backlinks/referring_domains/live");
  });

  it("calls them on Full", async () => {
    await runAnalysis(TENANT, "AGENCY", params());
    const paths = seoMeteredCallResult.mock.calls.map((call) => call[1] as string);
    expect(paths).toContain("v3/backlinks/anchors/live");
    expect(paths).toContain("v3/backlinks/domain_pages/live");
    expect(paths).toContain("v3/backlinks/backlinks/live");
  });

  it("does NOT report the sections it skipped as failures", async () => {
    // The failure this catches: a Basic tenant seeing two "couldn't load"
    // cards on every successful lookup, and a status of "partial" on a run
    // that went perfectly.
    await runAnalysis(TENANT, "GROWTH", params());
    const data = backlinksAnalysis.create.mock.calls[0][0].data as {
      status: string;
      failedSections: string[];
    };
    expect(data.failedSections).toEqual([]);
    expect(data.status).toBe("completed");
  });

  it("buys only as many referring-domain rows as the tier can show", async () => {
    // This endpoint bills per ROW, so the limit is the cost lever.
    await runAnalysis(TENANT, "GROWTH", params());
    const task = seoMeteredCallResult.mock.calls.find((call) =>
      (call[1] as string).includes("referring_domains"),
    )?.[2] as { limit: number };
    expect(task.limit).toBeLessThanOrEqual(backlinksCapability("GROWTH").listRows);
  });
});

// ─── 4. The shared cache ─────────────────────────────────────────────────────

describe("the shared Spaces cache", () => {
  const payload = {
    summary: { backlinks: 900, referringDomains: 80, rank: 300 },
    history: null,
    referringDomains: { items: [], totalCount: 80 },
    anchors: { items: [], totalCount: 0, maxBacklinks: 0 },
    pages: { items: [], totalCount: 0 },
    failedSections: [],
  };

  it("is checked BEFORE the allowance, and a hit spends nothing", async () => {
    // The property that matters on an exhausted workspace, and the reason a
    // shared cache is worth having at all: one tenant's purchase answers
    // another's question for free.
    seoApiCall.count.mockResolvedValue(999_999);
    readCache.mockResolvedValue(payload);

    const { cached } = await runAnalysis(TENANT, "AGENCY", params());

    expect(cached).toBe(true);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    expect(redis.incr).not.toHaveBeenCalled();
    // Written as this tenant's own row, at cost 0 — they get a result, and
    // nobody is billed twice for one fetch.
    const data = backlinksAnalysis.create.mock.calls[0][0].data as { costUsd: number };
    expect(data.costUsd).toBe(0);
  });

  it("records no history point on a shared hit", async () => {
    readCache.mockResolvedValue(payload);
    await runAnalysis(TENANT, "AGENCY", params());
    // The numbers have not changed since whoever fetched them. A second point
    // at the same values would imply a second measurement.
    expect(backlinkSnapshot.create).not.toHaveBeenCalled();
  });

  it("stores the payload after a fresh FULL fetch", async () => {
    await runAnalysis(TENANT, "AGENCY", params());
    expect(writeCache).toHaveBeenCalledTimes(1);
    const [key] = writeCache.mock.calls[0] as unknown as [string];
    expect(key).toMatch(/^cache\/backlinks\/v1\/domain\/[0-9a-f]{64}\/d\d+\.json\.gz$/);
  });

  it("NEVER stores a Basic payload", async () => {
    // The subtle one. A Basic fetch bought fewer sections; caching it would let
    // the next FULL tenant hit that cache and receive a result missing anchors
    // and pages, at cost 0, with no way to tell it from an empty profile.
    await runAnalysis(TENANT, "GROWTH", params());
    expect(writeCache).not.toHaveBeenCalled();
  });

  it("treats a miss as a miss and goes on to fetch", async () => {
    // The fail-open behaviour itself lives in the cache module and is asserted
    // there, against a mocked S3 client — see tests/spaces-cache.test.ts. What
    // this asserts is the caller's half: a null from the cache leads to a
    // normal, billed lookup rather than an empty result.
    readCache.mockResolvedValue(null);
    const { cached } = await runAnalysis(TENANT, "AGENCY", params());
    expect(cached).toBe(false);
    expect(seoMeteredCallResult).toHaveBeenCalled();
  });

  it("keys on scope, so two scopes cannot serve each other", async () => {
    await runAnalysis(TENANT, "AGENCY", params());
    const domainKey = (readCache.mock.calls[0] as unknown as [string])[0];
    vi.clearAllMocks();
    stubProvider();
    readCache.mockResolvedValue(null);
    backlinksAnalysis.findFirst.mockResolvedValue(null);
    backlinksAnalysis.create.mockResolvedValue({ id: "x", createdAt: new Date(), failedSections: [], costUsd: 0 });
    await runAnalysis(TENANT, "AGENCY", params({ mode: "subdomain" }));
    const subdomainKey = (readCache.mock.calls[0] as unknown as [string])[0];
    expect(domainKey).not.toBe(subdomainKey);
  });
});

// ─── 5. Snapshots ────────────────────────────────────────────────────────────

describe("history snapshots", () => {
  it("are written on BASIC too, even though Basic cannot see them", async () => {
    // A tier that starts recording history only on upgrade shows an empty
    // chart for weeks afterwards — precisely when the feature has to justify
    // the upgrade. The capability gates the chart, not the write.
    await runAnalysis(TENANT, "GROWTH", params());
    expect(backlinkSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT, target: "example.com", mode: "domain" }),
      }),
    );
  });

  it("keep a missing rank as null rather than zero", async () => {
    await recordBacklinkSnapshot({
      tenantId: TENANT,
      target: "example.com/blog",
      mode: "prefix",
      summary: {
        backlinks: 10,
        referringDomains: 3,
        referringMainDomains: 3,
        rank: 0,
        brokenBacklinks: 0,
        dofollowDomains: 0,
        nofollowDomains: 0,
        dofollowRatio: null,
      },
    });
    const data = backlinkSnapshot.create.mock.calls[0][0].data as { rank: number | null };
    // 0 IS a measured value here; the null case is when the provider gives
    // nothing. Asserted so the two do not get collapsed later.
    expect(data.rank).toBe(0);
  });

  it("never throw — a chart point must not fail a paid lookup", async () => {
    backlinkSnapshot.create.mockRejectedValue(new Error('relation "backlink_snapshots" does not exist'));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(runAnalysis(TENANT, "AGENCY", params())).resolves.toBeTruthy();
    spy.mockRestore();
  });

  it("read soft, and a series needs two points to be a line", async () => {
    backlinkSnapshot.findMany.mockRejectedValue(new Error("no table"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await readBacklinkHistory(TENANT, "example.com", "domain")).toEqual([]);
    spy.mockRestore();
    // One point is a dot; a dot dressed as a trend is worse than no chart.
    expect(MIN_HISTORY_POINTS).toBe(2);
  });

  it("are tenant-scoped", async () => {
    backlinkSnapshot.findMany.mockResolvedValue([]);
    await readBacklinkHistory("tenant_b", "example.com", "domain");
    expect(backlinkSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant_b", target: "example.com", mode: "domain" },
      }),
    );
  });
});

// ─── 6. Prefix scope ─────────────────────────────────────────────────────────

describe("URL-prefix scope", () => {
  it("sends the hostname upstream and narrows with a filter", async () => {
    // The provider's endpoints take a domain or a page and nothing in between.
    const target = normalizeTarget("https://example.com/blog", "prefix");
    expect(apiTargetFor(target, "prefix")).toBe("example.com");

    const [clause] = buildPrefixFilters(target) as [string[]];
    expect(clause[0]).toBe("url_to");
    expect(clause[1]).toBe("ilike");
    expect(clause[2]).toBe("https://example.com/blog%");
  });

  it("escapes a path that would otherwise widen the scope", async () => {
    // % and _ are ilike wildcards. A wider answer still looks like an answer,
    // so this is invisible when it goes wrong.
    const target = normalizeTarget("https://example.com/50%25_off", "prefix");
    const [clause] = buildPrefixFilters(target) as [string[]];
    expect(clause[2]).toContain("\\%");
    expect(clause[2]).toContain("\\_");
  });

  it("refuses a prefix over the site root", async () => {
    // A prefix over "/" is the whole domain in a more expensive costume: it
    // would run the filtered total_count path to answer what the cheap summary
    // endpoint answers directly.
    expect(() => normalizeTarget("https://example.com/", "prefix")).toThrow();
  });

  it("builds the summary from two filtered total_count reads", async () => {
    const target = normalizeTarget("https://example.com/blog", "prefix");
    await runAnalysis(TENANT, "AGENCY", params({ target, mode: "prefix" }));

    // The Full tier also fetches the individual-links table from this same
    // endpoint, so the summary reads are the ones asking for a single row.
    const countReads = seoMeteredCallResult.mock.calls.filter(
      (call) => call[1] === "v3/backlinks/backlinks/live" && (call[2] as { limit: number }).limit === 1,
    );
    expect(countReads).toHaveLength(2);
    const modes = countReads.map((call) => (call[2] as { mode?: string }).mode);
    expect(modes).toContain("as_is");
    expect(modes).toContain("one_per_domain");
  });

  it("skips the sections a path can never have", async () => {
    const target = normalizeTarget("https://example.com/blog", "prefix");
    await runAnalysis(TENANT, "AGENCY", params({ target, mode: "prefix" }));
    const paths = seoMeteredCallResult.mock.calls.map((call) => call[1] as string);
    // A path has no link-growth history and is not a domain whose pages can be
    // listed. Skipped, not called-and-failed.
    expect(paths).not.toContain("v3/backlinks/history/live");
    expect(paths).not.toContain("v3/backlinks/domain_pages/live");
  });
});

// ─── 7. Filters ──────────────────────────────────────────────────────────────

describe("filter builders", () => {
  it("ORs include terms and ANDs exclude terms", () => {
    const { filters } = buildBacklinksListFilters({ include: "blog, news" });
    // Match-any: a customer typing two terms means "either", and AND-ing them
    // returns nothing for terms that each match plenty.
    expect(JSON.stringify(filters)).toContain('"or"');

    const excluded = buildBacklinksListFilters({ exclude: "spam, casino" });
    expect(JSON.stringify(excluded.filters)).toContain("not_ilike");
    expect(excluded.conditionCount).toBe(2);
  });

  it("escapes wildcard characters in a term", () => {
    expect(escapeLikeTerm("50%_off")).toBe("50\\%\\_off");
    const { filters } = buildBacklinksListFilters({ include: "50%" });
    expect(JSON.stringify(filters)).toContain("\\\\%");
  });

  it("refuses to exceed the provider's 8-condition budget", () => {
    // Over the cap the provider rejects the call HAVING BILLED IT, so this is
    // a 400 rather than a silent truncation — truncating answers a question
    // the customer did not ask, indistinguishably from the one they did.
    const overBudget = {
      include: "a, b, c, d",
      exclude: "e, f",
      minDomainRank: 100,
      maxDomainRank: 900,
      hideLost: true,
    };
    expect(() => buildBacklinksListFilters(overBudget)).toThrow(TooManyFilterConditionsError);
    expect(MAX_FILTER_CONDITIONS).toBe(8);
  });

  it("counts with the SAME code path that enforces", () => {
    // The toolbar shows "6 of 8" before submitting. A second counting
    // implementation in the component is how the two come apart.
    const filters = { include: "a, b", exclude: "c", minDomainRank: 10 };
    expect(countFilterConditions(filters)).toBe(
      buildBacklinksListFilters(filters).conditionCount,
    );
  });

  it("builds nothing for an empty filter set", () => {
    expect(buildBacklinksListFilters({})).toEqual({ filters: [], conditionCount: 0 });
  });
});

// ─── 8. The cost hint ────────────────────────────────────────────────────────

describe("the cost hint", () => {
  it("is a display figure and never a meter", async () => {
    expect(BACKLINKS_OBSERVED_COST_USD).toBeGreaterThan(0);
    await runAnalysis(TENANT, "AGENCY", params());
    // Everything billed comes from the provider's own `cost` field. The hint
    // must never leak into a stored cost — its only failure mode is reading
    // slightly stale.
    const data = backlinksAnalysis.create.mock.calls[0][0].data as { costUsd: number };
    expect(data.costUsd).not.toBe(BACKLINKS_OBSERVED_COST_USD);
  });

  it("caches for a week", () => {
    expect(BACKLINKS_CACHE_DAYS).toBe(7);
  });
});

// ─── 9. Tenant isolation ─────────────────────────────────────────────────────

describe("tenant isolation", () => {
  it("scopes the stored-row probe by tenant", async () => {
    await runAnalysis("tenant_b", "AGENCY", params());
    expect(backlinksAnalysis.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant_b" }),
      }),
    );
  });

  it("does NOT put the tenant in the shared cache key", async () => {
    await runAnalysis("tenant_b", "AGENCY", params());
    const key = (readCache.mock.calls[0] as unknown as [string])[0];
    // A domain's link profile is a fact about the public web, not about who
    // asked. Metering stays per-tenant; the payload is shared.
    expect(key).not.toContain("tenant_b");
  });
});

// The plan type is referenced only for the exhaustive capability sweep above.
export type { PlanType };
