// tests/sov-weighting.test.ts
//
// The AI Share of Voice arithmetic: the weight table, the share normalization,
// and the mapping from Watcher rows to observations.
//
// EVERY EXPECTED NUMBER IS A HAND-COMPUTED LITERAL, never a recomputation from
// the constant under test — the same convention tests/ai-search-metrics.test.ts
// sets and for the same reason. Writing `1 / 3` here would pass whatever
// mentionWeight() became; writing 0.3333333333333333 fails the moment the
// ladder changes, which is exactly when someone should be made to look.

import { describe, expect, it } from "vitest";
import {
  RANK_CAP,
  UNPOSITIONED_WEIGHT,
  SHARE_DROP_POINTS,
  aggregateSov,
  brandKey,
  isReportableDrop,
  mentionWeight,
  type SovObservation,
} from "@/lib/sov/weighting";
import {
  countsAsEntity,
  normalizeEngine,
  toObservations,
  type SovRunRow,
} from "@/lib/sov/observations";

const obs = (over: Partial<SovObservation> = {}): SovObservation => ({
  engine: "CLAUDE",
  promptId: "p1",
  brand: "Us",
  rank: null,
  ...over,
});

// ─── The weight table ───────────────────────────────────────────────────────

describe("the mention weight ladder", () => {
  // The whole spec in one table. If any cell here changes, the change was
  // deliberate and this table is where it gets argued about.
  it.each([
    [1, 1],
    [2, 0.5],
    [3, 0.3333333333333333],
    [4, 0.25],
    [5, 0.2],
    // Capped, not discarded: sixth place is worth what fifth place is worth.
    [6, 0.2],
    [12, 0.2],
    [999, 0.2],
  ])("rank %i weighs %f", (rank, expected) => {
    expect(mentionWeight(rank)).toBe(expected);
  });

  it("weighs an unpositioned mention 0.3", () => {
    expect(mentionWeight(null)).toBe(0.3);
    expect(mentionWeight(undefined)).toBe(0.3);
  });

  it("prices an unpositioned mention above fourth place, on purpose", () => {
    // This is the spec's deliberate non-monotonicity, pinned so nobody
    // "fixes" it silently: being named in prose beats being ranked fourth.
    expect(mentionWeight(null)).toBeGreaterThan(mentionWeight(4));
    expect(mentionWeight(null)).toBeLessThan(mentionWeight(3));
  });

  it("treats an unusable rank as no position rather than dividing by it", () => {
    // Positions are 1-based everywhere in the analyzer. A 0 would otherwise
    // return Infinity and hand one bad row the entire tenant's share.
    //
    // ONE RULE FOR ALL OF THEM: anything that is not a finite rank of at least
    // 1 is "we have no position", not "you came last". None of these can reach
    // us from an Int column anyway, so the value of the branch is that it has a
    // single obvious answer rather than four cases to reason about.
    expect(mentionWeight(0)).toBe(UNPOSITIONED_WEIGHT);
    expect(mentionWeight(-3)).toBe(UNPOSITIONED_WEIGHT);
    expect(mentionWeight(Number.NaN)).toBe(UNPOSITIONED_WEIGHT);
    expect(mentionWeight(Number.POSITIVE_INFINITY)).toBe(UNPOSITIONED_WEIGHT);
  });

  it("floors at the cap", () => {
    expect(RANK_CAP).toBe(5);
    expect(mentionWeight(RANK_CAP)).toBe(0.2);
  });

  it("rounds a fractional rank down to the place it sits in", () => {
    expect(mentionWeight(2.7)).toBe(0.5);
  });
});

// ─── Shares ─────────────────────────────────────────────────────────────────

