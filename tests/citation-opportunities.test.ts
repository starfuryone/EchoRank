// tests/citation-opportunities.test.ts
//
// The pure half of the Citation Opportunity Engine: the scoring arithmetic, the
// effort map, the percentile cut and the how-to templates. No prisma, no Redis,
// no network — src/lib/citation-opportunities/score.ts imports none of them, so
// nothing here is stubbed and every assertion is over the real code path.
//
// The database-facing half is tests/citation-opportunities-store.test.ts.
//
// MONOTONICITY IS THE POINT. The product claim this whole feature makes is
// "these are in the right order". That claim is only as good as the guarantee
// that more citations, more engines and more rivals each move a row UP and
// never down — a guarantee the formula has by construction and which a future
// edit could silently break. Asserting it directly, rather than pinning a table
// of expected scores, is what makes the test survive a rescale of the units and
// fail on a change of the shape.

import { describe, expect, it } from "vitest";
import type { CitationKind } from "@/generated/prisma";
import {
  EFFORT_BY_KIND,
  EFFORT_WEIGHT,
  buildHowTo,
  computeImpact,
  computePriority,
  effortForKind,
  p75,
  scoreAll,
  scoreCandidate,
  usesTheme,
  type OpportunityCandidate,
  type OpportunitySignals,
} from "@/lib/citation-opportunities/score";

const KINDS: CitationKind[] = [
  "DIRECTORY",
  "REVIEW_SITE",
  "NEWS",
  "BLOG",
  "GOV",
  "SOCIAL",
  "OTHER",
];

const BASE: OpportunitySignals = { seenCount: 10, engineSpread: 2, rivalLift: 3 };

function candidate(over: Partial<OpportunityCandidate> = {}): OpportunityCandidate {
  return { domain: "example.com", kind: "DIRECTORY", ...BASE, ...over };
}

describe("computeImpact — monotonicity", () => {
  it("is non-decreasing in seenCount, holding the others fixed", () => {
    let previous = -Infinity;
    for (const seenCount of [0, 1, 2, 5, 10, 50, 200, 5_000]) {
      const impact = computeImpact({ ...BASE, seenCount });
      expect(impact).toBeGreaterThanOrEqual(previous);
      previous = impact;
    }
  });

  it("is non-decreasing in engineSpread, holding the others fixed", () => {
    let previous = -Infinity;
    for (const engineSpread of [1, 2, 3, 4, 5, 6]) {
      const impact = computeImpact({ ...BASE, engineSpread });
      expect(impact).toBeGreaterThanOrEqual(previous);
      previous = impact;
    }
  });

  it("is non-decreasing in rivalLift, holding the others fixed", () => {
    let previous = -Infinity;
    for (const rivalLift of [1, 2, 3, 10, 40, 900]) {
      const impact = computeImpact({ ...BASE, rivalLift });
      expect(impact).toBeGreaterThanOrEqual(previous);
      previous = impact;
    }
  });

  it("is STRICTLY increasing in each input once past the floors", () => {
    // Non-decreasing is the safety property; strictly increasing is what makes
    // the ranking informative. A formula that clamped a term would pass the
    // three tests above and produce a list that stops distinguishing rows.
    const base = computeImpact(BASE);
    expect(computeImpact({ ...BASE, seenCount: BASE.seenCount + 1 })).toBeGreaterThan(base);
    expect(computeImpact({ ...BASE, engineSpread: BASE.engineSpread + 1 })).toBeGreaterThan(base);
    expect(computeImpact({ ...BASE, rivalLift: BASE.rivalLift + 1 })).toBeGreaterThan(base);
  });

  it("dampens citations but not the engine spread", () => {
    // The shape claim in the header, asserted rather than described: doubling
    // the citations must move impact by LESS than doubling it, while doubling
    // the engines must double it exactly.
    const base = computeImpact(BASE);
    const doubledCitations = computeImpact({ ...BASE, seenCount: BASE.seenCount * 2 });
    const doubledEngines = computeImpact({ ...BASE, engineSpread: BASE.engineSpread * 2 });

    expect(doubledCitations).toBeLessThan(base * 2);
    expect(doubledEngines).toBeCloseTo(base * 2, 10);
  });
});

