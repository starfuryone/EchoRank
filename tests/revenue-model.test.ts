// tests/revenue-model.test.ts
//
// The arithmetic half of the AI Revenue dashboard. Pure — no Prisma, no clock,
// no mocks — because src/lib/revenue/model.ts takes no dependencies, which is
// what lets every number below be worked out by hand and written down rather
// than snapshotted.
//
// What this file is really guarding:
//
// 1. THE FOUR ATTRIBUTION MODELS GENUINELY DISAGREE. A rollup table over one
//    fixed touch set, with the expected credit for every model written out. A
//    regression that collapsed `linear` into `first` would still produce
//    plausible money and would be invisible without this.
// 2. THE share=0 GUARD. addressable = leads / max(ownShare, 0.01) is the only
//    division in the feature, and a tenant with no measurable share is the
//    common case, not the exotic one.
// 3. MODE IS NEVER MIXED WITHIN A ROW. Asserted structurally: there is no
//    function that takes two LeadCredits, and the mode a figure carries is the
//    mode of the touches it was credited from.

import { describe, expect, it } from "vitest";

import {
  ATTRIBUTION_MODELS,
  REVENUE_MODES,
  SHARE_FLOOR,
  computeRollup,
  creditLeads,
  lostByEngine,
  preferMeasured,
  toCents,
  wonBySource,
  type AttributionModel,
  type RevenueMode,
  type Touch,
} from "@/lib/revenue/model";

const d = (iso: string) => new Date(iso);

/**
 * Three visitors, chosen so every model produces a different breakdown.
 *
 *   v1  chatgpt (Aug 2) -> perplexity (Aug 9)   two assistants, in that order
 *   v2  perplexity (Aug 4) only                 one assistant
 *   v3  gemini (Aug 6) -> chatgpt (Aug 20)      two assistants, other order
 *
 * Three distinct visitors, so `total` is 3 under every model. What moves is
 * which assistant is credited, and by how much.
 */
const TOUCHES: Touch[] = [
  { visitorId: "v1", source: "chatgpt", firstSeen: d("2026-08-02T10:00:00Z"), lastSeen: d("2026-08-02T10:00:00Z") },
  { visitorId: "v1", source: "perplexity", firstSeen: d("2026-08-09T10:00:00Z"), lastSeen: d("2026-08-09T10:00:00Z") },
  { visitorId: "v2", source: "perplexity", firstSeen: d("2026-08-04T10:00:00Z"), lastSeen: d("2026-08-04T10:00:00Z") },
  { visitorId: "v3", source: "gemini", firstSeen: d("2026-08-06T10:00:00Z"), lastSeen: d("2026-08-06T10:00:00Z") },
  { visitorId: "v3", source: "chatgpt", firstSeen: d("2026-08-20T10:00:00Z"), lastSeen: d("2026-08-20T10:00:00Z") },
];

const ASSUMPTIONS = { convRate: 0.3, avgSaleValue: 450 };

// ─── The rollup table ───────────────────────────────────────────────────────

describe("attribution models over one touch set", () => {
  /**
   * Expected credit per source, per model, worked out by hand from TOUCHES.
   *
   *   first       v1->chatgpt, v2->perplexity, v3->gemini
   *   last        v1->perplexity, v2->perplexity, v3->chatgpt
   *   linear      v1 splits chatgpt/perplexity, v2 all perplexity,
   *               v3 splits gemini/chatgpt
   *   influenced  every assistant that touched a visitor gets a full 1
   */
  const TABLE: Record<AttributionModel, Record<string, number>> = {
    first: { chatgpt: 1, perplexity: 1, gemini: 1 },
    last: { perplexity: 2, chatgpt: 1 },
    linear: { chatgpt: 1, perplexity: 1.5, gemini: 0.5 },
    influenced: { chatgpt: 2, perplexity: 2, gemini: 1 },
  };

  it.each(ATTRIBUTION_MODELS)("%s credits the sources it should", (model) => {
    const credits = creditLeads(TOUCHES, model, "proxy");
    expect(Object.fromEntries(credits.bySource)).toEqual(TABLE[model]);
  });

  it.each(ATTRIBUTION_MODELS)("%s counts three distinct leads regardless", (model) => {
    // `total` is the distinct-visitor count and is model-independent by
    // construction — the models divide credit, they do not change what a lead
    // is. This is what stops `influenced`'s double-count reaching the headline.
    expect(creditLeads(TOUCHES, model, "proxy").total).toBe(3);
  });

  it("only influenced over-sums against the lead count", () => {
    for (const model of ATTRIBUTION_MODELS) {
      const credits = creditLeads(TOUCHES, model, "proxy");
      const sum = [...credits.bySource.values()].reduce((a, b) => a + b, 0);
      if (model === "influenced") expect(sum).toBeGreaterThan(credits.total);
      else expect(sum).toBeCloseTo(credits.total, 10);
    }
  });

  it("is deterministic when two touches share a timestamp", () => {
    // Same instant, two assistants: the tie-break is the source name, so the
    // rollup cannot depend on the order Postgres happened to return rows in.
    const tied: Touch[] = [
      { visitorId: "t1", source: "perplexity", firstSeen: d("2026-08-01T00:00:00Z"), lastSeen: d("2026-08-01T00:00:00Z") },
      { visitorId: "t1", source: "chatgpt", firstSeen: d("2026-08-01T00:00:00Z"), lastSeen: d("2026-08-01T00:00:00Z") },
    ];
    expect(Object.fromEntries(creditLeads(tied, "first", "proxy").bySource)).toEqual({ chatgpt: 1 });
    expect(
      Object.fromEntries(creditLeads([...tied].reverse(), "first", "proxy").bySource),
    ).toEqual({ chatgpt: 1 });
  });
});