describe("share normalization", () => {
  it("divides each brand's weight by the engine's total", () => {
    // Us at rank 1 (1.0), Rival at rank 2 (0.5). Total 1.5.
    const rows = aggregateSov([
      obs({ brand: "Us", rank: 1 }),
      obs({ brand: "Rival", rank: 2 }),
    ]);

    const us = rows.find((r) => r.brand === "Us")!;
    const rival = rows.find((r) => r.brand === "Rival")!;

    expect(us.mentionWeighted).toBe(1);
    expect(rival.mentionWeighted).toBe(0.5);
    expect(us.share).toBeCloseTo(0.6666666666, 9);
    expect(rival.share).toBeCloseTo(0.3333333333, 9);
  });

  it("sums to 1 within an engine", () => {
    const rows = aggregateSov([
      obs({ brand: "Us", rank: 1 }),
      obs({ brand: "A", rank: 3 }),
      obs({ brand: "B", rank: null }),
      obs({ brand: "C", rank: 9 }),
      obs({ promptId: "p2", brand: "Us", rank: 4 }),
      obs({ promptId: "p2", brand: "A", rank: 1 }),
    ]);

    const total = rows.reduce((sum, row) => sum + row.share, 0);
    expect(total).toBeCloseTo(1, 12);
  });

  it("sums to 1 within EACH engine, not once across all of them", () => {
    // Two engines that saw different fields. Pooling them would give a total
    // of 1 across the whole set and 0.5-ish per engine, which is the bug.
    const rows = aggregateSov([
      obs({ engine: "CLAUDE", brand: "Us", rank: 1 }),
      obs({ engine: "CLAUDE", brand: "Rival", rank: 2 }),
      obs({ engine: "PERPLEXITY", promptId: "p2", brand: "Us", rank: 4 }),
      obs({ engine: "PERPLEXITY", promptId: "p2", brand: "Rival", rank: 1 }),
    ]);

    for (const engine of ["CLAUDE", "PERPLEXITY"]) {
      const total = rows
        .filter((row) => row.engine === engine)
        .reduce((sum, row) => sum + row.share, 0);
      expect(total).toBeCloseTo(1, 12);
    }
  });

  it("gives a lone brand the whole engine", () => {
    const rows = aggregateSov([obs({ brand: "Us", rank: null })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].share).toBe(1);
  });

  it("writes nothing for an empty window", () => {
    expect(aggregateSov([])).toEqual([]);
  });

  it("ignores a blank brand rather than opening a nameless bucket", () => {
    const rows = aggregateSov([obs({ brand: "Us", rank: 1 }), obs({ brand: "   " })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].share).toBe(1);
  });

  it("counts distinct prompts, and reports the same count on every row", () => {
    const rows = aggregateSov([
      obs({ promptId: "p1", brand: "Us" }),
      obs({ promptId: "p1", brand: "Rival" }),
      obs({ promptId: "p2", brand: "Us" }),
    ]);
    expect(rows.every((row) => row.promptCount === 2)).toBe(true);
  });

  it("collapses two spellings of one brand into one row", () => {
    const rows = aggregateSov([
      obs({ brand: "HubSpot", rank: 1 }),
      obs({ promptId: "p2", brand: "hubspot", rank: 1 }),
    ]);
    expect(rows).toHaveLength(1);
    // The first spelling seen is the one displayed.
    expect(rows[0].brand).toBe("HubSpot");
    expect(rows[0].mentionWeighted).toBe(2);
  });

  it("sorts biggest share first within an engine", () => {
    const rows = aggregateSov([
      obs({ brand: "Small", rank: 5 }),
      obs({ brand: "Big", rank: 1 }),
    ]);
    expect(rows.map((r) => r.brand)).toEqual(["Big", "Small"]);
  });

  it("groups case-insensitively", () => {
    expect(brandKey("  HubSpot ")).toBe("hubspot");
  });
});

// ─── Watcher rows -> observations ───────────────────────────────────────────

const BRAND = { name: "Echorank360", aliases: ["Echorank", "Echo rank"] };

const run = (over: Partial<SovRunRow> = {}): SovRunRow => ({
  engine: "CLAUDE",
  promptId: "p1",
  analysis: { brandMentioned: true, recommendationPosition: 1 },
  competitorMentions: [],
  ...over,
});

