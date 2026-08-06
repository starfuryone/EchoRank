// The three visibility formulas, with every weight pinned by a test that fails
// if it moves.
//
// MUTATION-TESTED ON PURPOSE. Expected values here are hand-computed LITERALS,
// never recomputed from the WEIGHTS object — a test that derives its expectation
// from the same constant it is checking passes no matter what that constant
// becomes, which is the most comfortable kind of useless test. Each case below
// isolates one weight: change WEIGHTS.position from 35 and the position cases
// fail while the others stand, so the failure names the weight that moved.
import { describe, it, expect } from "vitest";
import {
  POSITION_DECAY,
  PROMINENCE_SATURATION,
  REPEATABILITY_WEIGHTS,
  STABILITY_REFERENCE_SPREAD,
  UNRANKED_POSITION_FACTOR,
  WEIGHTS,
  checkupVisibilityScore,
  mentionVisibilityScore,
  positionFactor,
  repeatabilityScore,
  standardDeviation,
  type ScoreInput,
} from "@/lib/ai-monitor/scoring";

/** Everything at its maximum: this must score exactly 100. */
const PERFECT: ScoreInput = {
  brandMentioned: true,
  mentionCount: 3,
  listPosition: 1,
  citedOwnDomain: true,
  recommended: true,
  recommendationStrength: 1,
  sentiment: "positive",
  confidence: 1,
};

describe("weights are a percentage split", () => {
  it("sums to 100, so a perfect response scores 100", () => {
    const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
    expect(mentionVisibilityScore(PERFECT).score).toBe(100);
  });
});

describe("formula 1 — one response", () => {
  it("scores an unmentioned brand a hard zero, however good everything else is", () => {
    // No partial credit for absence: a brand the model did not name has no
    // visibility in that answer.
    const score = mentionVisibilityScore({
      ...PERFECT,
      brandMentioned: false,
    }).score;
    expect(score).toBe(0);
  });

  it("charges 35 points to position — second place costs 9.07", () => {
    // 35 / 1.35 = 25.93, so 100 - 35 + 25.93 = 90.93.
    expect(mentionVisibilityScore({ ...PERFECT, listPosition: 2 }).score).toBe(90.93);
    // Fifth: 35 / (1 + 0.35*4) = 14.58 -> 65 + 14.58 = 79.58.
    expect(mentionVisibilityScore({ ...PERFECT, listPosition: 5 }).score).toBe(79.58);
  });

  it("gives an unlisted prose mention 60% of the position weight — 21 of 35", () => {
    expect(mentionVisibilityScore({ ...PERFECT, listPosition: null }).score).toBe(86);
  });

  it("charges 25 points to recommendation", () => {
    expect(mentionVisibilityScore({ ...PERFECT, recommended: false }).score).toBe(75);
    // Half strength earns half the component: 100 - 12.5.
    expect(
      mentionVisibilityScore({ ...PERFECT, recommendationStrength: 0.5 }).score,
    ).toBe(87.5);
  });

  it("charges 15 points to sentiment, with neutral worth half", () => {
    expect(mentionVisibilityScore({ ...PERFECT, sentiment: "negative" }).score).toBe(85);
    expect(mentionVisibilityScore({ ...PERFECT, sentiment: "neutral" }).score).toBe(92.5);
    // An unrecognised label is neutral, not a crash and not a free 15 points.
    expect(mentionVisibilityScore({ ...PERFECT, sentiment: "mixed" }).score).toBe(92.5);
  });

  it("charges 15 points to citing the brand's own domain", () => {
    expect(mentionVisibilityScore({ ...PERFECT, citedOwnDomain: false }).score).toBe(85);
  });

  it("charges 10 points to prominence, saturating at three mentions", () => {
    // 10 * 1/3 = 3.33 -> 90 + 3.33.
    expect(mentionVisibilityScore({ ...PERFECT, mentionCount: 1 }).score).toBe(93.33);
    // A tenth mention says more about the answer's length than the brand.
    expect(mentionVisibilityScore({ ...PERFECT, mentionCount: 10 }).score).toBe(100);
    expect(PROMINENCE_SATURATION).toBe(3);
  });

  it("scales the whole score by confidence", () => {
    expect(mentionVisibilityScore({ ...PERFECT, confidence: 0.5 }).score).toBe(50);
    // Absent confidence means the LLM pass never ran, which is not the same as
    // low confidence — it must not silently halve a deterministic result.
    expect(mentionVisibilityScore({ ...PERFECT, confidence: null }).score).toBe(100);
  });

  it("clamps nonsense inputs instead of producing an out-of-range score", () => {
    expect(mentionVisibilityScore({ ...PERFECT, confidence: 9 }).score).toBe(100);
    expect(
      mentionVisibilityScore({ ...PERFECT, recommendationStrength: -3 }).score,
    ).toBe(75);
    expect(positionFactor(0)).toBe(1);
    expect(positionFactor(undefined)).toBe(UNRANKED_POSITION_FACTOR);
  });

  it("decays position hyperbolically, not exponentially", () => {
    // The 1st->2nd drop must be much larger than the 8th->9th one, and 9th must
    // stay distinguishable from absent so a climb from 9th to 6th shows up.
    const at = (p: number) => positionFactor(p);
    expect(at(1) - at(2)).toBeGreaterThan(at(8) - at(9));
    expect(at(9)).toBeGreaterThan(0.2);
    expect(POSITION_DECAY).toBe(0.35);
  });
});