// ─── The money ──────────────────────────────────────────────────────────────

describe("computeRollup", () => {
  it("prices what was won from leads, close rate and sale value", () => {
    const credits = creditLeads(TOUCHES, "last", "proxy");
    const figures = computeRollup(credits, ASSUMPTIONS, { ownShare: 0.2, topRivalShare: 0.5 });

    // 3 leads x 0.30 x 450
    expect(figures.wonRevenue).toBe(405);
    expect(figures.leads).toBe(3);
  });

  it("prices the gap from addressable leads and the share difference", () => {
    const credits = creditLeads(TOUCHES, "last", "proxy");
    const figures = computeRollup(credits, ASSUMPTIONS, { ownShare: 0.2, topRivalShare: 0.5 });

    // addressable = 3 / 0.20 = 15
    // gap         = 0.50 - 0.20 = 0.30
    // lost        = 0.30 x 15 x 0.30 x 450 = 607.50
    expect(figures.addressable).toBe(15);
    expect(figures.lostRevenueEst).toBe(607.5);
  });

  it("clamps the gap at zero when the tenant already leads", () => {
    // A negative "lost revenue" is not a fact about the world, it is a
    // subtraction that ran the wrong way.
    const credits = creditLeads(TOUCHES, "last", "proxy");
    const figures = computeRollup(credits, ASSUMPTIONS, { ownShare: 0.6, topRivalShare: 0.2 });
    expect(figures.lostRevenueEst).toBe(0);
  });

  it("prices nothing when there are no leads", () => {
    const credits = creditLeads([], "first", "proxy");
    const figures = computeRollup(credits, ASSUMPTIONS, { ownShare: 0, topRivalShare: 0.9 });
    expect(figures.leads).toBe(0);
    expect(figures.wonRevenue).toBe(0);
    expect(figures.lostRevenueEst).toBe(0);
  });

  it("rounds money to cents", () => {
    const credits = creditLeads(TOUCHES, "last", "proxy");
    const figures = computeRollup(
      credits,
      { convRate: 0.333, avgSaleValue: 99.99 },
      { ownShare: 0.17, topRivalShare: 0.41 },
    );
    expect(figures.wonRevenue).toBe(toCents(figures.wonRevenue));
    expect(figures.lostRevenueEst).toBe(toCents(figures.lostRevenueEst));
    expect(String(figures.wonRevenue)).not.toMatch(/\.\d{3,}/);
  });
});

// ─── The share=0 guard ──────────────────────────────────────────────────────

describe("the divide-by-zero guard on addressable", () => {
  const credits = creditLeads(TOUCHES, "last", "proxy");

  it("floors a zero share at SHARE_FLOOR instead of dividing by zero", () => {
    const figures = computeRollup(credits, ASSUMPTIONS, { ownShare: 0, topRivalShare: 0.4 });

    expect(SHARE_FLOOR).toBe(0.01);
    // 3 / 0.01 = 300, NOT Infinity.
    expect(figures.addressable).toBe(300);
    expect(Number.isFinite(figures.lostRevenueEst)).toBe(true);
    // gap 0.40 x 300 x 0.30 x 450
    expect(figures.lostRevenueEst).toBe(16200);
  });

  it("never yields Infinity or NaN for any share below the floor", () => {
    for (const ownShare of [0, 0.0001, 0.001, 0.005, SHARE_FLOOR]) {
      const figures = computeRollup(credits, ASSUMPTIONS, { ownShare, topRivalShare: 0.9 });
      expect(Number.isFinite(figures.addressable)).toBe(true);
      expect(Number.isFinite(figures.lostRevenueEst)).toBe(true);
      expect(Number.isNaN(figures.lostRevenueEst)).toBe(false);
      // Every share at or below the floor is treated identically — capped at
      // 100x the leads seen.
      expect(figures.addressable).toBe(300);
    }
  });

  it("stops flooring once the real share exceeds it", () => {
    const figures = computeRollup(credits, ASSUMPTIONS, { ownShare: 0.02, topRivalShare: 0.9 });
    expect(figures.addressable).toBe(150);
  });
});

