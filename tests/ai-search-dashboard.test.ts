// tests/ai-search-dashboard.test.ts
//
// The dashboard's display contract.
//
// EVERY TEST HERE IS NAMED AFTER A WRONG NUMBER ON A SCREEN. The COLUMN
// CONTRACT in metrics.ts is prose in a comment block, and prose does not fail a
// build — these do. Three columns on this row disagree about scale, and each
// mis-rendering is confidently wrong rather than obviously broken:
//
//   a 0-1 mentionRate shown raw says "0.8%" for a brand in four answers of five
//   a -1..1 sentiment shown as a percentage puts a neutral brand at 0%
//   an averagePosition on a 0-100 axis makes "#2" look like a catastrophe
//
// The version gate has its own set for the same reason: a row written by a
// formula this build does not know, rendered under a label it does know, is the
// exact silent lie the versioning exists to prevent.

import { describe, expect, it } from "vitest";
import {
  SUPPORTED_SCORE_VERSIONS,
  coverageNote,
  formatDay,
  formatInstant,
  fractionAsPercent,
  isSupportedScoreVersion,
  mentionFrequencyLabel,
  positionAsBarValue,
  positionLabel,
  sentimentLabel,
  sentimentPercent,
  toMetricView,
  type MetricRow,
} from "@/lib/ai-monitor/dashboard/display";

const row = (over: Partial<MetricRow> = {}): MetricRow => ({
  day: new Date("2026-08-10T00:00:00.000Z"),
  engine: "CLAUDE",
  scoreVersion: 1,
  visibilityScore: 78,
  citationScore: 43,
  recommendationScore: 75,
  sentimentScore: 0.5,
  shareOfVoice: 40,
  averagePosition: 2.9,
  mentionRate: 0.8,
  top3Rate: 0.6,
  runCount: 10,
  partialCoverage: false,
  skippedRuns: 0,
  ...over,
});

