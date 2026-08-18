// tests/keyword-opportunity-seeds.test.ts
//
// Seeded analysis mode: the Keyword Explorer -> Opportunity Finder bridge.
//
// PURE HALF ONLY. The seed normaliser and the cache-identity hash decide
// whether a customer is charged for a run or served an earlier one, so they
// are tested without a database — the same posture ./keyword-opportunity-score
// takes for the scorer, and for the same reason.

import { describe, expect, it } from "vitest";

import {
  SeedSetError,
  normalizeSeed,
  normalizeSeedSet,
  seedSetHash,
} from "@/lib/keyword-opportunity/seeds";
import { WORKING_SET_LIMIT } from "@/lib/keyword-opportunity/limits";
import { parseOverview } from "@/lib/keyword-opportunity/enrich";

describe("seed normalisation", () => {
  it("lowercases, collapses whitespace and trims", () => {
    expect(normalizeSeed("  Best   CRM  ")).toBe("best crm");
    expect(normalizeSeed("KEYWORD\tResearch")).toBe("keyword research");
  });

  it("does not stem or strip punctuation", () => {
    // These came off the customer's own pages via Keyword Explorer. Folding
    // them the way discover.ts keywordKey() folds provider rows would merge
    // distinctions the customer can see in the table they picked from.
    expect(normalizeSeed("b2b")).toBe("b2b");
    expect(normalizeSeed("b 2 b")).toBe("b 2 b");
    expect(normalizeSeed("seo-tools")).toBe("seo-tools");
  });

  it("dedupes case and spacing variants into one seed", () => {
    expect(normalizeSeedSet(["Best CRM", "best  crm", "BEST CRM"])).toEqual(["best crm"]);
  });

  it("drops blanks rather than scoring them", () => {
    expect(normalizeSeedSet(["crm", "", "   ", "seo"])).toEqual(["crm", "seo"]);
  });

  it("returns a sorted set, because a selection has no order", () => {
    expect(normalizeSeedSet(["zeta", "alpha", "mid"])).toEqual(["alpha", "mid", "zeta"]);
  });

  it("refuses an empty selection", () => {
    expect(() => normalizeSeedSet([])).toThrow(SeedSetError);
    expect(() => normalizeSeedSet(["", "  "])).toThrow(/at least one/i);
  });

  it("REJECTS an over-cap set rather than truncating it", () => {
    // Silently dropping the tail would charge a full domain analysis for a
    // subset, and the customer could not tell which half they paid for.
    const tooMany = Array.from({ length: WORKING_SET_LIMIT + 1 }, (_, i) => `kw ${i}`);
    expect(() => normalizeSeedSet(tooMany)).toThrow(SeedSetError);
    try {
      normalizeSeedSet(tooMany);
    } catch (err) {
      expect((err as SeedSetError).code).toBe("OVER_CAP");
      expect((err as SeedSetError).count).toBe(WORKING_SET_LIMIT + 1);
      expect((err as SeedSetError).message).toContain(String(WORKING_SET_LIMIT));
    }
  });

  it("accepts exactly the cap", () => {
    const atCap = Array.from({ length: WORKING_SET_LIMIT }, (_, i) => `kw ${i}`);
    expect(normalizeSeedSet(atCap)).toHaveLength(WORKING_SET_LIMIT);
  });
});

describe("cache identity", () => {
  it("is order-independent — the same set picked differently is one analysis", () => {
    expect(seedSetHash(["alpha", "beta"])).toBe(seedSetHash(["beta", "alpha"]));
  });

  it("separates sets that differ by one keyword", () => {
    expect(seedSetHash(["alpha", "beta"])).not.toBe(seedSetHash(["alpha", "beta", "gamma"]));
  });

  it("does not collide across the join boundary", () => {
    // {"a b", "c"} and {"a", "b c"} join to the same string under a space
    // separator. A collision here serves one customer another's analysis.
    expect(seedSetHash(["a b", "c"])).not.toBe(seedSetHash(["a", "b c"]));
  });

  it("is a stable hex digest", () => {
    const hash = seedSetHash(["best crm"]);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(seedSetHash(["best crm"])).toBe(hash);
  });
});

describe("seeded enrichment shape", () => {
  it("returns one row per seed, answered or not", () => {
    // A keyword DataForSEO has no data for is a real finding — a phrase the
    // customer's pages use that nobody searches. Dropping it would silently
    // shrink a set they chose and paid to have scored.
    const rows = parseOverview(
      [{ keyword: "best crm", keyword_info: { search_volume: 8100, cpc: 18, competition: 0.7 } }],
      ["best crm", "nobody searches this"],
    );
    expect(rows.map((r) => r.keyword)).toEqual(["best crm", "nobody searches this"]);
    expect(rows[0].monthlyVolume).toBe(8100);
    expect(rows[0].cpcUsd).toBe(18);
    // The unanswered one scores badly on volume, which is correct.
    expect(rows[1].monthlyVolume).toBe(0);
  });

  it("marks provenance as seeded, not as a discovery endpoint", () => {
    const [row] = parseOverview([], ["crm"]);
    expect(row.source).toBe("seeded");
  });

  it("classifies intent from the keyword, as discovery does", () => {
    const [row] = parseOverview([], ["best crm for startups"]);
    expect(row.intent).toBe("commercial_investigation");
  });

  it("clamps the provider's figures the way discovery does", () => {
    const [row] = parseOverview(
      [{ keyword: "x", keyword_info: { search_volume: -5, cpc: -1, competition: 4 } }],
      ["x"],
    );
    expect(row.monthlyVolume).toBe(0);
    expect(row.cpcUsd).toBe(0);
    expect(row.competition).toBe(1);
  });
});