describe("mapping Watcher rows to observations", () => {
  it("reads the brand's rank and each rival's from the same field", () => {
    const result = toObservations(
      [
        run({
          analysis: { brandMentioned: true, recommendationPosition: 2 },
          competitorMentions: [
            { name: "Rival", recommendationPosition: 1, classification: "RIVAL" },
          ],
        }),
      ],
      BRAND,
    );

    expect(result).toEqual([
      { engine: "CLAUDE", promptId: "p1", brand: "Echorank360", rank: 2 },
      { engine: "CLAUDE", promptId: "p1", brand: "Rival", rank: 1 },
    ]);
  });

  it("skips a run the brand was absent from, but keeps its rivals", () => {
    // The rivals still took share of that answer — dropping the whole run would
    // hide exactly the answers we are losing.
    const result = toObservations(
      [
        run({
          analysis: { brandMentioned: false, recommendationPosition: null },
          competitorMentions: [
            { name: "Rival", recommendationPosition: 1, classification: "RIVAL" },
          ],
        }),
      ],
      BRAND,
    );
    expect(result).toEqual([
      { engine: "CLAUDE", promptId: "p1", brand: "Rival", rank: 1 },
    ]);
  });

  it("skips a run whose analysis never landed", () => {
    const result = toObservations([run({ analysis: null })], BRAND);
    expect(result).toEqual([]);
  });

  it("excludes platforms and category words, keeps unclassified rows", () => {
    expect(countsAsEntity("RIVAL")).toBe(true);
    // Null means "not yet judged" — every row predating the classifier has it,
    // and excluding them would empty the universe for most of the window.
    expect(countsAsEntity(null)).toBe(true);
    expect(countsAsEntity("PLATFORM")).toBe(false);
    expect(countsAsEntity("GENERIC")).toBe(false);

    const result = toObservations(
      [
        run({
          analysis: { brandMentioned: false, recommendationPosition: null },
          competitorMentions: [
            { name: "OpenAI", recommendationPosition: 1, classification: "PLATFORM" },
            { name: "CRM software", recommendationPosition: 2, classification: "GENERIC" },
            { name: "Rival", recommendationPosition: 3, classification: null },
          ],
        }),
      ],
      BRAND,
    );
    expect(result.map((o) => o.brand)).toEqual(["Rival"]);
  });

  it("folds a competitor row naming the brand's own alias into the brand", () => {
    const result = toObservations(
      [
        run({
          analysis: { brandMentioned: true, recommendationPosition: 1 },
          competitorMentions: [
            { name: "Echorank", recommendationPosition: 4, classification: "RIVAL" },
          ],
        }),
      ],
      BRAND,
    );
    // One entity, not two — and the brand's own reading wins, not the alias row.
    expect(result).toEqual([
      { engine: "CLAUDE", promptId: "p1", brand: "Echorank360", rank: 1 },
    ]);
  });

  it("folds legacy lowercase engine ids onto the provider they are", () => {
    expect(normalizeEngine("claude")).toBe("CLAUDE");
    expect(normalizeEngine(" Claude ")).toBe("CLAUDE");

    const rows = aggregateSov(
      toObservations([run({ engine: "claude" }), run({ engine: "CLAUDE", promptId: "p2" })], BRAND),
    );
    // One engine, not two.
    expect(rows).toHaveLength(1);
    expect(rows[0].engine).toBe("CLAUDE");
  });
});

// ─── The drop threshold ─────────────────────────────────────────────────────

describe("the week-over-week drop threshold", () => {
  it("fires above five points and not at or below it", () => {
    expect(SHARE_DROP_POINTS).toBe(5);
    expect(isReportableDrop(20, 14.9)).toBe(true);
    // Exactly five points is not "more than five points".
    expect(isReportableDrop(20, 15)).toBe(false);
    expect(isReportableDrop(20, 15.1)).toBe(false);
  });

  it("never fires on a rise", () => {
    expect(isReportableDrop(10, 30)).toBe(false);
  });
});