describe("the version gate", () => {
  it("renders a row written by a formula this build knows", () => {
    const view = toMetricView(row());
    expect(view.supported).toBe(true);
    expect(SUPPORTED_SCORE_VERSIONS).toContain(1);
  });

  it("refuses a row from a version it does not know, rather than showing the number", () => {
    // A version 2 score under a version 1 label is the silent lie versioning
    // exists to prevent.
    const view = toMetricView(row({ scoreVersion: 2, visibilityScore: 91 }));
    expect(view.supported).toBe(false);
    expect(isSupportedScoreVersion(2)).toBe(false);
    // The number must not be reachable from an unsupported view at all.
    expect(Object.keys(view)).not.toContain("score");
  });

  it("keeps enough of the row to explain itself", () => {
    // "We cannot show Aug 10 for Claude" is an answer; a blank card is not.
    const view = toMetricView(row({ scoreVersion: 7 }));
    expect(view).toMatchObject({ supported: false, scoreVersion: 7, engine: "CLAUDE" });
    expect(view.day.toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });
});

describe("fractions are percentages on screen", () => {
  it("renders a stored 0-1 rate as a whole percentage", () => {
    // The failure: "0.8%" for a brand mentioned in four answers out of five.
    expect(fractionAsPercent(0.8)).toBe("80%");
    expect(fractionAsPercent(0)).toBe("0%");
    expect(fractionAsPercent(1)).toBe("100%");
  });

  it("writes the customer-facing sentence the spec asks for", () => {
    expect(mentionFrequencyLabel(0.8)).toBe("mentioned in 80% of answers");
  });

  it("clamps a rate that arrived out of range instead of printing it", () => {
    expect(fractionAsPercent(1.4)).toBe("100%");
    expect(fractionAsPercent(-0.2)).toBe("0%");
  });
});

describe("sentiment is stored signed and displayed converted", () => {
  it("puts a neutral brand mid-track, not at the floor", () => {
    // Rendered as a raw percentage, 0 would read as "0% sentiment" — the
    // worst possible score for the most ordinary possible reading.
    expect(sentimentPercent(0)).toBe(50);
    expect(sentimentPercent(1)).toBe(100);
    expect(sentimentPercent(-1)).toBe(0);
  });

  it("gives a reader words rather than a number between -1 and 1", () => {
    expect(sentimentLabel(0.8)).toBe("Positive");
    expect(sentimentLabel(0)).toBe("Neutral");
    expect(sentimentLabel(-0.8)).toBe("Negative");
  });

  it("says there is no reading rather than calling it neutral", () => {
    // Null means no mentioned run carried a judgement. Neutral is a reading.
    expect(sentimentLabel(null)).toBe("No reading");
  });

  it("clamps rather than running off the track", () => {
    expect(sentimentPercent(4)).toBe(100);
    expect(sentimentPercent(-4)).toBe(0);
  });
});

describe("average position is a place, not a score", () => {
  it("formats so it cannot be read as a score", () => {
    // A bare 2.9 beside a 78 reads as a catastrophe rather than a strong rank.
    expect(positionLabel(2.9)).toBe("#2.9");
    expect(positionLabel(1)).toBe("#1.0");
  });

  it("shows a dash when nothing ranked the brand", () => {
    expect(positionLabel(null)).toBe("—");
  });

  it("inverts a bar so first place is the longest, not the shortest", () => {
    // Plotting the raw number draws the longest bar for the worst rank.
    const first = positionAsBarValue(1);
    const fifth = positionAsBarValue(5);
    const tenth = positionAsBarValue(10);
    expect(first).toBeGreaterThan(fifth);
    expect(fifth).toBeGreaterThan(tenth);
    expect(first).toBe(100);
  });

  it("keeps a worst-case bar visible rather than zero-length", () => {
    // A zero-length bar is indistinguishable from no data.
    expect(positionAsBarValue(50)).toBeGreaterThan(0);
    expect(positionAsBarValue(null)).toBe(0);
  });
});

describe("partial coverage travels with the metric", () => {
  it("says nothing for a complete row", () => {
    expect(coverageNote(toMetricView(row()))).toEqual({ partial: false, label: null });
  });

  it("names how much of the plan actually ran", () => {
    // On the metric, not once at the top of the page: the number is what gets
    // screenshotted into a report.
    const note = coverageNote(
      toMetricView(row({ partialCoverage: true, runCount: 6, skippedRuns: 4 })),
    );
    expect(note.partial).toBe(true);
    expect(note.label).toBe("Partial: 6 of 10 answers collected");
  });

  it("says nothing for a row it cannot interpret at all", () => {
    // An unsupported row has no coverage claim to make.
    expect(coverageNote(toMetricView(row({ scoreVersion: 9 }))).partial).toBe(false);
  });
});

describe("dates", () => {
  it("renders a stored UTC day without moving it", () => {
    // Re-bucketing into local days would put two rows on one date for a tenant
    // west of UTC and none on another. The bucket is the runner's decision.
    expect(formatDay(new Date("2026-08-10T00:00:00.000Z"), "America/Los_Angeles")).toBe("Aug 10");
    expect(formatDay(new Date("2026-08-10T00:00:00.000Z"), "Asia/Tokyo")).toBe("Aug 10");
  });

  it("renders an actual instant in the tenant's zone", () => {
    // A timestamp is a moment, not a bucket, so this one does convert.
    const at = new Date("2026-08-10T23:30:00.000Z");
    expect(formatInstant(at, "Asia/Tokyo")).not.toBe(formatInstant(at, "America/Los_Angeles"));
  });

  it("falls back rather than throwing on a nonsense timezone", () => {
    // A bad tenant timezone must not take a dashboard down.
    expect(formatInstant(new Date("2026-08-10T00:00:00Z"), "Not/AZone")).toContain("2026");
    expect(formatDay(new Date("2026-08-10T00:00:00Z"), "Not/AZone")).toBe("Aug 10");
  });
});

// ── architectural guards ────────────────────────────────────────────────────
//
// Source-level assertions, because these three rules cannot fail a type check
// and would each regress silently in a routine edit. They are cheap and they
// name the failure they prevent.

describe("the dashboard stays read-only", () => {
  /**
   * Source with comments removed.
   *
   * These files EXPLAIN the rules they follow — the drilldown's header says the
   * words "dangerouslySetInnerHTML" in the sentence forbidding it — so a naive
   * substring check fails on the prose that exists to prevent the very thing
   * being checked. Strip the commentary and assert on the code.
   */
  const read = async (path: string) => {
    const source = await (await import("node:fs/promises")).readFile(path, "utf8");
    return source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
  };

  const OVERVIEW = "src/app/(dashboard)/visibility/ai-search/overview-client.tsx";
  const DRILLDOWN = "src/app/(dashboard)/visibility/ai-search/prompts/drilldown-client.tsx";
  const READ = "src/lib/ai-monitor/dashboard/read.ts";

  it("never reads Checkup.visibilityScore onto a watcher screen", async () => {
    // That column is the AUDIT product's number, computed a different way from
    // a different formula. Selecting it here would put two different 0-100
    // scores on one product's screens with no way to tell them apart.
    const source = await read(READ);
    const checkupSelect = source.slice(source.indexOf("readCheckupHistory"));
    expect(checkupSelect).not.toContain("visibilityScore");
  });

  it("never re-scores at render time", async () => {
    // The row was written by the formula current on the day. Recomputing here
    // would silently restate history the first time a weight changed.
    for (const path of [OVERVIEW, DRILLDOWN]) {
      const source = await read(path);
      expect(source).not.toContain("computeScore");
      expect(source).not.toContain("SCORE_WEIGHTS");
      expect(source).not.toContain("from \"@/lib/ai-monitor/metrics\"");
    }
  });

  it("renders a model's answer as text, never as markup", async () => {
    // The string was written by someone else's model quoting pages written by
    // strangers, and it lands in a logged-in dashboard.
    const source = await read(DRILLDOWN);
    expect(source).not.toContain("dangerouslySetInnerHTML");
    // And the thing that keeps it readable without interpreting it.
    expect(source).toContain("whitespace-pre-wrap");
  });

  it("only ever writes a prompt's switch and its tags", async () => {
    // No delete: removing a prompt orphans the runs and analyses its history is
    // computed from. `active: false` stops it being asked and keeps all of it.
    const source = await read("src/app/api/ai-search/prompts/[id]/route.ts");
    expect(source).not.toContain("delete");
    expect(source).toContain("updateMany");
    // Tenant scoping in the WHERE clause, not a check-then-write.
    expect(source).toContain("tenantId: membership.tenantId");
  });
});