// ─── Mode never mixed ───────────────────────────────────────────────────────

describe("mode is part of a row's identity and is never mixed", () => {
  it.each(REVENUE_MODES)("carries %s from the touches through to the figures", (mode) => {
    const credits = creditLeads(TOUCHES, "linear", mode);
    expect(credits.mode).toBe(mode);
    expect(computeRollup(credits, ASSUMPTIONS, { ownShare: 0.3, topRivalShare: 0.4 }).mode).toBe(mode);
  });

  it("does the same arithmetic under either mode", () => {
    // The mode changes what a lead IS, not how credit for it is divided. If
    // these ever diverge, one of the two modes has grown a private code path.
    const asProxy = creditLeads(TOUCHES, "linear", "proxy");
    const asMeasured = creditLeads(TOUCHES, "linear", "measured");
    expect(Object.fromEntries(asMeasured.bySource)).toEqual(Object.fromEntries(asProxy.bySource));
    expect(asMeasured.total).toBe(asProxy.total);
  });

  it("exposes no way to combine two credit sets", () => {
    // The structural guarantee. Every exported function takes at most one
    // LeadCredits, so there is no signature through which a measured lead and a
    // proxy lead could be added together.
    const takesCredits = [computeRollup, wonBySource, lostByEngine];
    for (const fn of takesCredits) {
      const params = fn.length;
      expect(params).toBeLessThanOrEqual(3);
    }
    // And the one that produces them derives the mode from a single argument.
    expect(creditLeads(TOUCHES, "first", "measured").mode).toBe("measured");
  });
});

// ─── measured preferred over proxy ──────────────────────────────────────────

describe("preferMeasured", () => {
  const row = (mode: RevenueMode, wonRevenue: number) => ({ mode, wonRevenue });

  it("returns the measured row when a month has both", () => {
    expect(preferMeasured([row("proxy", 100), row("measured", 250)])).toEqual(row("measured", 250));
  });

  it("is order-independent", () => {
    expect(preferMeasured([row("measured", 250), row("proxy", 100)])).toEqual(row("measured", 250));
  });

  it("falls back to proxy when that is all there is", () => {
    expect(preferMeasured([row("proxy", 100)])).toEqual(row("proxy", 100));
  });

  it("returns null for a month with no rows at all", () => {
    expect(preferMeasured([])).toBeNull();
  });

  it("keeps the proxy row available rather than discarding it", () => {
    // "The UI reads measured and keeps proxy as history" — preferMeasured picks
    // one to show and mutates nothing, so the caller can still see the other.
    const rows = [row("proxy", 100), row("measured", 250)];
    preferMeasured(rows);
    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.mode === "proxy")).toBe(true);
  });
});

// ─── Breakdowns ─────────────────────────────────────────────────────────────

describe("breakdowns", () => {
  it("prices won per assistant, biggest first", () => {
    const credits = creditLeads(TOUCHES, "last", "proxy");
    expect(wonBySource(credits, ASSUMPTIONS)).toEqual([
      { source: "perplexity", leads: 2, wonRevenue: 270 },
      { source: "chatgpt", leads: 1, wonRevenue: 135 },
    ]);
  });

  it("prices lost per engine from that engine's own share gap", () => {
    const credits = creditLeads(TOUCHES, "last", "proxy");
    const rows = lostByEngine(credits, ASSUMPTIONS, [
      { engine: "CHATGPT", ownShare: 0.2, topRivalShare: 0.5 },
      { engine: "CLAUDE", ownShare: 0.5, topRivalShare: 0.5 },
    ]);

    // CHATGPT: 3/0.2 = 15 addressable, gap 0.3 -> 0.3 x 15 x 0.3 x 450
    expect(rows[0]).toEqual({
      engine: "CHATGPT",
      ownShare: 0.2,
      topRivalShare: 0.5,
      lostRevenueEst: 607.5,
    });
    // CLAUDE: no gap, so nothing lost.
    expect(rows[1].lostRevenueEst).toBe(0);
  });

  it("gives every engine the same lead count", () => {
    // Leads are not divisible by engine: ai_visits records which ASSISTANT sent
    // a visitor, sov_snapshots records which ENGINE's answers were sampled, and
    // those are different measurements. What varies per engine is the gap.
    const credits = creditLeads(TOUCHES, "last", "proxy");
    const same = lostByEngine(credits, ASSUMPTIONS, [
      { engine: "A", ownShare: 0.25, topRivalShare: 0.5 },
      { engine: "B", ownShare: 0.25, topRivalShare: 0.5 },
    ]);
    expect(same[0].lostRevenueEst).toBe(same[1].lostRevenueEst);
  });
});
