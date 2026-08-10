// tests/ai-search-metrics.test.ts
//
// The canonical AI Search Score (version 1) and the roll-ups beside it.
//
// EVERY EXPECTED NUMBER IS A HAND-COMPUTED LITERAL, never a recomputation from
// the constant under test. `0.4 * 80` written out as 32 is what makes changing
// SCORE_WEIGHTS_V1.mention fail this file; `SCORE_WEIGHTS_V1.mention * 80`
// would pass whatever the weight became, and a weight nobody can observe is a
// weight nobody can trust. Same convention as tests/ai-monitor-scoring.test.ts.
//
// The edge cases here are the ones the build doc locked, and each is a decision
// someone will be tempted to reverse: an unranked mention scores 0 for position
// rather than getting a flat 50, and a brand with no mentions at all scores 0
// for sentiment rather than a neutral 50.

import { describe, expect, it } from "vitest";
import {
  MAX_TOP_COMPETITORS,
  SCORE_VERSION,
  aggregateCheckup,
  aggregateMetrics,
  citationComponent,
  citationsByDomain,
  clampComponent,
  computeScore,
  computeScoreV1,
  mentionComponent,
  positionComponent,
  round1,
  sentimentComponent,
  toVisibilityMetricRow,
  topCompetitors,
  type ScoredRun,
} from "@/lib/ai-monitor/metrics";

function run(over: Partial<ScoredRun> = {}): ScoredRun {
  return {
    engine: "claude",
    promptId: "p1",
    brandMentioned: false,
    mentionCount: 0,
    brandPosition: null,
    sentiment: null,
    citations: [],
    competitors: [],
    ...over,
  };
}

/** n runs, the first `mentioned` of them naming the brand. */
function runs(count: number, mentioned: number, over: Partial<ScoredRun> = {}): ScoredRun[] {
  return Array.from({ length: count }, (_, i) =>
    run({ brandMentioned: i < mentioned, mentionCount: i < mentioned ? 1 : 0, ...over }),
  );
}

const cited = (position: number | null, isMonitoredDomain = true) => ({
  domain: isMonitoredDomain ? "echorank360.com" : "g2.com",
  citationPosition: position,
  isMonitoredDomain,
});

describe("the mention component", () => {
  it("is the share of runs naming the brand, as a percentage", () => {
    // The build doc's worked example: 8 of 10 -> 80 -> 0.40 * 80 = 32 points.
    expect(mentionComponent(runs(10, 8))).toBe(80);
    expect(computeScoreV1(runs(10, 8))!.score).toBe(32);
  });

  it("is 0 when nothing named the brand and 100 when everything did", () => {
    expect(mentionComponent(runs(4, 0))).toBe(0);
    expect(mentionComponent(runs(4, 4))).toBe(100);
  });
});

describe("the position component", () => {
  it("averages 100/position over the runs that ranked the brand", () => {
    // 100/1 and 100/2 -> mean(100, 50) = 75.
    const ranked = [
      run({ brandMentioned: true, brandPosition: 1 }),
      run({ brandMentioned: true, brandPosition: 2 }),
    ];
    expect(positionComponent(ranked)).toBe(75);
    // mention 100 -> 40, position 75 -> 22.5, nothing else. 62.5.
    expect(computeScoreV1(ranked)!.score).toBe(62.5);
  });

  it("scores 0 when the brand is mentioned but never ranked — no flat fallback", () => {
    // LOCKED. The mention component has already paid for the appearance; a
    // fallback here would make an unranked brand nearly indistinguishable from
    // a ranked one, which is the entire reason position is a component.
    const unranked = [run({ brandMentioned: true, mentionCount: 2, brandPosition: null })];
    expect(positionComponent(unranked)).toBe(0);
    expect(computeScoreV1(unranked)!.score).toBe(40);
  });

  it("ignores runs that did not rank the brand rather than counting them zero", () => {
    // One run at position 1, one unranked. Averaging the unranked in as 0 would
    // give 50; ignoring it gives 100.
    expect(
      positionComponent([
        run({ brandMentioned: true, brandPosition: 1 }),
        run({ brandMentioned: true, brandPosition: null }),
      ]),
    ).toBe(100);
  });

  it("refuses a position below 1 instead of dividing by it", () => {
    // 100/0 is Infinity; a bad row must not produce a perfect score.
    expect(positionComponent([run({ brandMentioned: true, brandPosition: 0 })])).toBe(0);
  });
});

