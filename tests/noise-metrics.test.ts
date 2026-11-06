// Noise-aware metrics: Wilson intervals, the EWMA Trust Score, the
// lost-recommendation policy and the band on the prompt-trend sparkline.
import { describe, expect, it } from "vitest";
import { ewma, intervalsOverlap, rollingWilson, wilsonInterval } from "@/lib/stats/noise";
import { lostRecommendation, regainedRecommendation } from "@/lib/prompt-alert-policy";
import { trustScoreOf } from "@/lib/visibility-summary";

const T = true;
const F = false;

describe("Wilson 90% interval", () => {
  it("matches the closed form", () => {
    const ci = wilsonInterval(5, 10);
    expect(ci.rate).toBe(0.5);
    expect(ci.low).toBeCloseTo(0.2693, 3);
    expect(ci.high).toBeCloseTo(0.7307, 3);
  });

  it("stays inside [0, 1] at the extremes and is wide at small n", () => {
    const none = wilsonInterval(0, 3);
    expect(none.low).toBe(0);
    expect(none.high).toBeCloseTo(0.474, 2);
    const all = wilsonInterval(3, 3);
    expect(all.high).toBe(1);
    expect(all.low).toBeCloseTo(0.526, 2);
    expect(wilsonInterval(0, 0)).toMatchObject({ low: 0, high: 1, n: 0 });
  });

  it("tells 2 of 3 from 66 of 100", () => {
    const small = wilsonInterval(2, 3);
    const large = wilsonInterval(66, 100);
    expect(small.high - small.low).toBeGreaterThan(3 * (large.high - large.low));
  });

  it("overlap is symmetric", () => {
    expect(intervalsOverlap({ low: 0.1, high: 0.4 }, { low: 0.35, high: 0.9 })).toBe(true);
    expect(intervalsOverlap({ low: 0.1, high: 0.3 }, { low: 0.35, high: 0.9 })).toBe(false);
  });

  it("rolls over a window", () => {
    const band = rollingWilson([T, T, F], 2);
    expect(band.map((b) => b.n)).toEqual([1, 2, 2]);
    expect(band[2].rate).toBe(0.5);
  });
});

describe("EWMA Trust Score", () => {
  it("moves a third of the way per day", () => {
    expect(ewma([1, 0, 0])).toBeCloseTo(0.49, 6);
    expect(ewma([])).toBeNull();
  });

  it("smooths the daily mention rate, oldest day first", () => {
    const day = (d: string, mentioned: boolean) => ({ brandMentioned: mentioned, createdAt: new Date(`${d}T12:00:00Z`) });
    const runs = [
      day("2026-11-03", T), day("2026-11-03", T), // 100%
      day("2026-11-01", F), day("2026-11-01", F), // 0% (older, listed later on purpose)
      day("2026-11-02", T), day("2026-11-02", F), // 50%
    ];
    // 0 -> 0.15 -> 0.405
    expect(trustScoreOf(runs)).toBe(41);
    expect(trustScoreOf([])).toBeNull();
  });
});

describe("lost-recommendation policy", () => {
  it("does not alert on a single miss", () => {
    expect(lostRecommendation([T, T, T], F)).toBeNull();
  });

  it("alerts once the miss persists for a second run", () => {
    expect(lostRecommendation([T, T, T, F], F)).toBe("persisted");
    // ...and not again on the third.
    expect(lostRecommendation([T, T, T, F, F], F)).toBeNull();
  });

  it("alerts on an intermittent decline the persistence rule cannot see", () => {
    // 10 of 10, then alternating: never two misses in a row. The recent five
    // (incl. this run) are 2 of 5, whose interval no longer overlaps 10 of 10.
    const baseline = Array(10).fill(T) as boolean[];
    expect(lostRecommendation([...baseline, F, T, F, T], F)).toBe("interval");
    // The run before, 3 of 5 recent, still overlapped: no alert then.
    expect(lostRecommendation([...baseline, F, T, F], T)).toBeNull();
    expect(lostRecommendation([...baseline, F, T], F)).toBeNull();
  });

  it("fires the interval rule once, not on every run after", () => {
    const baseline = Array(10).fill(T) as boolean[];
    // Next run, another miss after a mention: still declined, but it was
    // declined last run too, so nothing new.
    expect(lostRecommendation([...baseline, F, T, F, T, F, T], F)).toBeNull();
  });

  it("does not report twice what persistence already reported", () => {
    const baseline = Array(10).fill(T) as boolean[];
    expect(lostRecommendation([...baseline, F], F)).toBe("persisted");
    expect(lostRecommendation([...baseline, F, F], F)).toBeNull();
    expect(lostRecommendation([...baseline, F, F, F], F)).toBeNull();
  });

  it("regains only after a loss that persisted", () => {
    expect(regainedRecommendation([T, T, F], T)).toBe(false);
    expect(regainedRecommendation([T, F, F], T)).toBe(true);
    expect(regainedRecommendation([F], T)).toBe(false);
  });
});