describe("computeImpact — floors and junk input", () => {
  it("floors the two multipliers at 1 rather than zeroing the row", () => {
    // A qualifying candidate always has at least one engine and one rival, so
    // these are defensive. The point is that a missing JSON column produces a
    // low score, not a zero one that silently drops a real opportunity to the
    // bottom of the list.
    expect(computeImpact({ seenCount: 10, engineSpread: 0, rivalLift: 0 })).toBeCloseTo(
      Math.log1p(10),
      10,
    );
  });

  it("treats a domain seen zero times as zero impact, not -Infinity", () => {
    // log(0) would be -Infinity and would sort below every dismissed row.
    expect(computeImpact({ seenCount: 0, engineSpread: 3, rivalLift: 3 })).toBe(0);
  });

  it("collapses NaN and Infinity to the floors instead of propagating", () => {
    const junk = computeImpact({
      seenCount: Number.NaN,
      engineSpread: Number.POSITIVE_INFINITY,
      rivalLift: Number.NaN,
    });
    expect(Number.isFinite(junk)).toBe(true);
    expect(junk).toBe(0);
  });

  it("never returns a negative impact for negative counts", () => {
    const impact = computeImpact({ seenCount: -5, engineSpread: -2, rivalLift: -9 });
    expect(impact).toBeGreaterThanOrEqual(0);
  });
});

describe("effort and priority", () => {
  it("maps every CitationKind to an effort band", () => {
    for (const kind of KINDS) {
      expect(EFFORT_BY_KIND[kind]).toBeDefined();
      expect(effortForKind(kind)).toBe(EFFORT_BY_KIND[kind]);
    }
  });

  it("puts the claim-a-form kinds low and the ask-a-human kinds high", () => {
    // The argument in the header, as literals. These are product decisions, so
    // changing one should require changing this test on purpose.
    expect(EFFORT_BY_KIND.DIRECTORY).toBe("LOW");
    expect(EFFORT_BY_KIND.SOCIAL).toBe("LOW");
    expect(EFFORT_BY_KIND.REVIEW_SITE).toBe("MED");
    expect(EFFORT_BY_KIND.BLOG).toBe("MED");
    expect(EFFORT_BY_KIND.OTHER).toBe("MED");
    expect(EFFORT_BY_KIND.NEWS).toBe("HIGH");
    expect(EFFORT_BY_KIND.GOV).toBe("HIGH");
  });

  it("ranks a cheaper row above an equally valuable expensive one", () => {
    const impact = computeImpact(BASE);
    expect(computePriority(impact, "LOW")).toBeGreaterThan(computePriority(impact, "MED"));
    expect(computePriority(impact, "MED")).toBeGreaterThan(computePriority(impact, "HIGH"));
  });

  it("keeps priority monotone in impact at fixed effort", () => {
    let previous = -Infinity;
    for (const seenCount of [1, 5, 20, 100]) {
      const priority = computePriority(computeImpact({ ...BASE, seenCount }), "MED");
      expect(priority).toBeGreaterThan(previous);
      previous = priority;
    }
  });

  it("weights the three bands 1 / 2 / 3", () => {
    expect(EFFORT_WEIGHT).toEqual({ LOW: 1, MED: 2, HIGH: 3 });
  });
});

describe("p75 — nearest rank", () => {
  it("returns null for an empty set rather than 0", () => {
    // 0 would make every row of a tenant's first sweep "above p75".
    expect(p75([])).toBeNull();
  });

  it("returns the only value for a single-element set", () => {
    expect(p75([7])).toBe(7);
  });

  it("returns a value that is IN the set", () => {
    const values = [1, 4, 9, 16, 25, 36, 49];
    expect(values).toContain(p75(values));
  });

  it("cuts at the 75th percentile by nearest rank", () => {
    // ceil(0.75 * 8) = 6, so the 6th smallest of 1..8.
    expect(p75([1, 2, 3, 4, 5, 6, 7, 8])).toBe(6);
    // ceil(0.75 * 4) = 3.
    expect(p75([10, 20, 30, 40])).toBe(30);
  });

  it("is order-independent", () => {
    expect(p75([5, 1, 4, 2, 3])).toBe(p75([1, 2, 3, 4, 5]));
  });

  it("lets at most a quarter of a set exceed it strictly", () => {
    // The property the notification volume rests on. With a strict `>`, a
    // four-row sweep alerts on at most one row.
    const values = [1, 2, 3, 4];
    const cut = p75(values)!;
    expect(values.filter((value) => value > cut)).toHaveLength(1);
  });

  it("ignores NaN rather than poisoning the sort", () => {
    expect(p75([1, Number.NaN, 3, 5])).toBe(5);
  });
});