describe("the citation component", () => {
  it("is 0.7 of the citing rate plus 0.3 of the best rank achieved", () => {
    // 4 of 10 runs cite the monitored domain; best position among them is 2.
    // rate 40 -> 0.7*40 = 28. rank 100/2 = 50 -> 0.3*50 = 15. Total 43.
    const set = runs(10, 10);
    set[0].citations = [cited(3)];
    set[1].citations = [cited(2)];
    set[2].citations = [cited(4)];
    set[3].citations = [cited(5)];
    expect(citationComponent(set)).toBe(43);
  });

  it("counts a run once however many times it cites the domain", () => {
    // Two citations, one run, out of four. Rate is 25, not 50.
    const set = runs(4, 4);
    set[0].citations = [cited(1), cited(4)];
    // rate 25 -> 17.5; rank 100/1 = 100 -> 30. Total 47.5.
    expect(citationComponent(set)).toBe(47.5);
  });

  it("still credits the rate when no citing run carried a position", () => {
    // An engine that returns sources without an order must not lose the whole
    // component — only the rank term it genuinely cannot supply.
    const set = runs(4, 4);
    set[0].citations = [cited(null)];
    set[1].citations = [cited(null)];
    // rate 50 -> 35, rank term 0. Total 35.
    expect(citationComponent(set)).toBe(35);
  });

  it("is 0 when nothing cited the monitored domain", () => {
    const set = runs(4, 4);
    set[0].citations = [cited(1, false)];
    expect(citationComponent(set)).toBe(0);
  });
});

describe("the sentiment component", () => {
  it("averages the mentioned runs on the 100/50/0 ladder", () => {
    expect(
      sentimentComponent([
        run({ brandMentioned: true, sentiment: "POSITIVE" }),
        run({ brandMentioned: true, sentiment: "NEGATIVE" }),
      ]),
    ).toBe(50);
    expect(sentimentComponent([run({ brandMentioned: true, sentiment: "NEUTRAL" })])).toBe(50);
  });

  it("ignores runs that never mentioned the brand", () => {
    // The unmentioned run carries a sentiment reading it should not have; even
    // so it must not drag the average.
    expect(
      sentimentComponent([
        run({ brandMentioned: true, sentiment: "POSITIVE" }),
        run({ brandMentioned: false, sentiment: "NEGATIVE" }),
      ]),
    ).toBe(100);
  });

  it("is 0 with no mentions at all — not a neutral 50", () => {
    // LOCKED. A neutral 50 would put an invisible brand above one that is
    // mentioned and disliked, inverting the thing being measured.
    expect(sentimentComponent(runs(5, 0))).toBe(0);
    expect(computeScoreV1(runs(5, 0))!.score).toBe(0);
  });

  it("excludes a mentioned run whose reading is NOT_MENTIONED or missing", () => {
    // The two passes disagreeing is an absence of evidence about tone. Counting
    // it as neutral would drag every real reading toward 50.
    expect(
      sentimentComponent([
        run({ brandMentioned: true, sentiment: "POSITIVE" }),
        run({ brandMentioned: true, sentiment: "NOT_MENTIONED" }),
        run({ brandMentioned: true, sentiment: null }),
      ]),
    ).toBe(100);
  });
});

