// tests/keyword-opportunity-score.test.ts
//
// The Opportunity Score, the severity ladder, and the invariant that the
// AcmeCRM demo is scored by the same code as production.

import { describe, expect, it } from "vitest";
import {
  AI_TESTED_KEYWORD_LIMIT,
  CPC_CEILING_USD,
  DEFAULT_INTENT_SCORE,
  HIGH_SEVERITY_MIN_SCORE,
  MEDIUM_SEVERITY_MIN_SCORE,
  OPPORTUNITY_SCORE_VERSION,
  OPPORTUNITY_WEIGHTS_V1,
  VOLUME_CEILING,
  aiGapScore,
  clampScore,
  computeOpportunityScore,
  cpcScore,
  intentScore,
  preAiScore,
  scoreOpportunity,
  selectAiTestKeywords,
  seoGapScore,
  severityFor,
  trendScore,
  volumeScore,
  type AiEvidence,
  type OpportunityInput,
} from "@/lib/keyword-opportunity/score";
import {
  ACCELERATION_CLAMP_POINTS,
  COMPETITION_FLOOR,
  CONFIDENCE_HIGH_MIN,
  CONFIDENCE_MEDIUM_MIN,
  MIN_FACTOR,
  PILLAR_KEYS,
  SUBFACTOR_KEYS,
  SUBFACTOR_PILLAR,
  V2_PILLAR_WEIGHTS,
  V2_SEVERITY_CUTS,
  V2_SUBFACTOR_SOURCES,
  V2_SUBFACTOR_WEIGHTS,
  assertV2WeightsSumToOne,
  brandAiAbsenceFactor,
  clampFactor,
  competitorValidationFactor,
  composeScore,
  computeOpportunityDetailV2,
  confidenceFor,
  coverageFor,
  momentumFactors,
  reasonableCompetitionFactor,
  recommendationGapFactor,
  severityForV2,
  weightedGeomean,
  type SubfactorKey,
} from "@/lib/keyword-opportunity/score-v2";
import {
  DEMO_ALIASES,
  DEMO_ANALYSIS,
  DEMO_BRAND_NAME,
  DEMO_KEYWORD_INPUTS,
} from "@/lib/keyword-opportunity/fixtures";
import { withoutBrandNamedPrompts } from "@/lib/keyword-opportunity/prompts";
import { recommendedActions } from "@/lib/keyword-opportunity/recommendations";
import { cacheKeyFor, fundingFor } from "@/lib/keyword-opportunity/entitlement";
import { KEYWORD_OPPORTUNITY_COPY } from "@/lib/i18n/dashboard";
import type { AnalysisEntitlement } from "@/lib/keyword-opportunity/types";

const MENTIONED_FIRST: AiEvidence = {
  mentioned: true,
  visibilityScore: 100,
  mentionRate: 1,
  averagePosition: 1,
};

const NOT_MENTIONED: AiEvidence = {
  mentioned: false,
  visibilityScore: null,
  mentionRate: 0,
  averagePosition: null,
};

function input(overrides: Partial<OpportunityInput> = {}): OpportunityInput {
  return {
    keyword: "test keyword",
    monthlyVolume: 1000,
    cpcUsd: 10,
    competition: 0.5,
    trendPercent: 0,
    googleRank: null,
    intent: "commercial_investigation",
    ai: null,
    ...overrides,
  };
}