describe("howTo templates", () => {
  it("has a template for every kind and interpolates the domain into it", () => {
    for (const kind of KINDS) {
      const text = buildHowTo({ domain: "g2.com", kind, theme: "review software" });
      expect(text).toContain("g2.com");
      expect(text).not.toContain("{domain}");
      expect(text).not.toContain("{theme}");
      expect(text.length).toBeGreaterThan(40);
    }
  });

  it("interpolates the theme only into the pitch kinds", () => {
    expect(usesTheme("NEWS")).toBe(true);
    expect(usesTheme("BLOG")).toBe(true);
    expect(usesTheme("DIRECTORY")).toBe(false);

    expect(buildHowTo({ domain: "x.com", kind: "NEWS", theme: "dental billing" })).toContain(
      "dental billing",
    );
    expect(buildHowTo({ domain: "x.com", kind: "DIRECTORY", theme: "dental billing" })).not.toContain(
      "dental billing",
    );
  });

  it("falls back to prose that still parses when the brand has no topics", () => {
    const text = buildHowTo({ domain: "x.com", kind: "NEWS", theme: null });
    expect(text).not.toContain("{theme}");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("null");
    expect(text).toContain("the questions your buyers ask");
  });

  it("treats a whitespace-only theme as no theme", () => {
    expect(buildHowTo({ domain: "x.com", kind: "BLOG", theme: "   " })).toContain(
      "the questions your buyers ask",
    );
  });

  it("names the Campaigns tool in the review-site how-to", () => {
    // The spec asks for the hand-off explicitly, and it is the only template
    // that points at another surface in this product.
    expect(buildHowTo({ domain: "g2.com", kind: "REVIEW_SITE" })).toContain("/campaigns");
  });

  it("mentions NAP consistency in the directory how-to", () => {
    const text = buildHowTo({ domain: "yelp.com", kind: "DIRECTORY" });
    expect(text).toMatch(/name, address and phone/i);
  });

  it("makes no AI call — the templates are literals", () => {
    // v1 constraint, asserted the only way a pure module can: the same input
    // produces byte-identical output every time, which a generated paragraph
    // would not.
    const once = buildHowTo({ domain: "g2.com", kind: "NEWS", theme: "billing" });
    const twice = buildHowTo({ domain: "g2.com", kind: "NEWS", theme: "billing" });
    expect(once).toBe(twice);
  });
});

describe("scoreCandidate", () => {
  it("stores a theme only for the kinds whose advice uses one", () => {
    expect(scoreCandidate(candidate({ kind: "NEWS" }), "dental billing").theme).toBe(
      "dental billing",
    );
    expect(scoreCandidate(candidate({ kind: "DIRECTORY" }), "dental billing").theme).toBeNull();
  });

  it("derives effort from kind and priority from impact over effort", () => {
    const row = scoreCandidate(candidate({ kind: "NEWS" }));
    expect(row.effort).toBe("HIGH");
    expect(row.priority).toBeCloseTo(row.impact / EFFORT_WEIGHT.HIGH, 10);
  });
});

describe("scoreAll", () => {
  it("returns rows best first", () => {
    const rows = scoreAll([
      candidate({ domain: "weak.com", seenCount: 1, engineSpread: 1, rivalLift: 1 }),
      candidate({ domain: "strong.com", seenCount: 500, engineSpread: 4, rivalLift: 40 }),
      candidate({ domain: "middle.com", seenCount: 20, engineSpread: 2, rivalLift: 5 }),
    ]);
    expect(rows.map((row) => row.domain)).toEqual(["strong.com", "middle.com", "weak.com"]);
  });

  it("breaks ties by domain so the order is stable across sweeps", () => {
    // The week a brand is first tracked, every source has been seen once.
    const rows = scoreAll([
      candidate({ domain: "zebra.com" }),
      candidate({ domain: "apple.com" }),
      candidate({ domain: "mango.com" }),
    ]);
    expect(rows.map((row) => row.domain)).toEqual(["apple.com", "mango.com", "zebra.com"]);
  });

  it("ranks a low-effort directory above a high-effort newspaper of equal reach", () => {
    // The whole reason priority divides by effort, as a scenario rather than an
    // identity: same signals, different kind, and the cheap one wins.
    const rows = scoreAll([
      candidate({ domain: "news.example", kind: "NEWS" }),
      candidate({ domain: "dir.example", kind: "DIRECTORY" }),
    ]);
    expect(rows[0]!.domain).toBe("dir.example");
    expect(rows[0]!.impact).toBeCloseTo(rows[1]!.impact, 10);
  });

  it("still lets a far better source outrank a cheaper worse one", () => {
    // Effort is a divisor, not a veto. A newspaper the engines cite constantly
    // must be able to beat a directory nobody reads, or the list would only
    // ever recommend directories.
    const rows = scoreAll([
      candidate({ domain: "dir.example", kind: "DIRECTORY", seenCount: 1, engineSpread: 1, rivalLift: 1 }),
      candidate({ domain: "news.example", kind: "NEWS", seenCount: 400, engineSpread: 4, rivalLift: 30 }),
    ]);
    expect(rows[0]!.domain).toBe("news.example");
  });

  it("returns an empty list for no candidates", () => {
    expect(scoreAll([])).toEqual([]);
  });
});