describe("the weighted score", () => {
  it("weights the four components 40/30/20/10", () => {
    const set = runs(2, 2, { sentiment: "POSITIVE" });
    set[0].brandPosition = 1;
    set[1].brandPosition = 1;
    set[0].citations = [cited(1)];
    set[1].citations = [cited(1)];
    // mention 100, position 100, citation 0.7*100 + 0.3*100 = 100, sentiment 100.
    // 40 + 30 + 20 + 10 = 100.
    const scored = computeScoreV1(set)!;
    expect(scored.components).toEqual({
      mention: 100,
      position: 100,
      citation: 100,
      sentiment: 100,
    });
    expect(scored.score).toBe(100);
  });

  it("rounds to one decimal", () => {
    // 1 of 3 mentioned -> 33.333…; 0.40 * that = 13.333… -> 13.3.
    expect(computeScoreV1(runs(3, 1))!.score).toBe(13.3);
    expect(round1(13.35)).toBe(13.4);
    expect(round1(0.04)).toBe(0);
  });

  it("clamps a component to 0-100 before weighting", () => {
    expect(clampComponent(150)).toBe(100);
    expect(clampComponent(-5)).toBe(0);
    expect(clampComponent(Number.NaN)).toBe(0);
    // An infinity clamps to the bound it ran past, not to zero.
    expect(clampComponent(Number.POSITIVE_INFINITY)).toBe(100);
  });

  it("returns null for no runs at all, rather than a score of zero", () => {
    // LOCKED. "We could not ask" and "you are invisible" are different answers.
    expect(computeScoreV1([])).toBeNull();
    expect(aggregateMetrics([])).toBeNull();
  });

  it("stamps the version it was computed under", () => {
    expect(computeScoreV1(runs(1, 1))!.scoreVersion).toBe(1);
    expect(SCORE_VERSION).toBe(1);
  });
});

describe("version dispatch", () => {
  it("routes version 1 to computeScoreV1", () => {
    const set = runs(4, 3);
    expect(computeScore(set, 1)).toEqual(computeScoreV1(set));
    expect(computeScore(set)).toEqual(computeScoreV1(set));
  });

  it("refuses a version it does not implement", () => {
    // Better than silently scoring an unknown version with today's weights,
    // which is how a historical row gets restated.
    expect(() => computeScore(runs(1, 1), 2)).toThrow(/unknown AI search score version: 2/);
  });
});

describe("the metrics beside the score", () => {
  it("reports mention frequency as a fraction, for the customer-facing line", () => {
    const metrics = aggregateMetrics(runs(10, 8))!;
    expect(metrics.mentionFrequency).toBe(0.8);
    expect(metrics.runCount).toBe(10);
  });

  it("totals mentions across runs, not runs that mentioned", () => {
    const set = [
      run({ brandMentioned: true, mentionCount: 3 }),
      run({ brandMentioned: true, mentionCount: 2 }),
      run({ brandMentioned: false, mentionCount: 0 }),
    ];
    expect(aggregateMetrics(set)!.totalMentions).toBe(5);
    expect(aggregateMetrics(set)!.mentionFrequency).toBeCloseTo(2 / 3, 10);
  });

  it("averages position over positioned runs only, and null when none", () => {
    const set = [
      run({ brandMentioned: true, brandPosition: 1 }),
      run({ brandMentioned: true, brandPosition: 4 }),
      run({ brandMentioned: true, brandPosition: null }),
    ];
    expect(aggregateMetrics(set)!.averagePosition).toBe(2.5);
    expect(aggregateMetrics(runs(2, 2))!.averagePosition).toBeNull();
  });

  it("counts top-3 placements as a share of every run", () => {
    const set = runs(4, 4);
    set[0].brandPosition = 1;
    set[1].brandPosition = 3;
    set[2].brandPosition = 4;
    expect(aggregateMetrics(set)!.top3Rate).toBe(0.5);
  });

  it("counts monitored-domain citations, not citing runs", () => {
    const set = runs(3, 3);
    set[0].citations = [cited(1), cited(2)];
    set[1].citations = [cited(1, false)];
    expect(aggregateMetrics(set)!.monitoredDomainCitations).toBe(2);
  });

  it("reports share of voice against every entity named", () => {
    // Brand in 2 of 3 runs; competitors contribute 1 + 1 appearances.
    const set = runs(3, 2);
    set[0].competitors = [{ name: "Ahrefs", position: 2 }];
    set[1].competitors = [{ name: "Semrush", position: 1 }];
    // 2 / (2 + 2) = 50%.
    expect(aggregateMetrics(set)!.shareOfVoice).toBe(50);
    expect(aggregateMetrics(runs(2, 0))!.shareOfVoice).toBeNull();
  });

  it("reports mean sentiment on -1..1, a different scale from the component", () => {
    const set = [
      run({ brandMentioned: true, sentiment: "POSITIVE" }),
      run({ brandMentioned: true, sentiment: "NEGATIVE" }),
      run({ brandMentioned: true, sentiment: "NEUTRAL" }),
    ];
    expect(aggregateMetrics(set)!.meanSentiment).toBe(0);
    expect(sentimentComponent(set)).toBe(50);
    expect(aggregateMetrics(runs(2, 0))!.meanSentiment).toBeNull();
  });
});

