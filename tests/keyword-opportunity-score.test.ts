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
    const scored = computeOpportunityScore(untested);

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
    expect(() => computeOpportunityScore(input(), 2)).toThrow(/unknown opportunity score version/);
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
      });
      expect(rescored.opportunityScore).toBe(row.opportunityScore);
      expect(rescored.severity).toBe(row.severity);
      expect(rescored.components).toEqual(row.components);
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
  // The scores below are what the specified formula actually produces. They
  // preserve what the brief was describing — all three AI-tested, the two
  // un-mentioned keywords ahead of the mentioned one — and they are asserted
  // exactly so that a future change to the weights has to come past this test.
  it("scores the three specced keywords at the formula's real values", () => {
    expect(byKeyword.get("best CRM for startups")?.opportunityScore).toBe(75);
    expect(byKeyword.get("CRM for agencies")?.opportunityScore).toBe(68);
    expect(byKeyword.get("affordable CRM software")?.opportunityScore).toBe(73);
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

  it("splits into three usable bands at the shipped cuts", () => {
    // THE REASON THE CUTS ARE 74/60 AND NOT 85/70, pinned so a change to
    // either constant has to come past a number somebody chose. At 85/70 this
    // read 2/12/11 — HIGH was a two-row shortlist that excluded the archetype
    // the tool exists to surface. At 75/70 it read 10/4/11, which is three
    // bands on paper and two in practice.
    //
    // These are v1 figures off a 25-keyword fixture set built to exercise
    // branches, NOT a sampled population. See HIGH_SEVERITY_MIN_SCORE.
    const tally = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const row of rows) tally[row.severity] += 1;
    expect(tally).toEqual({ HIGH: 11, MEDIUM: 7, LOW: 7 });
  });

  it("puts the rank-16 archetype in HIGH with headroom, not by a rounding step", () => {
    // 74.519 rounds to 75. A cut at 75 would have it clear by 0.48 of a
    // rounding artifact; at 74 it clears by a point of real score.
    const archetype = byKeyword.get("best CRM for startups");
    expect(archetype?.severity).toBe("HIGH");
    expect(archetype?.opportunityScore).toBeGreaterThan(HIGH_SEVERITY_MIN_SCORE);
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
