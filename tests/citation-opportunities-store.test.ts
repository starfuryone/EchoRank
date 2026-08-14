// tests/citation-opportunities-store.test.ts
//
// The database- and network-facing half of the Citation Opportunity Engine:
// tenant isolation on every query, the listed-skip in both of its arms, the
// status transitions, and the two places this feature could have spent money
// and must not.
//
// Prisma, Redis, the metered DataForSEO client and the logger are stubbed;
// everything else — the grain lift, the predicate, the cache arithmetic, the
// cap check, the upsert's status rule — is the real code path. Same approach as
// tests/citation-finder-store.test.ts and tests/sov-rollup.test.ts, and for the
// same reason: this box's .env is not readable by the test account and there is
// no test database, so what can be verified without one is verified thoroughly.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const { brandProfile, source, citationOpportunity, redis, loggerFns } = vi.hoisted(() => ({
  brandProfile: { findMany: vi.fn() },
  source: { findMany: vi.fn() },
  citationOpportunity: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  redis: { hmget: vi.fn(), hset: vi.fn(), expire: vi.fn() },
  loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { brandProfile, source, citationOpportunity },
}));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => redis }));

import {
  loadCandidates,
  loadManualSkips,
  listOpportunityTenants,
  isOpportunityStatus,
  setOpportunityStatus,
  sweepTenant,
  retireStaleOpportunities,
  upsertOpportunities,
  CANDIDATE_ROW_CAP,
} from "@/lib/citation-opportunities/store";
import { checkListed, isListed, MAX_DOMAINS_PER_CALL } from "@/lib/citation-opportunities/listed";
import { loadOpportunityPageData } from "@/lib/citation-opportunities/read";
import { scoreCandidate } from "@/lib/citation-opportunities/score";

const TENANT = "tenant_a";
const OTHER_TENANT = "tenant_b";

/** A `sources` row as the read selects it. */
function sourceRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    domain: "g2.com",
    kind: "REVIEW_SITE",
    citationCount: 10,
    enginesSeen: { openai: 6, perplexity: 4 },
    citesCompetitors: { Birdeye: 3, Podium: 2 },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  redis.hmget.mockResolvedValue([]);
  redis.hset.mockResolvedValue(1);
  redis.expire.mockResolvedValue(1);
  citationOpportunity.findMany.mockResolvedValue([]);
  citationOpportunity.findUnique.mockResolvedValue(null);
  citationOpportunity.upsert.mockResolvedValue({});
  citationOpportunity.deleteMany.mockResolvedValue({ count: 0 });
  citationOpportunity.updateMany.mockResolvedValue({ count: 1 });
  citationOpportunity.count.mockResolvedValue(0);
  source.findMany.mockResolvedValue([]);
  brandProfile.findMany.mockResolvedValue([]);
});

// ─── Tenant isolation ───────────────────────────────────────────────────────

