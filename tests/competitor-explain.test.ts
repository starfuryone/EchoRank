// tests/competitor-explain.test.ts
//
// The AI Competitor Reverse Engineer: the four things that can quietly go
// wrong and cost either money or trust.
//
//   cache      — the 7-day window serves stored rather than re-buying, and the
//                per-call Redis cache stops the second rival in a week paying
//                for the tenant's own domain twice
//   metering   — every metered call writes a SeoApiCall row, and the USD cap is
//                checked BEFORE the request is built, not after
//   isolation  — every query carries tenantId, including the ones whose keys
//                would look unique without it
//   ranking    — the order the customer reads, including where an unmeasured
//                factor lands and that it never outranks a measured one
//
// Prisma, Redis, the metered DataForSEO client, Places and the logger are
// stubbed; the scoring, the normalisation, the cap arithmetic and the cache
// arithmetic are the real code paths. Same approach as
// tests/citation-opportunities-store.test.ts and for the same reason: this
// box's .env is not readable by the test account and there is no test database.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const {
  sovSnapshot,
  source,
  citationOpportunity,
  explainReport,
  brandProfile,
  redis,
  loggerFns,
  metering,
  places,
} = vi.hoisted(() => ({
  sovSnapshot: { findFirst: vi.fn(), findMany: vi.fn() },
  source: { findMany: vi.fn() },
  citationOpportunity: { findFirst: vi.fn() },
  explainReport: { findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
  brandProfile: { findFirst: vi.fn() },
  redis: { get: vi.fn(), set: vi.fn() },
  loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  metering: {
    recordCall: vi.fn(),
    spentThisMonth: vi.fn(),
    monthlyCapUsd: vi.fn(),
    seoMeteredCallResult: vi.fn(),
  },
  places: { fetchPlace: vi.fn(), placesConfigured: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { sovSnapshot, source, citationOpportunity, explainReport, brandProfile },
}));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => redis }));
vi.mock("@/lib/dataforseo/metering", () => metering);
vi.mock("@/lib/signals/competitors", () => places);

import {
  gatherAuthority,
  gatherEntities,
  gatherReviews,
  gatherRivalSources,
  gatherSovGaps,
  entityCount,
  EXPLAIN_CACHE_TTL_SECONDS,
} from "@/lib/explain/gather";
import { buildFactors, FACTOR_WEIGHT } from "@/lib/explain/factors";
import { isFresh, normalizeRivalDomain } from "@/lib/explain/store";
import { EXPLAIN_RERUN_DAYS } from "@/lib/explain/window";
import { estimateRunCost, BACKLINKS_SUMMARY_USD, PLACES_DETAILS_USD } from "@/lib/explain/cost";
import { listRivals, suggestRivalDomain } from "@/lib/explain/rival";
import { fixHref, fixLabelEn } from "@/lib/explain/labels";
import type { ExplainGather, GatherOutcome } from "@/lib/explain/types";

const TENANT = "tenant_a";
const OTHER_TENANT = "tenant_b";
const PROFILE = "profile_1";

/** An outcome that carries data, for assembling a gather in ranking tests. */
function ok<T>(value: T, costUsd = 0): GatherOutcome<T> {
  return { ok: true, value, costUsd };
}
function fail(reason: Parameters<typeof String>[0], costUsd = 0) {
  return { ok: false as const, reason: reason as never, costUsd };
}