describe("citations by domain", () => {
  it("counts every citation and averages the rank, busiest first", () => {
    const set = [
      run({
        citations: [
          { domain: "g2.com", citationPosition: 1, isMonitoredDomain: false },
          { domain: "reddit.com", citationPosition: 2, isMonitoredDomain: false },
        ],
      }),
      run({
        citations: [{ domain: "g2.com", citationPosition: 3, isMonitoredDomain: false }],
      }),
    ];
    expect(citationsByDomain(set)).toEqual([
      { domain: "g2.com", count: 2, averageRank: 2 },
      { domain: "reddit.com", count: 1, averageRank: 2 },
    ]);
  });

  it("reports a null average rank when no citation carried a position", () => {
    const set = [
      run({ citations: [{ domain: "g2.com", citationPosition: null, isMonitoredDomain: false }] }),
    ];
    expect(citationsByDomain(set)[0].averageRank).toBeNull();
  });
});

describe("top competitors", () => {
  it("scores 0.60 on frequency and 0.40 on average rank", () => {
    // Appears in 4 of 5 runs at 1, 1, 2, 2 -> frequency 0.8, avg position 1.5.
    // 0.60 * 80 = 48. 100/1.5 = 66.666… -> 0.40 * that = 26.666…. 74.7.
    const set = runs(5, 5);
    set[0].competitors = [{ name: "Ahrefs", position: 1 }];
    set[1].competitors = [{ name: "Ahrefs", position: 1 }];
    set[2].competitors = [{ name: "Ahrefs", position: 2 }];
    set[3].competitors = [{ name: "Ahrefs", position: 2 }];

    const [ahrefs] = topCompetitors(set);
    expect(ahrefs.frequency).toBe(0.8);
    expect(ahrefs.averagePosition).toBe(1.5);
    expect(ahrefs.competitorScore).toBe(74.7);
  });

  it("counts one appearance per run however often a run repeats the name", () => {
    // Otherwise one effusive answer manufactures a rival.
    const set = [
      run({
        competitors: [
          { name: "Ahrefs", position: 1 },
          { name: "ahrefs", position: 5 },
        ],
      }),
      run({}),
    ];
    expect(topCompetitors(set)[0].frequency).toBe(0.5);
  });

  it("gives no position credit to a competitor that was never ranked", () => {
    const set = runs(2, 2);
    set[0].competitors = [{ name: "Ahrefs", position: null }];
    // 0.60 * 50 = 30, and nothing from the position term.
    expect(topCompetitors(set)[0]).toMatchObject({ averagePosition: null, competitorScore: 30 });
  });

  it("keeps the ten strongest and drops the rest", () => {
    const set = [
      run({
        competitors: Array.from({ length: 14 }, (_, i) => ({
          name: `Rival${i}`,
          position: i + 1,
        })),
      }),
    ];
    const top = topCompetitors(set);
    expect(top).toHaveLength(MAX_TOP_COMPETITORS);
    // Ranked by score, so the best-placed survive and the tail is what is cut.
    expect(top[0].name).toBe("Rival0");
    expect(top.map((c) => c.name)).not.toContain("Rival13");
  });

  it("returns nothing for an empty run set rather than dividing by zero", () => {
    expect(topCompetitors([])).toEqual([]);
  });
});