describe("weights", () => {
  it("sum to exactly 1, so a fully-measured keyword needs no renormalisation", () => {
    const total = Object.values(OPPORTUNITY_WEIGHTS_V1).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("clampScore", () => {
  it("floors at 0 and caps at 100", () => {
    expect(clampScore(-40)).toBe(0);
    expect(clampScore(140)).toBe(100);
    expect(clampScore(55)).toBe(55);
  });

  it("maps NaN to 0 but clamps an infinity to the bound it ran past", () => {
    expect(clampScore(Number.NaN)).toBe(0);
    expect(clampScore(Number.POSITIVE_INFINITY)).toBe(100);
    expect(clampScore(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe("volumeScore", () => {
  it("is 0 at or below zero volume, and saturates at the ceiling", () => {
    expect(volumeScore(0)).toBe(0);
    expect(volumeScore(-5)).toBe(0);
    expect(volumeScore(VOLUME_CEILING)).toBeCloseTo(100, 6);
    expect(volumeScore(VOLUME_CEILING * 10)).toBe(100);
  });

  it("is log-shaped: equal ratios move the score by equal amounts", () => {
    // The defining property. A tenfold jump is worth the same wherever it
    // happens, which is what stops the head terms owning the whole range.
    const low = volumeScore(1000) - volumeScore(100);
    const high = volumeScore(50_000) - volumeScore(5_000);
    expect(Math.abs(low - high)).toBeLessThan(1);
  });

  it("gives the low end far more range than a linear scale would", () => {
    // 1,000 searches a month is a real keyword. On a linear scale against a
    // 50,000 ceiling it would score 2 and be indistinguishable from noise.
    expect(volumeScore(1000)).toBeGreaterThan(60);
    expect((100 * 1000) / VOLUME_CEILING).toBeLessThan(5);
  });

  it("rises monotonically", () => {
    const points = [10, 100, 1_000, 10_000, 40_000];
    const scores = points.map(volumeScore);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
  });
});

describe("cpcScore", () => {
  it("is linear to the ceiling and clamps past it", () => {
    expect(cpcScore(0)).toBe(0);
    expect(cpcScore(CPC_CEILING_USD / 2)).toBeCloseTo(50, 6);
    expect(cpcScore(CPC_CEILING_USD)).toBe(100);
    expect(cpcScore(CPC_CEILING_USD * 3)).toBe(100);
  });
});

describe("trendScore", () => {
  it("clamps at both bounds", () => {
    expect(trendScore(-50)).toBe(0);
    expect(trendScore(-500)).toBe(0);
    expect(trendScore(100)).toBe(100);
    expect(trendScore(1000)).toBe(100);
  });

  it("puts a flat keyword below the midpoint, because the range is asymmetric", () => {
    // Deliberate: -50..+100 normalised onto 0..100 puts 0% growth at 33, not
    // 50. Demand merely holding steady is not half an opportunity.
    expect(trendScore(0)).toBeCloseTo(100 / 3, 6);
  });

  it("is 0 for a non-finite trend rather than NaN", () => {
    expect(trendScore(Number.NaN)).toBe(0);
  });
});

describe("intentScore", () => {
  it("scores every named class", () => {
    expect(intentScore("transactional")).toBe(100);
    expect(intentScore("commercial_investigation")).toBe(95);
    expect(intentScore("product_comparison")).toBe(90);
    expect(intentScore("solution_seeking")).toBe(80);
  });

  it("falls back to the default for informational and for anything unknown", () => {
    expect(intentScore("informational")).toBe(DEFAULT_INTENT_SCORE);
    expect(intentScore("navigational")).toBe(DEFAULT_INTENT_SCORE);
    expect(intentScore("")).toBe(DEFAULT_INTENT_SCORE);
  });
});

describe("seoGapScore", () => {
  it("covers every band, including both sides of each boundary", () => {
    expect(seoGapScore(null)).toBe(100);

    expect(seoGapScore(51)).toBe(95);
    expect(seoGapScore(100)).toBe(95);

    expect(seoGapScore(50)).toBe(85);
    expect(seoGapScore(21)).toBe(85);

    expect(seoGapScore(20)).toBe(65);
    expect(seoGapScore(11)).toBe(65);

    expect(seoGapScore(10)).toBe(40);
    expect(seoGapScore(4)).toBe(40);

    expect(seoGapScore(3)).toBe(15);
    expect(seoGapScore(1)).toBe(15);
  });

  it("never zeroes out a top-three rank — the AI gap can still be the story", () => {
    expect(seoGapScore(1)).toBeGreaterThan(0);
  });
});

describe("aiGapScore", () => {
  it("is 100 when the brand was not mentioned", () => {
    expect(aiGapScore(NOT_MENTIONED)).toBe(100);
  });

  it("is 100 minus visibility when it was", () => {
    expect(aiGapScore(MENTIONED_FIRST)).toBe(0);
    expect(aiGapScore({ ...MENTIONED_FIRST, visibilityScore: 25 })).toBe(75);
  });

  it("treats mentioned-but-unranked as no visibility, not as no evidence", () => {
    expect(aiGapScore({ ...MENTIONED_FIRST, visibilityScore: null, averagePosition: null })).toBe(
      100,
    );
  });

  it("is null — not 0, not 100 — when the keyword was never tested", () => {
    expect(aiGapScore(null)).toBeNull();
  });
});

describe("computeOpportunityScore", () => {
  it("weights the six components as specified", () => {
    const scored = computeOpportunityScore(
      input({
        monthlyVolume: VOLUME_CEILING,
        cpcUsd: CPC_CEILING_USD,
        trendPercent: 100,
        intent: "transactional",
        googleRank: null,
        ai: NOT_MENTIONED,
      }),
    );
    expect(scored.score).toBe(100);
    expect(scored.aiTested).toBe(true);
    expect(scored.scoreVersion).toBe(OPPORTUNITY_SCORE_VERSION);
  });

  it("floors at 0 when every component does", () => {
    const scored = computeOpportunityScore(
      input({
        monthlyVolume: 0,
        cpcUsd: 0,
        trendPercent: -100,
        intent: "informational",
        googleRank: 1,
        ai: MENTIONED_FIRST,
      }),
    );
    // intent 40 and seoGap 15 are the only non-zero components; both are
    // floors of their own tables, so the result is small but not zero.
    expect(scored.score).toBe(Math.round(0.15 * 40 + 0.1 * 15));
  });

  it("renormalises over the measured weights when the keyword was not AI-tested", () => {
    const untested = input({ ai: null });
    const scored = computeOpportunityScore(untested, 1);

    expect(scored.components.aiGap).toBeNull();
    expect(scored.aiTested).toBe(false);

    const { volume, cpc, trend, intent, seoGap } = scored.components;
    const weighted =
      OPPORTUNITY_WEIGHTS_V1.volume * volume +
      OPPORTUNITY_WEIGHTS_V1.cpc * cpc +
      OPPORTUNITY_WEIGHTS_V1.trend * trend +
      OPPORTUNITY_WEIGHTS_V1.intent * intent +
      OPPORTUNITY_WEIGHTS_V1.seoGap * seoGap;
    const measuredWeight = 1 - OPPORTUNITY_WEIGHTS_V1.aiGap;

    expect(scored.score).toBe(Math.round(weighted / measuredWeight));
  });

  it("does not silently score an untested keyword as if nobody mentioned it", () => {
    const base = input({ monthlyVolume: 5000, cpcUsd: 20, trendPercent: 10 });
    const untested = computeOpportunityScore({ ...base, ai: null }).score;
    const absent = computeOpportunityScore({ ...base, ai: NOT_MENTIONED }).score;
    expect(untested).not.toBe(absent);
  });

  it("throws on an unknown score version rather than guessing", () => {
    expect(() => computeOpportunityScore(input(), 3)).toThrow(/unknown opportunity score version/);
    expect(() => computeOpportunityScore(input(), 0)).toThrow(/unknown opportunity score version/);
  });

  it("keeps version 1 callable and reachable, so stored rows are not restated", () => {
    // The whole point of the version regime. A v1 row re-derived today must
    // produce the number the customer was shown, not today's formula's.
    const keyword = input({ ai: NOT_MENTIONED });
    const v1 = computeOpportunityScore(keyword, 1);
    const v2 = computeOpportunityScore(keyword, 2);

    expect(v1.scoreVersion).toBe(1);
    expect(v1.detail).toBeNull();
    expect(v2.scoreVersion).toBe(2);
    expect(v2.detail).not.toBeNull();
    // The default is v2 — what a NEW run computes.
    expect(computeOpportunityScore(keyword).scoreVersion).toBe(OPPORTUNITY_SCORE_VERSION);
    expect(OPPORTUNITY_SCORE_VERSION).toBe(2);
  });
});

describe("severityFor", () => {
  it("is HIGH only when the brand is absent AND the score clears the bar", () => {
    expect(severityFor(HIGH_SEVERITY_MIN_SCORE, NOT_MENTIONED)).toBe("HIGH");
    expect(severityFor(100, NOT_MENTIONED)).toBe("HIGH");
  });

  it("refuses HIGH to a mentioned brand however well it scores", () => {
    expect(severityFor(100, MENTIONED_FIRST)).toBe("MEDIUM");
  });

  it("refuses HIGH to an untested keyword — absence of evidence is not evidence", () => {
    expect(severityFor(100, null)).toBe("MEDIUM");
  });

  it("is MEDIUM at the medium bar and LOW below it", () => {
    expect(severityFor(MEDIUM_SEVERITY_MIN_SCORE, NOT_MENTIONED)).toBe("MEDIUM");
    expect(severityFor(MEDIUM_SEVERITY_MIN_SCORE - 1, NOT_MENTIONED)).toBe("LOW");
    expect(severityFor(0, null)).toBe("LOW");
  });

  it("is MEDIUM just below the high bar even with the brand absent", () => {
    expect(severityFor(HIGH_SEVERITY_MIN_SCORE - 1, NOT_MENTIONED)).toBe("MEDIUM");
  });
});

describe("selectAiTestKeywords", () => {
  it("takes the top N by pre-AI score", () => {
    const inputs = [
      input({ keyword: "low", monthlyVolume: 10, cpcUsd: 1, intent: "informational" }),
      input({ keyword: "high", monthlyVolume: 40_000, cpcUsd: 45, intent: "transactional" }),
    ];
    expect(selectAiTestKeywords(inputs, 1).map((i) => i.keyword)).toEqual(["high"]);
  });

  it("ignores AI evidence, so the cut cannot depend on what it allocates", () => {
    const base = input({ keyword: "k", monthlyVolume: 5000 });
    expect(preAiScore({ ...base, ai: NOT_MENTIONED })).toBe(preAiScore({ ...base, ai: null }));
  });

  it("breaks ties on the keyword so the same fifteen are chosen every run", () => {
    const inputs = [input({ keyword: "beta" }), input({ keyword: "alpha" })];
    expect(selectAiTestKeywords(inputs, 2).map((i) => i.keyword)).toEqual(["alpha", "beta"]);
  });

  it("returns nothing for a non-positive limit", () => {
    expect(selectAiTestKeywords([input()], 0)).toEqual([]);
    expect(selectAiTestKeywords([input()], -3)).toEqual([]);
  });
});

describe("the brand-naming filter", () => {
  it("drops a prompt naming the brand, whole-word and accent-folded", () => {
    const { kept, dropped } = withoutBrandNamedPrompts(
      [
        { text: "what's the best CRM for a twelve-person startup?" },
        { text: "is AcmeCRM any good for agencies?" },
        { text: "how does Acme CRM compare on price?" },
      ],
      [...DEMO_ALIASES],
    );
    expect(kept.map((k) => k.text)).toEqual([
      "what's the best CRM for a twelve-person startup?",
    ]);
    expect(dropped).toHaveLength(2);
  });

  it("does not drop an innocent prompt that merely contains the letters", () => {
    const { kept } = withoutBrandNamedPrompts([{ text: "which CRM works in Canada?" }], ["Ada"]);
    expect(kept).toHaveLength(1);
  });

  it("refuses the whole batch when no alias was supplied", () => {
    // A brand with no name is a caller bug, and the one gate that must not be
    // optional cannot be opened by passing nothing.
    const { kept, dropped } = withoutBrandNamedPrompts([{ text: "best CRM for startups?" }], []);
    expect(kept).toHaveLength(0);
    expect(dropped).toHaveLength(1);
  });

  it("has no BRAND_AWARENESS exemption — every keyword-derived prompt is filtered", () => {
    const { kept } = withoutBrandNamedPrompts([{ text: "what is AcmeCRM?" }], [DEMO_BRAND_NAME]);
    expect(kept).toHaveLength(0);
  });
});

describe("recommendedActions", () => {
  it("offers a landing page when there is no rank worth defending", () => {
    expect(
      recommendedActions({
        googleRank: null,
        intent: "solution_seeking",
        aiTested: false,
        aiMentioned: null,
        rivalsInAnswer: 0,
      }),
    ).toEqual(["landing_page", "rerun"]);
  });

  it("does not offer one when the page already ranks well", () => {
    const actions = recommendedActions({
      googleRank: 4,
      intent: "solution_seeking",
      aiTested: true,
      aiMentioned: true,
      rivalsInAnswer: 0,
    });
    expect(actions).not.toContain("landing_page");
  });

  it("offers citations only when the answer was bought and omitted the brand", () => {
    const absent = recommendedActions({
      googleRank: 30,
      intent: "transactional",
      aiTested: true,
      aiMentioned: false,
      rivalsInAnswer: 2,
    });
    expect(absent).toContain("external_citations");

    const untested = recommendedActions({
      googleRank: 30,
      intent: "transactional",
      aiTested: false,
      aiMentioned: null,
      rivalsInAnswer: 0,
    });
    expect(untested).not.toContain("external_citations");
  });

  it("always ends with a re-run", () => {
    const actions = recommendedActions({
      googleRank: 1,
      intent: "informational",
      aiTested: false,
      aiMentioned: null,
      rivalsInAnswer: 0,
    });
    expect(actions.at(-1)).toBe("rerun");
  });
});

describe("entitlement", () => {
  const base: AnalysisEntitlement = {
    allowanceTotal: 5,
    allowanceUsed: 2,
    allowanceRemaining: 3,
    credits: 4,
    cacheHit: false,
  };

  it("charges a cache hit nothing at all", () => {
    const decision = fundingFor({ ...base, cacheHit: true });
    expect(decision.funding).toBe("cache");
    expect(decision.canRun).toBe(true);
    expect(decision.allowanceAfter).toBe(3);
    expect(decision.creditsAfter).toBe(4);
  });

  it("spends the perishable allowance before the prepaid credits", () => {
    const decision = fundingFor(base);
    expect(decision.funding).toBe("allowance");
    expect(decision.allowanceAfter).toBe(2);
    expect(decision.creditsAfter).toBe(4);
  });

  it("falls through to credits only once the allowance is gone", () => {
    const decision = fundingFor({ ...base, allowanceRemaining: 0 });
    expect(decision.funding).toBe("credits");
    expect(decision.creditsAfter).toBe(3);
  });

  it("denies the run with no allowance and no credits", () => {
    const decision = fundingFor({ ...base, allowanceRemaining: 0, credits: 0 });
    expect(decision.funding).toBe("denied");
    expect(decision.canRun).toBe(false);
  });

  it("treats a null allowance as unlimited rather than as zero", () => {
    const decision = fundingFor({ ...base, allowanceTotal: null, allowanceRemaining: null });
    expect(decision.funding).toBe("allowance");
    expect(decision.allowanceAfter).toBeNull();
  });

  it("keys the cache on domain and UTC day, case-folded", () => {
    const day = new Date("2026-08-17T23:59:00.000Z");
    expect(cacheKeyFor("AcmeCRM.com", day)).toBe("acmecrm.com:2026-08-17");
    expect(cacheKeyFor("acmecrm.com", new Date("2026-08-18T00:01:00.000Z"))).toBe(
      "acmecrm.com:2026-08-18",
    );
  });
});

// ── VERSION 2 ───────────────────────────────────────────────────────────────

/** Every subfactor at one value, for the composition properties. */
function uniformSubfactors(value: number | null): Record<SubfactorKey, number | null> {
  return Object.fromEntries(SUBFACTOR_KEYS.map((key) => [key, value])) as Record<
    SubfactorKey,
    number | null
  >;
}

function subfactorsWith(
  overrides: Partial<Record<SubfactorKey, number | null>>,
  base = 0.5,
): Record<SubfactorKey, number | null> {
  return { ...uniformSubfactors(base), ...overrides };
}

describe("v2 weights", () => {
  it("sum to 1 at BOTH levels, over the full factor set", () => {
    expect(() => assertV2WeightsSumToOne()).not.toThrow();

    // Asserted again here rather than only inside the helper, so a reader can
    // see the two sums and a future edit to the helper cannot quietly weaken
    // the check it is the only witness to.
    expect(PILLAR_KEYS.reduce((a, k) => a + V2_PILLAR_WEIGHTS[k], 0)).toBeCloseTo(1, 12);
    for (const pillar of PILLAR_KEYS) {
      const sum = SUBFACTOR_KEYS.filter((k) => SUBFACTOR_PILLAR[k] === pillar).reduce(
        (a, k) => a + V2_SUBFACTOR_WEIGHTS[k],
        0,
      );
      expect(sum).toBeCloseTo(1, 12);
    }
  });

  it("covers every subfactor exactly once, in exactly one pillar", () => {
    expect(SUBFACTOR_KEYS).toHaveLength(14);
    expect(new Set(SUBFACTOR_KEYS).size).toBe(14);
    for (const key of SUBFACTOR_KEYS) {
      expect(PILLAR_KEYS).toContain(SUBFACTOR_PILLAR[key]);
    }
  });
});

describe("the weighted geometric mean", () => {
  it("returns the uniform value when every factor agrees, at both levels", () => {
    // THE EXPONENT-SUM CHECK. exp(Σ w·ln f / Σ w) with every f equal is f
    // exactly, whatever the weights are — at the subfactor level, and then
    // again over four identical pillars. Anything else means a weight table
    // that does not sum to 1 or a renormalisation applied twice.
    const { pillars, rawScore } = composeScore(uniformSubfactors(0.7));
    for (const pillar of PILLAR_KEYS) {
      expect(pillars[pillar].value).toBeCloseTo(0.7, 12);
      expect(pillars[pillar].measuredWeight).toBeCloseTo(1, 12);
    }
    expect(rawScore).toBeCloseTo(70, 10);
    expect(Math.round(rawScore)).toBe(70);
  });

  it("is a product, so a weak factor is punished rather than paid for", () => {
    // The difference from v1 in one assertion: a factor at the floor cannot be
    // bought back by perfect scores everywhere else.
    const strong = composeScore(uniformSubfactors(1)).rawScore;
    const oneDead = composeScore(subfactorsWith({ brandAiAbsence: MIN_FACTOR }, 1)).rawScore;
    expect(strong).toBeCloseTo(100, 10);
    expect(oneDead).toBeLessThan(75);
  });

  it("renormalises a null over the remaining weights INSIDE its pillar", () => {
    // clickstreamValidation is 0.20 of DEMAND. Dropping it must leave DEMAND
    // as the geomean of the other two at 0.45/0.35 renormalised, and must not
    // move any other pillar at all.
    const full = composeScore(subfactorsWith({ searchVolume: 0.9, commercialIntent: 0.4 }));
    const dropped = composeScore(
      subfactorsWith({ searchVolume: 0.9, commercialIntent: 0.4, clickstreamValidation: null }),
    );

    const expected = Math.exp(
      (0.45 * Math.log(0.9) + 0.35 * Math.log(0.4)) / (0.45 + 0.35),
    );
    expect(dropped.pillars.demand.value).toBeCloseTo(expected, 12);
    expect(dropped.pillars.demand.measuredWeight).toBeCloseTo(0.8, 12);

    // The weight went nowhere else.
    for (const pillar of ["momentum", "visibilityGap", "winnability"] as const) {
      expect(dropped.pillars[pillar].value).toBeCloseTo(full.pillars[pillar].value ?? 0, 12);
    }
  });

  it("omitting a factor is NOT the same as flooring it", () => {
    // The rule the whole null/zero distinction exists for. A keyword whose
    // trend we never measured must score HIGHER than one we measured and found
    // collapsing — otherwise "we did not ask" is being reported as bad news.
    const unmeasured = composeScore(subfactorsWith({ trend90d: null })).rawScore;
    const terrible = composeScore(subfactorsWith({ trend90d: MIN_FACTOR })).rawScore;
    const neutral = composeScore(subfactorsWith({})).rawScore;

    expect(unmeasured).toBeGreaterThan(terrible);
    // And it is not a reward either: dropping a factor that was going to score
    // the pillar average leaves the pillar exactly where it was.
    expect(unmeasured).toBeCloseTo(neutral, 12);
  });

  it("nulls a whole pillar when every one of its subfactors is null", () => {
    // MOMENTUM fully null is the realistic case, not a contrived one: a young
    // domain has no search history to derive a trend from. The pillar drops out
    // and its 0.20 renormalises across the other three at the top level.
    const noMomentum = subfactorsWith({ trend90d: null, trend30d: null, acceleration: null });
    const { pillars, rawScore } = composeScore(noMomentum);

    expect(pillars.momentum.value).toBeNull();
    expect(pillars.momentum.measuredWeight).toBe(0);
    expect(Number.isFinite(rawScore)).toBe(true);
    expect(rawScore).toBeGreaterThan(0);

    // The other three, renormalised over 0.80, are the whole score.
    const expected = Math.exp(
      (0.3 * Math.log(pillars.demand.value!) +
        0.3 * Math.log(pillars.visibilityGap.value!) +
        0.2 * Math.log(pillars.winnability.value!)) /
        0.8,
    );
    expect(rawScore).toBeCloseTo(expected * 100, 10);
  });

  it("scores 0 rather than NaN when nothing at all was measured", () => {
    const { pillars, rawScore } = composeScore(uniformSubfactors(null));
    for (const pillar of PILLAR_KEYS) expect(pillars[pillar].value).toBeNull();
    expect(rawScore).toBe(0);
    expect(Number.isNaN(rawScore)).toBe(false);
  });

  it("never takes ln(0), whatever it is handed", () => {
    // Zeroes, negatives and non-finite values all land on the floor before the
    // logarithm sees them, so no input produces -Infinity or NaN.
    for (const hostile of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const { rawScore } = composeScore(uniformSubfactors(hostile));
      expect(Number.isFinite(rawScore)).toBe(true);
    }
    const geo = weightedGeomean([{ value: 0, weight: 1 }]);
    expect(geo.value).toBeCloseTo(MIN_FACTOR, 12);
  });
});

describe("the factor floor", () => {
  it("clamps a transformed factor into [0.05, 1]", () => {
    expect(clampFactor(0)).toBe(MIN_FACTOR);
    expect(clampFactor(-5)).toBe(MIN_FACTOR);
    expect(clampFactor(Number.NaN)).toBe(MIN_FACTOR);
    expect(clampFactor(1.4)).toBe(1);
    expect(clampFactor(0.5)).toBe(0.5);
  });

  it("does NOT floor a raw zero that transforms to a maximum", () => {
    // THE CASE THE FLOOR MUST NOT TOUCH. Zero AI mentions is the best possible
    // reading of brandAiAbsence — it is the finding the product exists to make
    // — and flooring the raw count instead of the transformed factor would
    // have turned it into 0.05, the worst.
    const noMentions: AiEvidence = {
      mentioned: false,
      visibilityScore: null,
      mentionRate: 0,
      averagePosition: null,
    };
    expect(brandAiAbsenceFactor(noMentions)).toBe(1);
    expect(recommendationGapFactor(noMentions)).toBe(1);

    // It is the brand the assistant put FIRST that hits the floor.
    expect(brandAiAbsenceFactor(MENTIONED_FIRST)).toBe(MIN_FACTOR);
    expect(recommendationGapFactor(MENTIONED_FIRST)).toBe(MIN_FACTOR);
  });

  it("keeps null meaning null on every AI-derived subfactor", () => {
    expect(brandAiAbsenceFactor(null)).toBeNull();
    expect(recommendationGapFactor(null)).toBeNull();
    expect(competitorValidationFactor(null)).toBeNull();
    expect(reasonableCompetitionFactor(null)).toBeNull();
  });
});

describe("the two competition curves", () => {
  it("validates demand in buckets: nobody named is a near-veto, two or three is ideal", () => {
    expect(competitorValidationFactor(0)).toBeCloseTo(0.2, 12);
    expect(competitorValidationFactor(1)).toBeCloseTo(0.65, 12);
    expect(competitorValidationFactor(2)).toBeCloseTo(0.9, 12);
    expect(competitorValidationFactor(3)).toBeCloseTo(1, 12);
    expect(competitorValidationFactor(4)).toBeCloseTo(1, 12);
    expect(competitorValidationFactor(5)).toBeCloseTo(0.8, 12);
    expect(competitorValidationFactor(6)).toBeCloseTo(0.7, 12);
    expect(competitorValidationFactor(40)).toBeCloseTo(0.7, 12);
  });

  it("scores winnability on a continuous hump over the SAME raw count", () => {
    // floor + (1 - floor)·exp(-((n - 2.5)² / (2·2.25²)))
    expect(reasonableCompetitionFactor(2)).toBeCloseTo(0.9805, 3);
    expect(reasonableCompetitionFactor(3)).toBeCloseTo(0.9805, 3);
    expect(reasonableCompetitionFactor(2.5)).toBeCloseTo(1, 12);
    expect(reasonableCompetitionFactor(7)).toBeCloseTo(0.3083, 3);
    // Far out it decays towards the floor, and asymptotically — a twelve-rival
    // answer is still worth marginally more than nothing. (Far enough out the
    // Gaussian underflows to zero in float and the value IS the floor; that is
    // arithmetic, not a cliff in the curve.)
    expect(reasonableCompetitionFactor(12)).toBeCloseTo(COMPETITION_FLOOR, 3);
    expect(reasonableCompetitionFactor(12)!).toBeGreaterThan(COMPETITION_FLOOR);
    expect(reasonableCompetitionFactor(60)).toBe(COMPETITION_FLOOR);
  });

  it("disagrees with the validation curve at zero, which is the point of having two", () => {
    // ── A DELIBERATE DEPARTURE FROM THE BRIEF, FLAGGED HERE ──────────────────
    //
    // The brief's sanity check said count 0 -> 0.20 for this curve too. Its own
    // formula does not do that: at n=0 the Gaussian is exp(-6.25/10.125) =
    // 0.539, which the floor lifts to 0.631. The two figures cannot both be
    // right, and the formula was specified exactly while the 0.20 is also the
    // validation table's value at 0 — so it reads as a transcription of the
    // wrong curve. The formula is implemented as written; awaiting a ruling.
    expect(reasonableCompetitionFactor(0)).toBeCloseTo(0.6315, 3);
    expect(competitorValidationFactor(0)).toBeCloseTo(0.2, 12);

    // An answer naming nobody: no demand validated, but nothing to beat either.
    expect(reasonableCompetitionFactor(0)!).toBeGreaterThan(competitorValidationFactor(0)!);
    // A crowded answer: demand is proven, winning it is not.
    expect(reasonableCompetitionFactor(7)!).toBeLessThan(competitorValidationFactor(7)!);
  });
});

describe("momentum horizons", () => {
  const history = (volumes: readonly number[]) =>
    volumes.map((search_volume, index) => ({
      year: 2025 + Math.floor(index / 12),
      month: (index % 12) + 1,
      search_volume,
    }));

  it("falls back to the derived trendPercent when no history is supplied", () => {
    // The v1-shaped input. One horizon exists, so the other two are null —
    // which is the brief's own rule for exactly this case.
    const factors = momentumFactors(24, undefined);
    expect(factors.trend90d).toBeCloseTo(trendScore(24) / 100, 12);
    expect(factors.trend30d).toBeNull();
    expect(factors.acceleration).toBeNull();
    expect(momentumFactors(24, null).trend90d).toBeCloseTo(trendScore(24) / 100, 12);
  });

  it("nulls every horizon when the history is present but too thin", () => {
    // ABSENT AND EMPTY ARE DIFFERENT. An empty history is a young domain we
    // looked at; it produces a fully-null MOMENTUM pillar rather than a flat
    // trend, because "no data yet" is not "demand is steady".
    for (const points of [[], [100], [100, 110, 120]]) {
      const factors = momentumFactors(24, history(points));
      expect(factors.trend90d).toBeNull();
      expect(factors.acceleration).toBeNull();
    }
  });

  it("derives all three from a full twelve-month history", () => {
    const rising = history([100, 105, 110, 120, 130, 140, 155, 170, 185, 205, 225, 250]);
    const factors = momentumFactors(0, rising);

    expect(factors.trend90d).not.toBeNull();
    expect(factors.trend30d).not.toBeNull();
    expect(factors.acceleration).not.toBeNull();
    // Growing, and growing faster: every horizon above its neutral point.
    expect(factors.trend90d!).toBeGreaterThan(trendScore(0) / 100);
    expect(factors.acceleration!).toBeGreaterThan(0.5);

    // A decline that is getting steeper: below neutral on both.
    const collapsing = history([250, 248, 246, 244, 240, 236, 230, 220, 205, 185, 160, 130]);
    const down = momentumFactors(0, collapsing);
    expect(down.trend90d!).toBeLessThan(factors.trend90d!);
    expect(down.acceleration!).toBeLessThan(0.5);

    // ACCELERATION IS ABOUT THE SECOND DERIVATIVE, NOT THE FIRST, and this is
    // the case that proves the two are separate subfactors: a series falling
    // steadily but by LESS each quarter is shrinking demand whose decline is
    // easing, so trend90d reads badly and acceleration reads above neutral.
    const easing = history([...rising].reverse().map((point) => point.search_volume));
    const slowing = momentumFactors(0, easing);
    expect(slowing.trend90d!).toBeLessThan(0.5);
    expect(slowing.acceleration!).toBeGreaterThan(0.5);
  });

  it("puts a steady trend at the middle of the acceleration scale", () => {
    const flat = history(Array.from({ length: 12 }, () => 500));
    const factors = momentumFactors(0, flat);
    expect(factors.acceleration).toBeCloseTo(0.5, 12);
    expect(ACCELERATION_CLAMP_POINTS).toBeGreaterThan(0);
  });
});

describe("confidence", () => {
  it("counts coverage at the subfactor level, both ways", () => {
    expect(coverageFor(uniformSubfactors(0.5), "count")).toBeCloseTo(1, 12);
    expect(coverageFor(uniformSubfactors(null), "count")).toBe(0);
    expect(coverageFor(uniformSubfactors(0.5), "weight")).toBeCloseTo(1, 12);

    // One subfactor missing is 1/14 of the count and its own share of the
    // score under "weight" — 0.30 x 0.20 = 6% for clickstreamValidation.
    const missing = subfactorsWith({ clickstreamValidation: null });
    expect(coverageFor(missing, "count")).toBeCloseTo(13 / 14, 12);
    expect(coverageFor(missing, "weight")).toBeCloseTo(1 - 0.3 * 0.2, 12);
  });

  it("maps coverage onto the three levels at the specified bars", () => {
    expect(confidenceFor(1)).toBe("HIGH");
    expect(confidenceFor(CONFIDENCE_HIGH_MIN)).toBe("HIGH");
    expect(confidenceFor(CONFIDENCE_HIGH_MIN - 0.001)).toBe("MEDIUM");
    expect(confidenceFor(CONFIDENCE_MEDIUM_MIN)).toBe("MEDIUM");
    expect(confidenceFor(CONFIDENCE_MEDIUM_MIN - 0.001)).toBe("LOW");
    expect(confidenceFor(0)).toBe("LOW");
  });

  it("gates HIGH on confidence AS WELL AS on evidence of absence", () => {
    const wellAbove = V2_SEVERITY_CUTS.high + 10;
    expect(severityForV2(wellAbove, NOT_MENTIONED, "HIGH")).toBe("HIGH");
    expect(severityForV2(wellAbove, NOT_MENTIONED, "MEDIUM")).toBe("HIGH");
    // Measured too thinly to shout about, however well it scores.
    expect(severityForV2(wellAbove, NOT_MENTIONED, "LOW")).toBe("MEDIUM");
    // v1's rule survives unchanged: absence of evidence is not evidence.
    expect(severityForV2(wellAbove, null, "HIGH")).toBe("MEDIUM");
    expect(severityForV2(wellAbove, MENTIONED_FIRST, "HIGH")).toBe("MEDIUM");
    // And the cuts govern the rest.
    expect(severityForV2(V2_SEVERITY_CUTS.medium, null, "HIGH")).toBe("MEDIUM");
    expect(severityForV2(V2_SEVERITY_CUTS.medium - 1, null, "HIGH")).toBe("LOW");
  });
});

describe("v2 monotonicity", () => {
  it("never lowers the score when a single subfactor is raised", () => {
    // Fourteen sweeps, each holding the other thirteen fixed. This is the
    // property that makes the score arguable with a customer: "your rank
    // improved and the score went down" must be impossible.
    for (const key of SUBFACTOR_KEYS) {
      let previous = -Infinity;
      for (const value of [0.05, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1]) {
        const score = composeScore(subfactorsWith({ [key]: value })).rawScore;
        expect(score).toBeGreaterThanOrEqual(previous - 1e-9);
        previous = score;
      }
    }
  });

  it("is monotone in the inputs the transforms are built from", () => {
    const base: OpportunityInput = {
      keyword: "k",
      monthlyVolume: 2000,
      cpcUsd: 10,
      competition: 0.4,
      trendPercent: 10,
      googleRank: 20,
      intent: "commercial_investigation",
      ai: NOT_MENTIONED,
      competitorCount: 2,
    };

    const raise = (o: Partial<OpportunityInput>) =>
      computeOpportunityDetailV2({ ...base, ...o }).rawScore;

    // More demand, and a worse rank (more room to gain), never score lower.
    expect(raise({ monthlyVolume: 20_000 })).toBeGreaterThan(raise({}));
    expect(raise({ googleRank: 2 })).toBeLessThan(raise({}));
    expect(raise({ trendPercent: 90 })).toBeGreaterThan(raise({}));
    // A brand the assistant already recommends first has less of an opening.
    expect(raise({ ai: MENTIONED_FIRST })).toBeLessThan(raise({}));
  });
});

describe("what v2 measures today", () => {
  it("declares exactly six subfactors as having no live source yet", () => {
    // THE HONEST LEDGER. Anything marked "unwired" must be null on every
    // fixture — a subfactor that quietly starts returning a constant is the
    // failure mode this assertion exists to catch.
    const unwired = SUBFACTOR_KEYS.filter((key) => V2_SUBFACTOR_SOURCES[key] === "unwired");
    expect(new Set(unwired)).toEqual(
      new Set([
        "clickstreamValidation",
        "trend30d",
        "acceleration",
        "citationGap",
        "contentFit",
        "authorityFit",
      ]),
    );

    for (const row of DEMO_ANALYSIS.rows) {
      for (const key of unwired) expect(row.detail?.subfactors[key]).toBeNull();
    }
  });

  it("produces a number for every live subfactor on an AI-tested keyword", () => {
    const tested = DEMO_ANALYSIS.rows.find((row) => row.aiTested);
    const live = SUBFACTOR_KEYS.filter((key) => V2_SUBFACTOR_SOURCES[key] === "live");
    expect(live).toHaveLength(8);
    for (const key of live) {
      expect(typeof tested?.detail?.subfactors[key]).toBe("number");
    }
  });

  it("keeps every AI subfactor null on a keyword nobody asked about", () => {
    const untested = DEMO_ANALYSIS.rows.find((row) => !row.aiTested);
    expect(untested?.detail?.pillars.visibilityGap.value).toBeNull();
    for (const key of [
      "brandAiAbsence",
      "competitorValidation",
      "recommendationGap",
    ] as SubfactorKey[]) {
      expect(untested?.detail?.subfactors[key]).toBeNull();
    }
    expect(untested?.competitorCount ?? null).toBeNull();
  });

  it("keeps raw and calibrated apart even while they are equal", () => {
    for (const row of DEMO_ANALYSIS.rows) {
      expect(row.detail?.calibratedScore).toBe(row.detail?.rawScore);
      expect(row.opportunityScore).toBe(Math.round(row.detail!.calibratedScore));
    }
  });

  it("puts every cutoff in one tunable config rather than in the code", () => {
    expect(V2_SEVERITY_CUTS.high).toBeGreaterThan(V2_SEVERITY_CUTS.medium);
    expect(CONFIDENCE_HIGH_MIN).toBeGreaterThan(CONFIDENCE_MEDIUM_MIN);
    // v2's HIGH cut and v1's are both 74 by coincidence, from different
    // formulas on different distributions. They are NOT the same constant and
    // must not be pointed at each other.
    expect(V2_SEVERITY_CUTS.high).not.toBe(MEDIUM_SEVERITY_MIN_SCORE);
  });
});

describe("the AcmeCRM demo is scored by the production scorer", () => {
  const rows = DEMO_ANALYSIS.rows;
  const byKeyword = new Map(rows.map((row) => [row.keyword, row]));

  it("re-scores to exactly what the fixture ships", () => {
    // THE INVARIANT THIS FILE EXISTS FOR. Every score in the demo is recomputed
    // here from the fixture's own raw inputs. If someone hardcodes a number
    // into fixtures.ts to make a screenshot look better, this fails.
    for (const row of rows) {
      const rescored = scoreOpportunity({
        keyword: row.keyword,
        monthlyVolume: row.monthlyVolume,
        cpcUsd: row.cpcUsd,
        competition: row.competition,
        trendPercent: row.trendPercent,
        googleRank: row.googleRank,
        intent: row.intent,
        ai: row.ai,
        competitorCount: row.competitorCount,
      });
      expect(rescored.opportunityScore).toBe(row.opportunityScore);
      expect(rescored.severity).toBe(row.severity);
      expect(rescored.components).toEqual(row.components);
      expect(rescored.detail).toEqual(row.detail);
    }
  });

  // ── THE THREE SPECCED KEYWORDS ────────────────────────────────────────────
  //
  // The brief asked for 94 / 82 / 76. Those three numbers are not reachable
  // under the brief's own formula, and the arithmetic is short enough to show:
  //
  //   "best CRM for startups" is fixed at rank 16 and +24% trend, so
  //   seoGapScore is 65 and trendScore is 49.33 — both pinned by tables the
  //   brief specifies exactly. Its ceiling is therefore
  //
  //     0.20(100) + 0.20(100) + 0.10(49.33) + 0.15(100) + 0.10(65) + 0.25(100)
  //       = 20 + 20 + 4.93 + 15 + 6.5 + 25 = 91.43
  //
  //   with volume, CPC and intent ALL at a perfect 100 — which would require a
  //   volume ceiling of 8,100 and a CPC ceiling of $18, at which point every
  //   richer keyword in the set saturates and the scorer stops ranking
  //   anything. 94 is above that ceiling, so no choice of normalisation
  //   constants reaches it.
  //
  // ── AND WHAT VERSION 2 DOES TO THEM ───────────────────────────────────────
  //
  // v1 scored them 75 / 68 / 73. v2 scores them 79 / 44 / 75, and the middle
  // one is the whole difference between an additive and a multiplicative
  // score: "CRM for agencies" has real demand and a rank of 7, and the
  // assistant DOES name the brand, at position 4. Under v1 that cost it the
  // aiGap component and it kept two thirds of its score. Under v2 the
  // visibility gap it does not have multiplies through everything else, and it
  // drops out of the recommendations — which is correct, because an
  // opportunity is a conjunction and this keyword is missing the conjunct the
  // product exists to find.
  //
  // NOT PINNED TO THREE INTEGERS, deliberately. The v2 figures are awaiting a
  // ruling and a number asserted here before it is ratified is a number nobody
  // chose. What IS asserted is the shape the brief was describing, which does
  // have to survive a retune: all three tested, and the keywords with a gap
  // ahead of the keyword without one.
  it("scores the three specced keywords, with the un-mentioned pair on top", () => {
    const startups = byKeyword.get("best CRM for startups");
    const agencies = byKeyword.get("CRM for agencies");
    const affordable = byKeyword.get("affordable CRM software");

    for (const row of [startups, agencies, affordable]) {
      expect(row?.aiTested).toBe(true);
      expect(row?.scoreVersion).toBe(2);
    }

    // The two the assistant never named outrank the one it did.
    expect(startups!.opportunityScore).toBeGreaterThan(agencies!.opportunityScore);
    expect(affordable!.opportunityScore).toBeGreaterThan(agencies!.opportunityScore);
    expect(startups?.severity).toBe("HIGH");
    expect(affordable?.severity).toBe("HIGH");
    expect(agencies?.severity).toBe("LOW");
  });

  it("keeps the three specced keywords inside the AI-tested fifteen", () => {
    for (const keyword of ["best CRM for startups", "CRM for agencies", "affordable CRM software"]) {
      expect(byKeyword.get(keyword)?.aiTested).toBe(true);
    }
  });

  it("carries the specced provider inputs verbatim", () => {
    const startups = byKeyword.get("best CRM for startups");
    expect(startups).toMatchObject({
      monthlyVolume: 8100,
      cpcUsd: 18,
      trendPercent: 24,
      googleRank: 16,
    });
    expect(startups?.ai?.mentioned).toBe(false);

    expect(byKeyword.get("CRM for agencies")).toMatchObject({
      monthlyVolume: 2400,
      cpcUsd: 31,
      trendPercent: 8,
      googleRank: 7,
    });
    expect(byKeyword.get("CRM for agencies")?.ai?.averagePosition).toBe(4);

    expect(byKeyword.get("affordable CRM software")).toMatchObject({
      monthlyVolume: 5600,
      cpcUsd: 14,
      trendPercent: -3,
      googleRank: 34,
    });
    expect(byKeyword.get("affordable CRM software")?.ai?.mentioned).toBe(false);
  });

  it("tests exactly the top fifteen and leaves the rest untested", () => {
    expect(rows).toHaveLength(25);
    expect(DEMO_ANALYSIS.aiTestedCount).toBe(AI_TESTED_KEYWORD_LIMIT);

    const chosen = new Set(
      selectAiTestKeywords([...DEMO_KEYWORD_INPUTS], AI_TESTED_KEYWORD_LIMIT).map((i) => i.keyword),
    );
    for (const row of rows) {
      expect(row.aiTested).toBe(chosen.has(row.keyword));
      // An untested row must carry no prompt and no answer, or the UI would
      // render a question nobody paid to ask.
      if (!row.aiTested) {
        expect(row.prompt).toBeNull();
        expect(row.result).toBeNull();
        expect(row.components.aiGap).toBeNull();
      }
    }
  });

  it("is sorted by score, descending", () => {
    const scores = rows.map((row) => row.opportunityScore);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("exercises every seoGap band", () => {
    const ranks = rows.map((row) => row.googleRank);
    expect(ranks.some((r) => r === null)).toBe(true);
    expect(ranks.some((r) => r !== null && r > 50)).toBe(true);
    expect(ranks.some((r) => r !== null && r > 20 && r <= 50)).toBe(true);
    expect(ranks.some((r) => r !== null && r > 10 && r <= 20)).toBe(true);
    expect(ranks.some((r) => r !== null && r > 3 && r <= 10)).toBe(true);
    expect(ranks.some((r) => r !== null && r <= 3)).toBe(true);
  });

  it("exercises every intent class", () => {
    const intents = new Set(rows.map((row) => row.intent));
    expect(intents).toEqual(
      new Set([
        "transactional",
        "commercial_investigation",
        "product_comparison",
        "solution_seeking",
        "informational",
      ]),
    );
  });

  it("exercises both aiGap paths and both trend clamps", () => {
    const tested = rows.filter((row) => row.aiTested);
    expect(tested.some((row) => row.ai?.mentioned === true)).toBe(true);
    expect(tested.some((row) => row.ai?.mentioned === false)).toBe(true);
    // Mentioned but never ranked: visibility 0, so the gap stays wide open.
    expect(
      tested.some((row) => row.ai?.mentioned === true && row.ai.averagePosition === null),
    ).toBe(true);

    expect(rows.some((row) => row.trendPercent < -50)).toBe(true);
    expect(rows.some((row) => row.trendPercent > 100)).toBe(true);
    expect(rows.some((row) => row.trendPercent < 0)).toBe(true);
  });

  it("produces all three severities", () => {
    const severities = new Set(rows.map((row) => row.severity));
    expect(severities).toEqual(new Set(["HIGH", "MEDIUM", "LOW"]));
  });

  it("splits into three usable bands at the shipped v2 cuts", () => {
    // THE CALIBRATION, pinned so a change to either cut has to come past a
    // number somebody chose. v1 read 11 / 7 / 7 at 74 / 60; v2 reads 11 / 8 / 6
    // at 74 / 47, and the 8 rather than 7 is not a choice — two keywords score
    // 50.909 and 51.322, so no MEDIUM cut admits one without the other. See
    // V2_SEVERITY_CUTS.
    //
    // Off a 25-keyword fixture set built to exercise branches, NOT a sampled
    // population. Same caveat v1 carried.
    const tally = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const row of rows) tally[row.severity] += 1;
    expect(tally).toEqual({ HIGH: 11, MEDIUM: 8, LOW: 6 });
  });

  it("puts the rank-16 archetype in HIGH with headroom, not by a rounding step", () => {
    // The lesson v1 wrote down: a flagship keyword that clears its cut only
    // because Math.round carried it there flips band on any drift. Under v2 it
    // scores 78.83 against a cut of 74.
    const archetype = byKeyword.get("best CRM for startups");
    expect(archetype?.severity).toBe("HIGH");
    expect(archetype?.opportunityScore).toBeGreaterThan(V2_SEVERITY_CUTS.high + 1);
  });

  it("keeps the MEDIUM explanation honest for the untested keywords it now holds", () => {
    // Lowering the floor to 60 pulled untested keywords (63, 62, 61) into
    // MEDIUM. The explanation must cover that case rather than asserting the
    // assistant already names the brand, which for an untested keyword is
    // something nobody measured.
    const untestedMedium = rows.filter(
      (row) => row.severity === "MEDIUM" && !row.aiTested,
    );
    expect(untestedMedium.length).toBeGreaterThan(0);
    for (const locale of ["en", "fr", "de-CH"] as const) {
      expect(KEYWORD_OPPORTUNITY_COPY[locale].severityMediumExplain.length).toBeGreaterThan(0);
    }
    expect(KEYWORD_OPPORTUNITY_COPY.en.severityMediumExplain).toMatch(/not have been AI-tested/i);
  });

  it("never marks an untested keyword HIGH", () => {
    for (const row of rows) {
      if (!row.aiTested) expect(row.severity).not.toBe("HIGH");
    }
  });

  it("ranks rivals by share of the answers, filtering platforms and category words", () => {
    const names = DEMO_ANALYSIS.competitors.map((c) => c.name);
    expect(names).toContain("HubSpot");
    expect(names).toContain("Pipedrive");
    expect(names).toContain("Close");
    // Dropped by the v3 classifier, not by this fixture.
    expect(names).not.toContain("Reddit");
    expect(names).not.toContain("G2");
    expect(names).not.toContain("CRM software");

    const share = (name: string) =>
      DEMO_ANALYSIS.competitors.find((c) => c.name === name)?.sharePercent ?? 0;
    expect(share("HubSpot")).toBeGreaterThan(share("Pipedrive"));
    expect(share("Pipedrive")).toBeGreaterThan(share("Close"));
  });

  it("never lets a prompt name the brand", () => {
    const prompts = rows.filter((row) => row.prompt !== null).map((row) => ({
      text: row.prompt?.text ?? "",
    }));
    expect(prompts.length).toBe(AI_TESTED_KEYWORD_LIMIT);
    const { dropped } = withoutBrandNamedPrompts(prompts, [...DEMO_ALIASES]);
    expect(dropped).toEqual([]);
  });

  it("stamps the score version on every row", () => {
    for (const row of rows) expect(row.scoreVersion).toBe(OPPORTUNITY_SCORE_VERSION);
  });
});