/** A gather with every factor measured and level, so a test can move one. */
function levelGather(): ExplainGather {
  return {
    sovGaps: ok([]),
    rivalSources: ok([]),
    reviews: ok({ them: { rating: 4, reviewCount: 10 }, you: { rating: 4, reviewCount: 10 } }),
    site: ok({ them: { score: 70, failures: [] }, you: { score: 70, failures: [] } }),
    authority: ok({ them: { referringDomains: 100, rank: 200 }, you: { referringDomains: 100, rank: 200 } }),
    entities: ok({
      them: { wikipedia: true, wikidata: false, crunchbase: false },
      you: { wikipedia: true, wikidata: false, crunchbase: false },
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  redis.get.mockResolvedValue(null);
  redis.set.mockResolvedValue("OK");
  metering.spentThisMonth.mockResolvedValue(0);
  metering.monthlyCapUsd.mockResolvedValue(25);
  metering.recordCall.mockResolvedValue(undefined);
  citationOpportunity.findFirst.mockResolvedValue(null);
  places.placesConfigured.mockReturnValue(true);
});

// ─── Cache behaviour ────────────────────────────────────────────────────────

describe("the 7-day window", () => {
  it("serves a report inside the window and re-runs one outside it", () => {
    const now = Date.parse("2026-08-15T12:00:00Z");
    const dayMs = 24 * 60 * 60 * 1000;

    // One hour old — plainly fresh.
    expect(isFresh({ createdAt: new Date(now - 3_600_000).toISOString() }, now)).toBe(true);
    // A minute inside the boundary.
    expect(
      isFresh({ createdAt: new Date(now - EXPLAIN_RERUN_DAYS * dayMs + 60_000).toISOString() }, now),
    ).toBe(true);
    // A minute past it.
    expect(
      isFresh({ createdAt: new Date(now - EXPLAIN_RERUN_DAYS * dayMs - 60_000).toISOString() }, now),
    ).toBe(false);
  });

  it("expires the per-call cache on the same window as the report", () => {
    // Drift here would mean a day-8 re-run mixing week-old authority into a
    // fresh report with no way to say which half is which.
    expect(EXPLAIN_CACHE_TTL_SECONDS).toBe(EXPLAIN_RERUN_DAYS * 24 * 60 * 60);
  });

  it("buys nothing when both domains are already cached", async () => {
    redis.get.mockResolvedValue(JSON.stringify({ referringDomains: 500, rank: 300 }));

    const result = await gatherAuthority({
      tenantId: TENANT,
      rivalDomain: "rival.com",
      yourDomain: "you.com",
      spent: metering.spentThisMonth,
      cap: metering.monthlyCapUsd,
      call: metering.seoMeteredCallResult,
    });

    expect(result.ok).toBe(true);
    expect(result.costUsd).toBe(0);
    expect(metering.seoMeteredCallResult).not.toHaveBeenCalled();
    // Not even the cap is read: there is nothing to buy, so there is nothing
    // to check against.
    expect(metering.spentThisMonth).not.toHaveBeenCalled();
  });

  it("buys only the uncached domain when the tenant's own is already known", async () => {
    redis.get.mockImplementation(async (key: string) =>
      key.endsWith("you.com") ? JSON.stringify({ referringDomains: 200, rank: 150 }) : null,
    );
    metering.seoMeteredCallResult.mockResolvedValue({
      data: [{ referring_domains: 900, rank: 400 }],
      billing: { path: ["v3", "backlinks", "summary", "live"], costUsd: 0.024 },
    });

    const result = await gatherAuthority({
      tenantId: TENANT,
      rivalDomain: "rival.com",
      yourDomain: "you.com",
      spent: metering.spentThisMonth,
      cap: metering.monthlyCapUsd,
      call: metering.seoMeteredCallResult,
    });

    expect(metering.seoMeteredCallResult).toHaveBeenCalledTimes(1);
    expect(metering.seoMeteredCallResult.mock.calls[0][1]).toContain("backlinks/summary");
    expect(result.ok && result.value.you.referringDomains).toBe(200);
    expect(result.ok && result.value.them.referringDomains).toBe(900);
  });

  it("writes the cache with the window's TTL, tenant-scoped", async () => {
    metering.seoMeteredCallResult.mockResolvedValue({
      data: [{ referring_domains: 10, rank: 20 }],
      billing: { path: ["v3", "backlinks", "summary", "live"], costUsd: 0.024 },
    });

    await gatherAuthority({
      tenantId: TENANT,
      rivalDomain: "rival.com",
      yourDomain: null,
      spent: metering.spentThisMonth,
      cap: metering.monthlyCapUsd,
      call: metering.seoMeteredCallResult,
    });

    const [key, , mode, ttl] = redis.set.mock.calls[0];
    expect(key).toContain(TENANT);
    expect(key).toContain("rival.com");
    expect(mode).toBe("EX");
    expect(ttl).toBe(EXPLAIN_CACHE_TTL_SECONDS);
  });

  it("treats a Redis outage as a miss rather than throwing", async () => {
    redis.get.mockRejectedValue(new Error("connection lost"));
    metering.seoMeteredCallResult.mockResolvedValue({
      data: [{ referring_domains: 1, rank: 2 }],
      billing: { path: ["v3", "backlinks", "summary", "live"], costUsd: 0.024 },
    });

    const result = await gatherAuthority({
      tenantId: TENANT,
      rivalDomain: "rival.com",
      yourDomain: null,
      spent: metering.spentThisMonth,
      cap: metering.monthlyCapUsd,
      call: metering.seoMeteredCallResult,
    });

    expect(result.ok).toBe(true);
    expect(loggerFns.warn).toHaveBeenCalled();
  });
});

// ─── Cost + metering ────────────────────────────────────────────────────────

describe("metering", () => {
  it("checks the cap BEFORE building the request, and buys nothing when reached", async () => {
    metering.spentThisMonth.mockResolvedValue(25);
    metering.monthlyCapUsd.mockResolvedValue(25);

    const result = await gatherAuthority({
      tenantId: TENANT,
      rivalDomain: "rival.com",
      yourDomain: "you.com",
      spent: metering.spentThisMonth,
      cap: metering.monthlyCapUsd,
      call: metering.seoMeteredCallResult,
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe("cap_reached");
    expect(result.costUsd).toBe(0);
    expect(metering.seoMeteredCallResult).not.toHaveBeenCalled();
    expect(loggerFns.warn).toHaveBeenCalled();
  });

  it("bills authority from the RESPONSE, not from the estimate constant", async () => {
    // DataForSEO's envelope is the source of truth; cost.ts exists only to
    // quote a price before the run. A run billed from the constant would
    // silently diverge from the SeoApiCall rows the cap is computed on.
    metering.seoMeteredCallResult.mockResolvedValue({
      data: [{ referring_domains: 5, rank: 5 }],
      billing: { path: ["v3", "backlinks", "summary", "live"], costUsd: 0.031337 },
    });

    const result = await gatherAuthority({
      tenantId: TENANT,
      rivalDomain: "rival.com",
      yourDomain: null,
      spent: metering.spentThisMonth,
      cap: metering.monthlyCapUsd,
      call: metering.seoMeteredCallResult,
    });

    expect(result.costUsd).toBe(0.031337);
    expect(result.costUsd).not.toBe(BACKLINKS_SUMMARY_USD);
  });

  it("writes a SeoApiCall row for every Places lookup, including a failed one", async () => {
    places.fetchPlace.mockImplementation(async (id: string) =>
      id === "rival_place"
        ? { ok: true, place: { rating: 4.6, reviewCount: 1204 } }
        : { ok: false, error: "http_404" },
    );

    const result = await gatherReviews({
      tenantId: TENANT,
      rivalPlaceId: "rival_place",
      yourPlaceId: "your_place",
      spent: metering.spentThisMonth,
      cap: metering.monthlyCapUsd,
      fetchDetails: places.fetchPlace,
    });

    expect(metering.recordCall).toHaveBeenCalledTimes(2);
    const rows = metering.recordCall.mock.calls.map((call) => call[0]);
    expect(rows.every((row) => row.tenantId === TENANT)).toBe(true);
    expect(rows.every((row) => row.feature === "local_seo")).toBe(true);
    expect(rows.every((row) => row.costUsd === PLACES_DETAILS_USD)).toBe(true);
    // A failed call still left the building and is still billed by Google.
    expect(rows.filter((row) => row.ok === false)).toHaveLength(1);
    expect(result.costUsd).toBe(PLACES_DETAILS_USD * 2);
  });

  it("buys no Places call at all when the rival has no listing", async () => {
    const result = await gatherReviews({
      tenantId: TENANT,
      rivalPlaceId: null,
      yourPlaceId: "your_place",
      spent: metering.spentThisMonth,
      cap: metering.monthlyCapUsd,
      fetchDetails: places.fetchPlace,
    });

    expect(!result.ok && result.reason).toBe("no_place_id");
    expect(result.costUsd).toBe(0);
    expect(places.fetchPlace).not.toHaveBeenCalled();
    expect(metering.recordCall).not.toHaveBeenCalled();
  });

  it("estimates a run from the recorded rates, and drops lines it will not buy", () => {
    const full = estimateRunCost({ domainsToPrice: 2, placesLookups: 2 });
    expect(full.totalUsd).toBeCloseTo(2 * BACKLINKS_SUMMARY_USD + 2 * PLACES_DETAILS_USD, 6);
    // Free gatherers are itemised at zero rather than omitted, so the estimate
    // reads as a complete accounting of all six.
    expect(full.lines).toHaveLength(4);
    expect(full.meteredUsd).toBeCloseTo(full.totalUsd, 6);

    const noPlaces = estimateRunCost({ domainsToPrice: 2, placesLookups: 0 });
    expect(noPlaces.totalUsd).toBeCloseTo(2 * BACKLINKS_SUMMARY_USD, 6);
  });
});

// ─── Tenant isolation ───────────────────────────────────────────────────────

describe("tenant isolation", () => {
  it("scopes the share-of-voice read to the tenant AND the brand profile", async () => {
    sovSnapshot.findFirst.mockResolvedValue({ date: new Date("2026-08-14") });
    sovSnapshot.findMany.mockResolvedValue([]);

    await gatherSovGaps({
      tenantId: TENANT,
      brandProfileId: PROFILE,
      brandName: "You",
      rivalName: "Them",
    });

    for (const call of [sovSnapshot.findFirst, sovSnapshot.findMany]) {
      expect(call.mock.calls[0][0].where).toMatchObject({
        tenantId: TENANT,
        promptSetId: PROFILE,
      });
    }
  });

  it("scopes the sources read to the tenant, never the brand profile alone", async () => {
    source.findMany.mockResolvedValue([]);

    await gatherRivalSources({ tenantId: TENANT, brandProfileId: PROFILE, rivalName: "Them" });

    // brandProfileId alone would be enough to be correct today, and would stop
    // being enough the moment a profile id is ever reused or guessed. The
    // tenant filter is the guarantee, not an optimisation.
    expect(source.findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: TENANT,
      brandProfileId: PROFILE,
    });
  });

  it("scopes the fix-link lookup to the tenant", async () => {
    const gather = levelGather();
    gather.rivalSources = ok([
      { domain: "g2.com", rivalCitations: 9, brandCitations: 0, distinctEngines: 3 },
    ]);

    await buildFactors(gather, { tenantId: TENANT, brandProfileId: PROFILE });

    expect(citationOpportunity.findFirst.mock.calls[0][0].where).toMatchObject({
      tenantId: TENANT,
      status: "OPEN",
    });
  });

  it("keys the per-call cache by tenant so one tenant's spend cannot serve another", async () => {
    metering.seoMeteredCallResult.mockResolvedValue({
      data: [{ referring_domains: 1, rank: 1 }],
      billing: { path: ["v3", "backlinks", "summary", "live"], costUsd: 0.024 },
    });

    await gatherAuthority({
      tenantId: TENANT,
      rivalDomain: "shared.com",
      yourDomain: null,
      spent: metering.spentThisMonth,
      cap: metering.monthlyCapUsd,
      call: metering.seoMeteredCallResult,
    });
    const keyA = redis.get.mock.calls[0][0];

    await gatherAuthority({
      tenantId: OTHER_TENANT,
      rivalDomain: "shared.com",
      yourDomain: null,
      spent: metering.spentThisMonth,
      cap: metering.monthlyCapUsd,
      call: metering.seoMeteredCallResult,
    });
    const keyB = redis.get.mock.calls[redis.get.mock.calls.length - 1][0];

    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain(TENANT);
    expect(keyB).toContain(OTHER_TENANT);
  });

  it("scopes the rival picker's reads to the tenant", async () => {
    brandProfile.findFirst.mockResolvedValue({ competitors: [] });
    source.findMany.mockResolvedValue([]);

    await listRivals({ tenantId: TENANT, brandProfileId: PROFILE });

    expect(brandProfile.findFirst.mock.calls[0][0].where).toMatchObject({
      id: PROFILE,
      tenantId: TENANT,
    });
    expect(source.findMany.mock.calls[0][0].where).toMatchObject({ tenantId: TENANT });
  });
});

// ─── Factor ranking ─────────────────────────────────────────────────────────

describe("factor ranking", () => {
  it("returns all six factors, always", async () => {
    const factors = await buildFactors(levelGather(), {
      tenantId: TENANT,
      brandProfileId: PROFILE,
    });
    expect(factors).toHaveLength(6);
    expect(new Set(factors.map((f) => f.factor)).size).toBe(6);
  });

  it("ranks a bigger normalised gap above a bigger raw one", async () => {
    const gather = levelGather();
    // Authority: 1000 vs 900 — a raw gap of 100, but only 10% of their total.
    gather.authority = ok({
      them: { referringDomains: 1000, rank: 500 },
      you: { referringDomains: 900, rank: 480 },
    });
    // Cited sources: 10 vs 1 — a raw gap of 9, but 90% of their total.
    gather.rivalSources = ok([
      { domain: "g2.com", rivalCitations: 10, brandCitations: 1, distinctEngines: 2 },
    ]);

    const factors = await buildFactors(gather, { tenantId: TENANT, brandProfileId: PROFILE });
    const cited = factors.findIndex((f) => f.factor === "cited_sources");
    const authority = factors.findIndex((f) => f.factor === "authority");
    expect(cited).toBeLessThan(authority);
  });

  it("weights share of voice above an equally severe lesser factor", async () => {
    const gather = levelGather();
    // Both normalise to a severity of 0.5; the weight is the tiebreaker.
    gather.sovGaps = ok([
      { engine: "CHATGPT", theirShare: 50, yourShare: 0, promptCount: 10 },
    ]);
    gather.site = ok({
      them: { score: 100, failures: [] },
      you: { score: 50, failures: ["sitemap"] },
    });

    const factors = await buildFactors(gather, { tenantId: TENANT, brandProfileId: PROFILE });
    const sov = factors.find((f) => f.factor === "share_of_voice")!;
    const site = factors.find((f) => f.factor === "site_readiness")!;

    expect(sov.severity).toBeCloseTo(site.severity, 6);
    expect(sov.score).toBeGreaterThan(site.score);
    expect(FACTOR_WEIGHT.share_of_voice).toBeGreaterThan(FACTOR_WEIGHT.site_readiness);
    expect(factors.indexOf(sov)).toBeLessThan(factors.indexOf(site));
  });

  it("sinks every unmeasured factor below every measured one, even a level one", async () => {
    const gather = levelGather();
    gather.sovGaps = fail("awaiting_first_aggregation");
    gather.reviews = fail("no_place_id");

    const factors = await buildFactors(gather, { tenantId: TENANT, brandProfileId: PROFILE });
    const lastMeasured = factors.findLastIndex((f) => !f.unavailable);
    const firstUnmeasured = factors.findIndex((f) => f.unavailable);

    expect(firstUnmeasured).toBeGreaterThan(lastMeasured);
    // A level factor scores 0 and still outranks an unmeasured one at -1: "you
    // are even here" is a finding, "we did not look" is not.
    expect(factors[lastMeasured].score).toBe(0);
    expect(factors[firstUnmeasured].score).toBe(-1);
  });

  it("orders unmeasured factors among themselves by weight", async () => {
    const gather = levelGather();
    gather.sovGaps = fail("awaiting_first_aggregation");
    gather.reviews = fail("no_place_id");

    const factors = await buildFactors(gather, { tenantId: TENANT, brandProfileId: PROFILE });
    const unmeasured = factors.filter((f) => f.unavailable).map((f) => f.factor);
    // Share of voice is the one worth waiting for, so it leads the group.
    expect(unmeasured[0]).toBe("share_of_voice");
  });

  it("carries the reason, not just the absence, on an unmeasured factor", async () => {
    const gather = levelGather();
    gather.sovGaps = fail("awaiting_first_aggregation");

    const factors = await buildFactors(gather, { tenantId: TENANT, brandProfileId: PROFILE });
    const sov = factors.find((f) => f.factor === "share_of_voice")!;

    expect(sov.unavailable).toBe("awaiting_first_aggregation");
    expect(sov.them).toBeNull();
    expect(sov.you).toBeNull();
    expect(sov.gap).toBeNull();
    expect(sov.detail).toBeTruthy();
    // Nothing to fix about a factor nobody measured.
    expect(sov.linkedFix.kind).toBe("none");
  });

  it("never links a fix to a factor the customer is already winning", async () => {
    const factors = await buildFactors(levelGather(), {
      tenantId: TENANT,
      brandProfileId: PROFILE,
    });
    expect(factors.every((f) => f.linkedFix.kind === "none")).toBe(true);
    expect(citationOpportunity.findFirst).not.toHaveBeenCalled();
  });

  it("points a citation fix at a real opportunity row when the sweep has run", async () => {
    citationOpportunity.findFirst.mockResolvedValue({ id: "opp_1", domain: "g2.com" });
    const gather = levelGather();
    gather.rivalSources = ok([
      { domain: "g2.com", rivalCitations: 9, brandCitations: 0, distinctEngines: 3 },
    ]);

    const factors = await buildFactors(gather, { tenantId: TENANT, brandProfileId: PROFILE });
    const cited = factors.find((f) => f.factor === "cited_sources")!;

    expect(cited.linkedFix).toEqual({ kind: "opportunity", opportunityId: "opp_1", domain: "g2.com" });
    expect(fixHref(cited.linkedFix)).toContain("citation-opportunities");
  });

  it("degrades a citation fix to the work TYPE — never to none — when the sweep has not run", async () => {
    // The empty-table case this whole feature had to be designed around.
    citationOpportunity.findFirst.mockResolvedValue(null);
    const gather = levelGather();
    gather.rivalSources = ok([
      { domain: "g2.com", rivalCitations: 9, brandCitations: 0, distinctEngines: 3 },
    ]);

    const factors = await buildFactors(gather, { tenantId: TENANT, brandProfileId: PROFILE });
    const cited = factors.find((f) => f.factor === "cited_sources")!;

    expect(cited.linkedFix.kind).toBe("roadmap");
    expect(fixLabelEn(cited.linkedFix)).toBeTruthy();
    // Named, but not linked: there is no roadmap page to send anyone to.
    expect(fixHref(cited.linkedFix)).toBeNull();
  });

  it("only counts sources that cite the rival, matching the name case-insensitively", async () => {
    source.findMany.mockResolvedValue([
      {
        domain: "otterly.ai",
        brandCitations: 0,
        distinctEngines: 3,
        // The aggregator stores whatever casing each engine used. Summing the
        // spellings is the difference between 22 citations and 12.
        citesCompetitors: { "Otterly.AI": 12, "Otterly.ai": 10, Profound: 5 },
      },
      { domain: "unrelated.com", brandCitations: 4, distinctEngines: 1, citesCompetitors: { Profound: 3 } },
    ]);

    const result = await gatherRivalSources({
      tenantId: TENANT,
      brandProfileId: PROFILE,
      rivalName: "otterly.ai",
    });

    expect(result.ok && result.value).toHaveLength(1);
    expect(result.ok && result.value[0].rivalCitations).toBe(22);
  });

  it("reports the WORST engine gap, not the average", async () => {
    sovSnapshot.findFirst.mockResolvedValue({ date: new Date("2026-08-14") });
    sovSnapshot.findMany.mockResolvedValue([
      { engine: "CHATGPT", brand: "Them", share: 0.6, promptCount: 10 },
      { engine: "CHATGPT", brand: "You", share: 0.1, promptCount: 10 },
      { engine: "CLAUDE", brand: "Them", share: 0.3, promptCount: 10 },
      { engine: "CLAUDE", brand: "You", share: 0.28, promptCount: 10 },
      // An engine they lose on is not a gap and must not appear.
      { engine: "GEMINI", brand: "Them", share: 0.1, promptCount: 10 },
      { engine: "GEMINI", brand: "You", share: 0.5, promptCount: 10 },
    ]);

    const result = await gatherSovGaps({
      tenantId: TENANT,
      brandProfileId: PROFILE,
      brandName: "You",
      rivalName: "Them",
    });

    expect(result.ok && result.value).toHaveLength(2);
    expect(result.ok && result.value[0].engine).toBe("CHATGPT");
    expect(result.ok && result.value[0].theirShare).toBeCloseTo(60, 6);
  });
});

// ─── Rival identity ─────────────────────────────────────────────────────────

describe("rival identity", () => {
  it("normalises a rival domain the way sources and citations store it", () => {
    expect(normalizeRivalDomain("https://www.Otterly.ai/pricing")).toBe("otterly.ai");
    expect(normalizeRivalDomain("  ")).toBeNull();
  });

  it("suggests a domain only from the tenant's own cited rows", async () => {
    source.findMany.mockResolvedValue([{ domain: "otterly.ai" }, { domain: "g2.com" }]);

    await expect(
      suggestRivalDomain({ tenantId: TENANT, brandProfileId: PROFILE, rivalName: "Otterly.AI" }),
    ).resolves.toBe("otterly.ai");
    expect(source.findMany.mock.calls[0][0].where).toMatchObject({ tenantId: TENANT });

    // A rival with no site among this tenant's citations resolves to nothing,
    // and the customer is asked rather than guessed at.
    await expect(
      suggestRivalDomain({ tenantId: TENANT, brandProfileId: PROFILE, rivalName: "Nowhere Inc" }),
    ).resolves.toBeNull();
  });

  it("merges spellings of one rival into a single pick", async () => {
    brandProfile.findFirst.mockResolvedValue({ competitors: ["Otterly.AI"] });
    source.findMany.mockResolvedValue([
      { domain: "otterly.ai", citesCompetitors: { "Otterly.AI": 12, "Otterly.ai": 10 } },
    ]);

    const rivals = await listRivals({ tenantId: TENANT, brandProfileId: PROFILE });
    expect(rivals).toHaveLength(1);
    expect(rivals[0].citations).toBe(22);
    expect(rivals[0].suggestedDomain).toBe("otterly.ai");
  });
});

// ─── Entities ───────────────────────────────────────────────────────────────

describe("entity checks", () => {
  it("treats a 3xx as presence on Wikidata and a 200 elsewhere, and never follows redirects", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      if (url.includes("wikidata")) return { status: 302 } as Response;
      if (url.includes("wikipedia")) return { status: 200 } as Response;
      return { status: 403 } as Response; // Crunchbase blocking a bot.
    });

    const result = await gatherEntities({
      rivalName: "Otterly AI",
      brandName: "You",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok && result.value.them).toEqual({
      wikipedia: true,
      wikidata: true,
      // A 403 is not evidence of existence. Presence must be positively
      // confirmed, so a bot-block reads as absent.
      crunchbase: false,
    });
    expect(seen.every((call) => call.init.method === "HEAD")).toBe(true);
    expect(seen.every((call) => call.init.redirect === "manual")).toBe(true);
    // Spaces become underscores for the wiki slug, hyphens for Crunchbase.
    expect(seen.some((call) => call.url.includes("Otterly_AI"))).toBe(true);
    expect(seen.some((call) => call.url.includes("otterly-ai"))).toBe(true);
  });

  it("counts presence out of three", () => {
    expect(entityCount({ wikipedia: true, wikidata: true, crunchbase: false })).toBe(2);
    expect(entityCount({ wikipedia: false, wikidata: false, crunchbase: false })).toBe(0);
  });
});