describe("formula 2 — one checkup", () => {
  it("balances providers, not responses", () => {
    // Four responses from a chatty provider and one from a quiet one. A plain
    // mean over responses would be 80; averaging per provider first gives 50,
    // which is what the per-provider bars in the UI imply is happening.
    const responses = [
      { provider: "CLAUDE", score: 100, mentioned: true },
      { provider: "CLAUDE", score: 100, mentioned: true },
      { provider: "CLAUDE", score: 100, mentioned: true },
      { provider: "CLAUDE", score: 100, mentioned: true },
      { provider: "CHATGPT", score: 0, mentioned: false },
    ];
    const result = checkupVisibilityScore(responses);
    expect(result.overall).toBe(50);
    expect(result.byProvider).toEqual({ CLAUDE: 100, CHATGPT: 0 });
  });

  it("reports mention rate over responses, from the flag not the score", () => {
    // A mentioned response that scored 0 (zero-confidence reading) still counts
    // as a mention — otherwise this number would contradict the regex pass.
    const result = checkupVisibilityScore([
      { provider: "CLAUDE", score: 0, mentioned: true },
      { provider: "CLAUDE", score: 60, mentioned: true },
      { provider: "CHATGPT", score: 0, mentioned: false },
      { provider: "CHATGPT", score: 0, mentioned: false },
    ]);
    expect(result.mentionRate).toBe(50);
  });

  it("returns null for no responses rather than a confident zero", () => {
    // "We could not ask" and "you are invisible" are different answers.
    expect(checkupVisibilityScore([])).toEqual({
      overall: null,
      byProvider: {},
      mentionRate: null,
    });
  });
});

describe("formula 3 — repeatability", () => {
  it("scores identical repetitions 100", () => {
    expect(
      repeatabilityScore([{ scores: [70, 70, 70], mentioned: [true, true, true] }]),
    ).toBe(100);
  });

  it("scores a provider that mentions the brand half the time near zero", () => {
    // Agreement 0 (a 50/50 split). Scores [80, 0] have a population stdev of
    // 40, so stability is 1 - 40/50 = 0.2 and the total is 0.4 * 0.2 = 0.08.
    expect(repeatabilityScore([{ scores: [80, 0], mentioned: [true, false] }])).toBe(8);
  });

  it("weights mention agreement above score wobble", () => {
    // Same-outcome runs that merely scored differently must beat a coin flip.
    const wobbly = repeatabilityScore([{ scores: [90, 50], mentioned: [true, true] }]);
    const flipping = repeatabilityScore([{ scores: [90, 50], mentioned: [true, false] }]);
    expect(wobbly).toBeGreaterThan(flipping!);
    expect(REPEATABILITY_WEIGHTS.mentionAgreement).toBeGreaterThan(
      REPEATABILITY_WEIGHTS.scoreStability,
    );
    expect(REPEATABILITY_WEIGHTS.mentionAgreement + REPEATABILITY_WEIGHTS.scoreStability).toBe(1);
  });

  it("skips single-repetition groups instead of calling them perfectly stable", () => {
    // A tier with repetitions: 1 must not report flawless repeatability it
    // never measured.
    expect(repeatabilityScore([{ scores: [80], mentioned: [true] }])).toBeNull();
    expect(repeatabilityScore([])).toBeNull();
  });

  it("uses only the comparable groups when singletons are mixed in", () => {
    const score = repeatabilityScore([
      { scores: [70, 70], mentioned: [true, true] },
      { scores: [10], mentioned: [false] },
    ]);
    expect(score).toBe(100);
  });

  it("treats a spread of half the range as total instability", () => {
    expect(STABILITY_REFERENCE_SPREAD).toBe(50);
    // Population stdev, not sample: these are all the repetitions that ran.
    expect(standardDeviation([0, 100])).toBe(50);
    expect(standardDeviation([70])).toBe(0);
    // Agreement 1, stability 0 -> 0.6 exactly.
    expect(repeatabilityScore([{ scores: [0, 100], mentioned: [true, true] }])).toBe(60);
  });
});