describe("tenant isolation", () => {
  it("scopes the candidate queries to the tenant", async () => {
    await loadCandidates(TENANT);
    expect(source.findMany).toHaveBeenCalledTimes(2);
    for (const call of source.findMany.mock.calls) {
      expect(call[0].where.tenantId).toBe(TENANT);
    }
  });

  it("scopes the manual-skip query to the tenant", async () => {
    await loadManualSkips(TENANT);
    expect(citationOpportunity.findMany.mock.calls[0]![0].where.tenantId).toBe(TENANT);
  });

  it("scopes the brand-profile sweep to the tenant when one is given", async () => {
    await listOpportunityTenants(TENANT);
    expect(brandProfile.findMany.mock.calls[0]![0].where.tenantId).toBe(TENANT);
  });

  it("sweeps every tenant when none is given, without a tenantId filter", async () => {
    await listOpportunityTenants();
    expect(brandProfile.findMany.mock.calls[0]![0].where).not.toHaveProperty("tenantId");
    // But it still only takes actively-tracked brands, exactly like its siblings.
    expect(brandProfile.findMany.mock.calls[0]![0].where.trackingActive).toBe(true);
  });

  it("scopes the upsert to (tenantId, domain), never a bare domain", async () => {
    await upsertOpportunities(TENANT, [scoreCandidate({
      domain: "g2.com",
      kind: "REVIEW_SITE",
      seenCount: 10,
      engineSpread: 2,
      rivalLift: 5,
    })]);

    expect(citationOpportunity.findUnique.mock.calls[0]![0].where).toEqual({
      tenantId_domain: { tenantId: TENANT, domain: "g2.com" },
    });
    expect(citationOpportunity.upsert.mock.calls[0]![0].where).toEqual({
      tenantId_domain: { tenantId: TENANT, domain: "g2.com" },
    });
    expect(citationOpportunity.upsert.mock.calls[0]![0].create.tenantId).toBe(TENANT);
  });

  it("scopes the status write to (id, tenantId) in the WHERE clause", async () => {
    await setOpportunityStatus(TENANT, "opp_1", "DONE");
    expect(citationOpportunity.updateMany.mock.calls[0]![0].where).toEqual({
      id: "opp_1",
      tenantId: TENANT,
    });
  });

  it("refuses a foreign id by updating zero rows, not by throwing", async () => {
    // Prisma reports the count; a foreign id matches nothing, so the route
    // gets a 404 rather than a 500 or, worse, a successful write.
    citationOpportunity.updateMany.mockResolvedValue({ count: 0 });
    await expect(setOpportunityStatus(OTHER_TENANT, "opp_1", "DONE")).resolves.toBe(false);
  });

  it("scopes the retire delete to the tenant", async () => {
    await retireStaleOpportunities(TENANT, ["g2.com"]);
    expect(citationOpportunity.deleteMany.mock.calls[0]![0].where.tenantId).toBe(TENANT);
  });

  it("scopes both page queries and the proof lookup to the tenant", async () => {
    citationOpportunity.findMany.mockResolvedValue([
      {
        id: "opp_1",
        domain: "g2.com",
        kind: "REVIEW_SITE",
        effort: "MED",
        status: "DONE",
        howTo: "…",
        theme: null,
        createdAt: new Date("2026-08-01"),
        updatedAt: new Date("2026-08-10"),
      },
    ]);
    citationOpportunity.count.mockResolvedValue(1);
    source.findMany.mockResolvedValue([]);

    await loadOpportunityPageData(TENANT);

    expect(citationOpportunity.findMany.mock.calls[0]![0].where.tenantId).toBe(TENANT);
    expect(citationOpportunity.count.mock.calls[0]![0].where.tenantId).toBe(TENANT);
    // The proof lookup is the one most easily written as a bare domain filter —
    // `sources` holds the same domain for every tenant it has ever cited.
    expect(source.findMany.mock.calls[0]![0].where.tenantId).toBe(TENANT);
  });

  it("skips the proof lookup entirely when no row is DONE", async () => {
    citationOpportunity.findMany.mockResolvedValue([
      {
        id: "opp_1",
        domain: "g2.com",
        kind: "REVIEW_SITE",
        effort: "MED",
        status: "OPEN",
        howTo: "…",
        theme: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    citationOpportunity.count.mockResolvedValue(1);

    const data = await loadOpportunityPageData(TENANT);
    expect(source.findMany).not.toHaveBeenCalled();
    expect(data.rows[0]!.proven).toBe(false);
  });
});

// ─── The candidate predicate and the grain lift ─────────────────────────────

describe("loadCandidates", () => {
  it("filters to sources that cite rivals, on the column and not the JSON", async () => {
    await loadCandidates(TENANT);
    expect(source.findMany.mock.calls[0]![0].where.competitorCitations).toEqual({ gt: 0 });
  });

  it("derives 'never cites us' from brandCitations, with no citesYou column", async () => {
    await loadCandidates(TENANT);
    const exclusionQuery = source.findMany.mock.calls[1]![0];
    expect(exclusionQuery.where.brandCitations).toEqual({ gt: 0 });
    expect(exclusionQuery.distinct).toEqual(["domain"]);
    // The predicate must never look for a stored boolean.
    const allWheres = JSON.stringify(source.findMany.mock.calls.map((c) => c[0].where));
    expect(allWheres).not.toContain("citesYou");
  });

  it("drops a domain that cites ANY of the tenant's brands", async () => {
    source.findMany
      .mockResolvedValueOnce([sourceRow({ domain: "g2.com" }), sourceRow({ domain: "yelp.com" })])
      .mockResolvedValueOnce([{ domain: "g2.com" }]);

    const candidates = await loadCandidates(TENANT);
    expect(candidates.map((c) => c.domain)).toEqual(["yelp.com"]);
  });

  it("lifts two brand profiles' rows for one domain into a single candidate", async () => {
    source.findMany
      .mockResolvedValueOnce([
        sourceRow({
          domain: "g2.com",
          citationCount: 10,
          enginesSeen: { openai: 10 },
          citesCompetitors: { Birdeye: 3 },
        }),
        sourceRow({
          domain: "g2.com",
          citationCount: 4,
          enginesSeen: { perplexity: 4 },
          citesCompetitors: { Podium: 2 },
        }),
      ])
      .mockResolvedValueOnce([]);

    const candidates = await loadCandidates(TENANT);
    expect(candidates).toHaveLength(1);
    // Citations and rival counts SUM…
    expect(candidates[0]!.seenCount).toBe(14);
    expect(candidates[0]!.rivalLift).toBe(5);
    // …but engines UNION. Two brands cited by openai is still one engine.
    expect(candidates[0]!.engineSpread).toBe(2);
  });

  it("counts an engine once when both brand profiles saw it", async () => {
    source.findMany
      .mockResolvedValueOnce([
        sourceRow({ domain: "g2.com", enginesSeen: { openai: 5 }, citesCompetitors: { A: 1 } }),
        sourceRow({ domain: "g2.com", enginesSeen: { openai: 3 }, citesCompetitors: { A: 1 } }),
      ])
      .mockResolvedValueOnce([]);

    const candidates = await loadCandidates(TENANT);
    expect(candidates[0]!.engineSpread).toBe(1);
  });

  it("keeps the more specific kind when one row is still unclassified", async () => {
    source.findMany
      .mockResolvedValueOnce([
        sourceRow({ domain: "g2.com", kind: "OTHER" }),
        sourceRow({ domain: "g2.com", kind: "REVIEW_SITE" }),
      ])
      .mockResolvedValueOnce([]);

    const candidates = await loadCandidates(TENANT);
    expect(candidates[0]!.kind).toBe("REVIEW_SITE");
  });

  it("survives a Json column holding something that is not a count map", async () => {
    // The columns are Json and can legally hold an array, a string or null.
    source.findMany
      .mockResolvedValueOnce([
        sourceRow({ domain: "odd.com", enginesSeen: "nonsense", citesCompetitors: [1, 2, 3] }),
      ])
      .mockResolvedValueOnce([]);

    const candidates = await loadCandidates(TENANT);
    expect(candidates[0]!.engineSpread).toBe(0);
    expect(candidates[0]!.rivalLift).toBe(0);
  });

  it("reads most-cited first and caps the rows it holds in memory", async () => {
    await loadCandidates(TENANT);
    const query = source.findMany.mock.calls[0]![0];
    expect(query.orderBy).toEqual({ citationCount: "desc" });
    // +1 so the cap can be detected and logged rather than silently applied.
    expect(query.take).toBe(CANDIDATE_ROW_CAP + 1);
  });

  it("says out loud when the cap bites", async () => {
    source.findMany
      .mockResolvedValueOnce(
        Array.from({ length: CANDIDATE_ROW_CAP + 1 }, (_v, i) =>
          sourceRow({ domain: `d${i}.com` }),
        ),
      )
      .mockResolvedValueOnce([]);

    const candidates = await loadCandidates(TENANT);
    expect(candidates).toHaveLength(CANDIDATE_ROW_CAP);
    expect(loggerFns.warn).toHaveBeenCalled();
  });
});

// ─── The listed skip ────────────────────────────────────────────────────────

describe("checkListed", () => {
  const DOMAINS = ["g2.com", "yelp.com", "capterra.com"];

  it("skips a domain DataForSEO confirms already links to the site", async () => {
    const fetchReferring = vi.fn().mockResolvedValue({
      referring: new Set(["g2.com"]),
      costUsd: 0.0258,
    });

    const result = await checkListed({
      tenantId: TENANT,
      target: "acme.com",
      domains: DOMAINS,
      fetchReferring,
      spent: async () => 0,
      cap: async () => 25,
    });

    expect(isListed(result.verdicts, "g2.com")).toBe(true);
    expect(isListed(result.verdicts, "yelp.com")).toBe(false);
    expect(result.verdicts.get("yelp.com")).toBe("not_listed");
    expect(result.costUsd).toBeCloseTo(0.0258, 6);
    expect(result.called).toBe(true);
  });

  it("asks with a domain filter, not a rank-ordered page", async () => {
    // The correctness argument in listed.ts: a customer with 21,000 referring
    // domains would have every real listing fall off a top-50 page.
    const fetchReferring = vi.fn().mockResolvedValue({ referring: new Set(), costUsd: 0.02 });
    await checkListed({
      tenantId: TENANT,
      target: "acme.com",
      domains: DOMAINS,
      fetchReferring,
      spent: async () => 0,
      cap: async () => 25,
    });
    expect(fetchReferring).toHaveBeenCalledWith(TENANT, "acme.com", DOMAINS);
  });

  it("spends NOTHING when every domain is already cached", async () => {
    redis.hmget.mockResolvedValue(["1", "0", "0"]);
    const fetchReferring = vi.fn();

    const result = await checkListed({
      tenantId: TENANT,
      target: "acme.com",
      domains: DOMAINS,
      fetchReferring,
      spent: async () => 0,
      cap: async () => 25,
    });

    expect(fetchReferring).not.toHaveBeenCalled();
    expect(result.costUsd).toBe(0);
    expect(result.called).toBe(false);
    expect(result.skipReason).toBe("all_cached");
    expect(result.verdicts.get("g2.com")).toBe("listed");
  });

  it("asks only about the domains the cache could not answer", async () => {
    redis.hmget.mockResolvedValue(["1", null, null]);
    const fetchReferring = vi.fn().mockResolvedValue({ referring: new Set(), costUsd: 0.02 });

    await checkListed({
      tenantId: TENANT,
      target: "acme.com",
      domains: DOMAINS,
      fetchReferring,
      spent: async () => 0,
      cap: async () => 25,
    });

    expect(fetchReferring).toHaveBeenCalledWith(TENANT, "acme.com", ["yelp.com", "capterra.com"]);
  });

  it("writes the answers back with a 7-day TTL, immediately", async () => {
    const fetchReferring = vi.fn().mockResolvedValue({
      referring: new Set(["g2.com"]),
      costUsd: 0.02,
    });
    await checkListed({
      tenantId: TENANT,
      target: "acme.com",
      domains: DOMAINS,
      fetchReferring,
      spent: async () => 0,
      cap: async () => 25,
    });

    expect(redis.hset).toHaveBeenCalledWith(
      `echorank:citation-opps:referring:${TENANT}:acme.com`,
      { "g2.com": "1", "yelp.com": "0", "capterra.com": "0" },
    );
    expect(redis.expire).toHaveBeenCalledWith(
      `echorank:citation-opps:referring:${TENANT}:acme.com`,
      7 * 24 * 60 * 60,
    );
  });

  it("checks the USD cap BEFORE the call and makes none when it is reached", async () => {
    const fetchReferring = vi.fn();
    const result = await checkListed({
      tenantId: TENANT,
      target: "acme.com",
      domains: DOMAINS,
      fetchReferring,
      spent: async () => 25,
      cap: async () => 25,
    });

    expect(fetchReferring).not.toHaveBeenCalled();
    expect(result.skipReason).toBe("cap_reached");
    expect(result.costUsd).toBe(0);
    // Fails OPEN: an unknown domain is not skipped, so a capped tenant gets a
    // slightly longer worklist rather than an empty one.
    for (const domain of DOMAINS) expect(result.verdicts.get(domain)).toBe("unknown");
    expect(loggerFns.warn).toHaveBeenCalled();
  });

  it("makes no call and skips nothing when the tenant has no website", async () => {
    const fetchReferring = vi.fn();
    const result = await checkListed({
      tenantId: TENANT,
      target: null,
      domains: DOMAINS,
      fetchReferring,
      spent: async () => 0,
      cap: async () => 25,
    });

    expect(fetchReferring).not.toHaveBeenCalled();
    expect(result.skipReason).toBe("no_target");
    for (const domain of DOMAINS) expect(result.verdicts.get(domain)).toBe("unknown");
  });

  it("fails OPEN when DataForSEO errors — no domain is skipped", async () => {
    const fetchReferring = vi.fn().mockRejectedValue(new Error("502"));
    const result = await checkListed({
      tenantId: TENANT,
      target: "acme.com",
      domains: DOMAINS,
      fetchReferring,
      spent: async () => 0,
      cap: async () => 25,
    });

    for (const domain of DOMAINS) expect(result.verdicts.get(domain)).toBe("unknown");
    expect(result.costUsd).toBe(0);
    expect(loggerFns.error).toHaveBeenCalled();
  });

  it("does not cache an unknown, so a bad minute is not a bad week", async () => {
    const fetchReferring = vi.fn().mockRejectedValue(new Error("502"));
    await checkListed({
      tenantId: TENANT,
      target: "acme.com",
      domains: DOMAINS,
      fetchReferring,
      spent: async () => 0,
      cap: async () => 25,
    });
    expect(redis.hset).not.toHaveBeenCalled();
  });

  it("survives an unreachable Redis by asking upstream instead", async () => {
    redis.hmget.mockRejectedValue(new Error("ECONNREFUSED"));
    const fetchReferring = vi.fn().mockResolvedValue({ referring: new Set(), costUsd: 0.02 });

    const result = await checkListed({
      tenantId: TENANT,
      target: "acme.com",
      domains: DOMAINS,
      fetchReferring,
      spent: async () => 0,
      cap: async () => 25,
    });

    expect(fetchReferring).toHaveBeenCalled();
    expect(result.verdicts.get("g2.com")).toBe("not_listed");
  });

  it("makes exactly ONE call however many domains it was given", async () => {
    const fetchReferring = vi.fn().mockResolvedValue({ referring: new Set(), costUsd: 0.02 });
    await checkListed({
      tenantId: TENANT,
      target: "acme.com",
      domains: Array.from({ length: 40 }, (_v, i) => `d${i}.com`),
      fetchReferring,
      spent: async () => 0,
      cap: async () => 25,
    });
    expect(fetchReferring).toHaveBeenCalledTimes(1);
  });

  it("logs, rather than silently truncating, when there are more domains than one call carries", async () => {
    const fetchReferring = vi.fn().mockResolvedValue({ referring: new Set(), costUsd: 0.02 });
    const many = Array.from({ length: MAX_DOMAINS_PER_CALL + 5 }, (_v, i) => `d${i}.com`);

    const result = await checkListed({
      tenantId: TENANT,
      target: "acme.com",
      domains: many,
      fetchReferring,
      spent: async () => 0,
      cap: async () => 25,
    });

    expect(fetchReferring.mock.calls[0]![2]).toHaveLength(MAX_DOMAINS_PER_CALL);
    expect(loggerFns.warn).toHaveBeenCalled();
    // The overflow is unknown, not assumed not-listed.
    expect(result.verdicts.get(`d${MAX_DOMAINS_PER_CALL + 4}.com`)).toBe("unknown");
  });

  it("makes no call for an empty candidate list", async () => {
    const fetchReferring = vi.fn();
    const result = await checkListed({
      tenantId: TENANT,
      target: "acme.com",
      domains: [],
      fetchReferring,
      spent: async () => 0,
      cap: async () => 25,
    });
    expect(fetchReferring).not.toHaveBeenCalled();
    expect(result.skipReason).toBe("no_candidates");
  });
});

// ─── The sweep: both skip arms together ─────────────────────────────────────

describe("sweepTenant", () => {
  const tenant = { tenantId: TENANT, target: "acme.com", theme: "review software" };

  beforeEach(() => {
    source.findMany
      .mockResolvedValueOnce([
        sourceRow({ domain: "g2.com" }),
        sourceRow({ domain: "yelp.com" }),
        sourceRow({ domain: "capterra.com" }),
      ])
      .mockResolvedValueOnce([]);
  });

  it("skips a domain the customer has already marked DONE", async () => {
    citationOpportunity.findMany.mockResolvedValue([{ domain: "g2.com" }]);

    const result = await sweepTenant({ tenant, listed: new Set() });

    expect(result.scored.map((r) => r.domain).sort()).toEqual(["capterra.com", "yelp.com"]);
    expect(result.skippedManual).toBe(1);
  });

  it("asks for DONE and DISMISSED, and only those, as the manual skip set", async () => {
    await sweepTenant({ tenant, listed: new Set() });
    expect(citationOpportunity.findMany.mock.calls[0]![0].where.status).toEqual({
      in: ["DONE", "DISMISSED"],
    });
  });

  it("skips a domain confirmed as already linking to the site", async () => {
    const result = await sweepTenant({ tenant, listed: new Set(["yelp.com"]) });

    expect(result.scored.map((r) => r.domain).sort()).toEqual(["capterra.com", "g2.com"]);
    expect(result.skippedListed).toBe(1);
  });

  it("counts a domain that is both listed and dismissed as a manual skip only", async () => {
    citationOpportunity.findMany.mockResolvedValue([{ domain: "g2.com" }]);
    const result = await sweepTenant({ tenant, listed: new Set(["g2.com"]) });
    expect(result.skippedManual).toBe(1);
    expect(result.skippedListed).toBe(0);
  });

  it("reports which domains are new, for the p75 alert pass", async () => {
    citationOpportunity.findUnique
      .mockResolvedValueOnce({ id: "opp_existing" })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await sweepTenant({ tenant, listed: new Set() });
    expect(result.created).toHaveLength(2);
    expect(result.updated).toHaveLength(1);
  });

  it("threads the brand's theme into the pitch templates", async () => {
    const result = await sweepTenant({ tenant, listed: new Set() });
    // Every row here is a REVIEW_SITE, which does not use a theme.
    for (const row of result.scored) expect(row.theme).toBeNull();
  });
});

describe("upsertOpportunities", () => {
  const scored = [
    scoreCandidate({ domain: "g2.com", kind: "REVIEW_SITE", seenCount: 10, engineSpread: 2, rivalLift: 5 }),
  ];

  it("NEVER writes status on update — the customer's click survives Monday", async () => {
    citationOpportunity.findUnique.mockResolvedValue({ id: "opp_1" });
    await upsertOpportunities(TENANT, scored);

    const call = citationOpportunity.upsert.mock.calls[0]![0];
    expect(call.update).not.toHaveProperty("status");
    // But it does refresh everything the job owns.
    expect(call.update).toHaveProperty("priority");
    expect(call.update).toHaveProperty("impact");
    expect(call.update).toHaveProperty("howTo");
    expect(call.update).toHaveProperty("kind");
  });

  it("does not set an explicit status on create either — the column defaults to OPEN", async () => {
    await upsertOpportunities(TENANT, scored);
    expect(citationOpportunity.upsert.mock.calls[0]![0].create).not.toHaveProperty("status");
  });
});

describe("retireStaleOpportunities", () => {
  it("removes only OPEN and IN_PROGRESS rows that stopped qualifying", async () => {
    await retireStaleOpportunities(TENANT, ["g2.com", "yelp.com"]);
    const where = citationOpportunity.deleteMany.mock.calls[0]![0].where;
    expect(where.status).toEqual({ in: ["OPEN", "IN_PROGRESS"] });
    expect(where.domain).toEqual({ notIn: ["g2.com", "yelp.com"] });
  });

  it("never deletes a DONE row — it is the proof badge's anchor", async () => {
    await retireStaleOpportunities(TENANT, []);
    const statuses = citationOpportunity.deleteMany.mock.calls[0]![0].where.status.in;
    expect(statuses).not.toContain("DONE");
    expect(statuses).not.toContain("DISMISSED");
  });
});

// ─── Status transitions ─────────────────────────────────────────────────────

describe("status transitions", () => {
  it("accepts exactly the four enum values", () => {
    for (const status of ["OPEN", "IN_PROGRESS", "DONE", "DISMISSED"]) {
      expect(isOpportunityStatus(status)).toBe(true);
    }
  });

  it("rejects anything else, including lowercase and near-misses", () => {
    for (const junk of ["open", "done", "COMPLETE", "", null, undefined, 3, {}, ["DONE"]]) {
      expect(isOpportunityStatus(junk)).toBe(false);
    }
  });

  it("allows every transition, including reopening a dismissed row", async () => {
    // A worklist is not a workflow — see the comment on isOpportunityStatus.
    const pairs: Array<[string, string]> = [
      ["OPEN", "IN_PROGRESS"],
      ["IN_PROGRESS", "DONE"],
      ["DONE", "OPEN"],
      ["DISMISSED", "OPEN"],
      ["DONE", "DISMISSED"],
    ];
    for (const [, to] of pairs) {
      citationOpportunity.updateMany.mockResolvedValue({ count: 1 });
      await expect(
        setOpportunityStatus(TENANT, "opp_1", to as "OPEN"),
      ).resolves.toBe(true);
    }
  });

  it("writes the status and nothing else", async () => {
    await setOpportunityStatus(TENANT, "opp_1", "IN_PROGRESS");
    expect(citationOpportunity.updateMany.mock.calls[0]![0].data).toEqual({
      status: "IN_PROGRESS",
    });
  });
});

// ─── The proof badge ────────────────────────────────────────────────────────

describe("the proof badge", () => {
  function pageWith(status: string, provenDomains: string[]) {
    citationOpportunity.findMany.mockResolvedValue([
      {
        id: "opp_1",
        domain: "g2.com",
        kind: "REVIEW_SITE",
        effort: "MED",
        status,
        howTo: "…",
        theme: null,
        createdAt: new Date("2026-08-01"),
        updatedAt: new Date("2026-08-10"),
      },
    ]);
    citationOpportunity.count.mockResolvedValue(1);
    source.findMany.mockResolvedValue(provenDomains.map((domain) => ({ domain })));
  }

  it("flips when the domain starts citing the brand", async () => {
    pageWith("DONE", ["g2.com"]);
    const data = await loadOpportunityPageData(TENANT);
    expect(data.rows[0]!.proven).toBe(true);
    expect(data.provenCount).toBe(1);
  });

  it("stays down while the domain still never names the brand", async () => {
    pageWith("DONE", []);
    const data = await loadOpportunityPageData(TENANT);
    expect(data.rows[0]!.proven).toBe(false);
    expect(data.provenCount).toBe(0);
  });

  it("asks the same question Citation Finder's 'cites you' cell asks", async () => {
    // Derived, never stored: brandCitations > 0 on the live rollup.
    pageWith("DONE", []);
    await loadOpportunityPageData(TENANT);
    expect(source.findMany.mock.calls[0]![0].where.brandCitations).toEqual({ gt: 0 });
  });
});