describe("aggregating a whole checkup", () => {
  /** 5 prompts x 3 engines. Claude names the brand every time, Gemini never. */
  function matrix(): ScoredRun[] {
    const out: ScoredRun[] = [];
    for (let prompt = 1; prompt <= 5; prompt++) {
      out.push(
        run({
          engine: "claude",
          promptId: `p${prompt}`,
          brandMentioned: true,
          mentionCount: 1,
          brandPosition: 1,
          sentiment: "POSITIVE",
        }),
      );
      out.push(
        run({
          engine: "chatgpt",
          promptId: `p${prompt}`,
          brandMentioned: prompt <= 3,
          mentionCount: prompt <= 3 ? 1 : 0,
          brandPosition: prompt <= 3 ? 2 : null,
          sentiment: prompt <= 3 ? "NEUTRAL" : null,
        }),
      );
      out.push(run({ engine: "gemini", promptId: `p${prompt}` }));
    }
    return out;
  }

  it("applies the same formula to each engine's subset", () => {
    const { byEngine, overall } = aggregateCheckup(matrix());

    // Claude: mention 100, position 100, citation 0, sentiment 100 -> 40+30+10.
    expect(byEngine.claude.score).toBe(80);
    // ChatGPT: 3 of 5 mentioned -> 60; position avg(100/2 x3) = 50; sentiment
    // 50 over the three mentioned. 24 + 15 + 5 = 44.
    expect(byEngine.chatgpt.score).toBe(44);
    // Gemini never named the brand: every component zero.
    expect(byEngine.gemini.score).toBe(0);
    expect(byEngine.gemini.runCount).toBe(5);

    // Overall is the formula over all 15, NOT the mean of the three engines
    // (which would be 41.3).
    // mention 8/15 = 53.333 -> 21.333; position avg of 5x100 and 3x50 = 81.25
    // -> 24.375; sentiment (5x100 + 3x50)/8 = 81.25 -> 8.125. 53.8.
    expect(overall!.score).toBe(53.8);
  });

  it("applies the same formula to each prompt's subset", () => {
    const { byPrompt } = aggregateCheckup(matrix());
    expect(Object.keys(byPrompt).sort()).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    // p1: claude + chatgpt mentioned, gemini not. mention 66.667 -> 26.667;
    // position avg(100, 50) = 75 -> 22.5; sentiment (100+50)/2 = 75 -> 7.5.
    expect(byPrompt.p1.score).toBe(56.7);
    // p4: only claude. mention 33.333 -> 13.333; position 100 -> 30;
    // sentiment 100 -> 10.
    expect(byPrompt.p4.score).toBe(53.3);
  });

  it("has no overall and no groups when nothing ran", () => {
    const empty = aggregateCheckup([]);
    expect(empty.overall).toBeNull();
    expect(empty.byEngine).toEqual({});
    expect(empty.byPrompt).toEqual({});
  });
});

describe("mapping an aggregate onto a VisibilityMetric row", () => {
  const set = runs(4, 3, {});
  const aggregate = (() => {
    const local = runs(4, 3);
    local[0].brandPosition = 1;
    local[0].citations = [cited(1)];
    local[0].sentiment = "POSITIVE";
    local[1].sentiment = "NEUTRAL";
    local[2].sentiment = "NEUTRAL";
    return aggregateCheckup(local).overall!;
  })();

  it("stores rates as fractions and scores as 0-100", () => {
    const row = toVisibilityMetricRow("claude", new Date("2026-08-10T00:00:00Z"), aggregate);
    // 3 of 4 mentioned; a rate written as 75 here would render as 7500%.
    expect(row.mentionRate).toBe(0.75);
    expect(row.top3Rate).toBe(0.25);
    expect(row.visibilityScore).toBe(aggregate.score);
    expect(row.visibilityScore).toBeGreaterThan(1);
    expect(row.runCount).toBe(4);
    expect(row.scoreVersion).toBe(1);
  });

  it("maps the position component onto recommendationScore", () => {
    const row = toVisibilityMetricRow("claude", new Date(), aggregate);
    expect(row.recommendationScore).toBe(aggregate.components.position);
  });

  it("nulls citationScore for an engine that cannot cite, rather than scoring 0", () => {
    // 0 reads as "never cited"; the truth is "unmeasurable here".
    const day = new Date();
    expect(toVisibilityMetricRow("claude", day, aggregate).citationScore).toBe(
      aggregate.components.citation,
    );
    expect(
      toVisibilityMetricRow("gemini", day, aggregate, { supportsCitations: false }).citationScore,
    ).toBeNull();
  });

  it("stores sentiment on -1..1, not the 0-100 component", () => {
    const row = toVisibilityMetricRow("claude", new Date(), aggregate);
    expect(row.sentimentScore).toBe(aggregate.meanSentiment);
    expect(row.sentimentScore).toBeLessThanOrEqual(1);
  });

  it("is computed over the runs it claims", () => {
    expect(aggregateMetrics(set)!.runCount).toBe(4);
  });
});
