// GA4 report builders + date-window maths.
//
// ⚠ PROVENANCE: the fixtures in fixtures/ga4/ are SYNTHETIC, built from
// Google's documented Data API v1beta runReport shape — NOT recorded
// responses. No GA4 property was available (the integration had never been
// connected), so these assertions pin MY UNDERSTANDING of the response shape,
// not the shape itself. Re-record against a real property once connected and
// reconcile. Every other integration in this repo had at least one silently
// wrong field layout that only a live response caught.
//
// Zero network.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runReport = vi.fn<(...a: unknown[]) => Promise<unknown>>();
vi.mock("@/lib/ga/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ga/client")>()),
  runReport: (...a: unknown[]) => runReport(...a),
}));

const {
  buildChannels,
  buildHeadline,
  buildPages,
  buildReferrers,
  buildTraffic,
} = await import("@/lib/ga/reports");
const { percentChange, windowsFor, isGaRange } = await import("@/lib/ga/options");

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), "fixtures", "ga4", `${name}.json`), "utf8"));
}

const TOKEN = "ya29.fake";
const PROPERTY = "properties/300000001";
const WINDOW = { startDate: "2026-07-01", endDate: "2026-07-28" };
const PREV = { startDate: "2026-06-03", endDate: "2026-06-30" };

beforeEach(() => {
  runReport.mockReset();
});

// ─── Date windows ───────────────────────────────────────────────────────────

describe("windowsFor", () => {
  const NOW = new Date("2026-07-29T09:00:00Z");

  it("ends YESTERDAY, because today is a partial day in GA4", () => {
    // Including today makes every metric look like it collapsed.
    const { current } = windowsFor(28, NOW);
    expect(current.endDate).toBe("2026-07-28");
  });

  it("makes the comparison window the same length, immediately before", () => {
    const { current, previous } = windowsFor(7, NOW);
    expect(current).toEqual({ startDate: "2026-07-22", endDate: "2026-07-28" });
    expect(previous).toEqual({ startDate: "2026-07-15", endDate: "2026-07-21" });
    // Contiguous and equal length, or the % change is comparing unlike things.
    const days = (w: { startDate: string; endDate: string }) =>
      (Date.parse(w.endDate) - Date.parse(w.startDate)) / 86_400_000;
    expect(days(current)).toBe(days(previous));
  });

  it.each([7, 28, 90] as const)("spans exactly %i days", (range) => {
    const { current } = windowsFor(range, NOW);
    const span = (Date.parse(current.endDate) - Date.parse(current.startDate)) / 86_400_000;
    expect(span + 1).toBe(range);
  });

  it("only accepts the three offered ranges", () => {
    expect(isGaRange(7)).toBe(true);
    expect(isGaRange(28)).toBe(true);
    expect(isGaRange(90)).toBe(true);
    expect(isGaRange(30)).toBe(false);
    expect(isGaRange("28")).toBe(false);
  });
});

describe("percentChange", () => {
  it("computes change against the previous window", () => {
    expect(percentChange(120, 100)).toBeCloseTo(20, 6);
    expect(percentChange(80, 100)).toBeCloseTo(-20, 6);
  });

  it("returns null on a zero baseline rather than infinity", () => {
    // "First traffic ever" is not "+∞%".
    expect(percentChange(50, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });
});

// ─── Headline ───────────────────────────────────────────────────────────────

describe("buildHeadline", () => {
  it("reads totals for both windows and computes the change", async () => {
    runReport
      .mockResolvedValueOnce(fixture("headline-current"))
      .mockResolvedValueOnce(fixture("headline-previous"));

    const headline = await buildHeadline(TOKEN, PROPERTY, WINDOW, PREV);
    const byKey = Object.fromEntries(headline.map((m) => [m.key, m]));

    expect(byKey.sessions.value).toBe(4820);
    expect(byKey.sessions.previous).toBe(4100);
    expect(byKey.sessions.change).toBeCloseTo(17.56, 1);
    // Engagement rate fell, so its change must be negative.
    expect(byKey.engagementRate.change!).toBeLessThan(0);
  });

  it("returns all six metrics in a stable order", async () => {
    runReport
      .mockResolvedValueOnce(fixture("headline-current"))
      .mockResolvedValueOnce(fixture("headline-previous"));
    const headline = await buildHeadline(TOKEN, PROPERTY, WINDOW, PREV);
    expect(headline.map((m) => m.key)).toEqual([
      "sessions",
      "totalUsers",
      "newUsers",
      "engagementRate",
      "avgEngagementTime",
      "conversions",
    ]);
  });

  it("reads values by metricHeaders position, not request order", async () => {
    // GA4 is free to reorder; assuming the request order silently swaps
    // sessions and users.
    runReport.mockResolvedValue({
      metricHeaders: [{ name: "totalUsers" }, { name: "sessions" }],
      totals: [{ metricValues: [{ value: "999" }, { value: "111" }] }],
    });
    const headline = await buildHeadline(TOKEN, PROPERTY, WINDOW, PREV);
    const byKey = Object.fromEntries(headline.map((m) => [m.key, m]));
    expect(byKey.sessions.value).toBe(111);
    expect(byKey.totalUsers.value).toBe(999);
  });

  it("retries without keyEvents when the property rejects it", async () => {
    // Properties on the old schema expose `conversions`, not `keyEvents`.
    // Mocked BEHAVIOURALLY, not by call order: the two windows are fetched
    // concurrently, so both first attempts fire before either retry.
    runReport.mockImplementation(async (_t, _p, body) => {
      const metrics = (body as { metrics: { name: string }[] }).metrics;
      if (metrics.some((m) => m.name === "keyEvents")) {
        throw new Error("Field keyEvents is not a valid metric. INVALID_ARGUMENT");
      }
      return fixture("headline-no-keyevents");
    });

    const headline = await buildHeadline(TOKEN, PROPERTY, WINDOW, PREV);
    const conversions = headline.find((m) => m.key === "conversions")!;

    // Reported as unavailable, NOT as a zero — "no key events configured" and
    // "zero key events" are different answers.
    expect(conversions.unavailable).toBe(true);
    expect(conversions.change).toBeNull();
    // The rest of the panel still works.
    expect(headline.find((m) => m.key === "sessions")!.value).toBe(4820);
  });

  it("rethrows errors that are not an unknown-field rejection", async () => {
    runReport.mockRejectedValue(new Error("runReport failed: 500 boom"));
    await expect(buildHeadline(TOKEN, PROPERTY, WINDOW, PREV)).rejects.toThrow(/500/);
  });
});

// ─── Traffic ────────────────────────────────────────────────────────────────

describe("buildTraffic", () => {
  it("converts GA4's compact date into ISO and sorts ascending", async () => {
    runReport.mockResolvedValue(fixture("traffic"));
    const points = await buildTraffic(TOKEN, PROPERTY, WINDOW);

    expect(points).toHaveLength(28);
    for (const point of points) expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const dates = points.map((p) => p.date);
    expect([...dates].sort()).toEqual(dates);
    expect(points[0].date).toBe("2026-07-01");
  });

  it("keeps zero-traffic days so the chart does not close the gap", async () => {
    runReport.mockResolvedValue(fixture("traffic"));
    const points = await buildTraffic(TOKEN, PROPERTY, WINDOW);
    // The fixture has two deliberate zero days.
    expect(points.filter((p) => p.sessions === 0)).toHaveLength(2);
  });

  it("asks GA4 to keep empty rows", async () => {
    runReport.mockResolvedValue(fixture("traffic"));
    await buildTraffic(TOKEN, PROPERTY, WINDOW);
    expect((runReport.mock.calls[0][2] as { keepEmptyRows?: boolean }).keepEmptyRows).toBe(true);
  });

  it("survives an empty property", async () => {
    runReport.mockResolvedValue(fixture("empty"));
    expect(await buildTraffic(TOKEN, PROPERTY, WINDOW)).toEqual([]);
  });
});

// ─── Channels ───────────────────────────────────────────────────────────────

describe("buildChannels", () => {
  it("computes each share against the visible total", async () => {
    runReport.mockResolvedValue(fixture("channels"));
    const channels = await buildChannels(TOKEN, PROPERTY, WINDOW);

    expect(channels[0].channel).toBe("Organic Search");
    const total = channels.reduce((n, c) => n + c.sessions, 0);
    expect(channels[0].share).toBeCloseTo(2110 / total, 6);
    // Bars must add up to what is on screen, not to a number that is not.
    expect(channels.reduce((n, c) => n + c.share, 0)).toBeCloseTo(1, 6);
  });

  it("labels an unnamed channel rather than rendering a blank row", async () => {
    runReport.mockResolvedValue({
      metricHeaders: [{ name: "sessions" }],
      rows: [{ dimensionValues: [{ value: "" }], metricValues: [{ value: "5" }] }],
    });
    const channels = await buildChannels(TOKEN, PROPERTY, WINDOW);
    expect(channels[0].channel).toBe("Unassigned");
  });

  it("survives an empty property", async () => {
    runReport.mockResolvedValue(fixture("empty"));
    expect(await buildChannels(TOKEN, PROPERTY, WINDOW)).toEqual([]);
  });
});

// ─── Pages ──────────────────────────────────────────────────────────────────

describe("buildPages", () => {
  it("reads views, sessions and engagement per path", async () => {
    runReport.mockResolvedValue(fixture("pages"));
    const pages = await buildPages(TOKEN, PROPERTY, WINDOW);

    expect(pages[0].path).toBe("/");
    expect(pages[0].views).toBe(1800);
    expect(pages[0].engagementRate).toBeGreaterThan(0);
    expect(pages[0].engagementRate).toBeLessThanOrEqual(1);
  });

  it("drops rows with no path", async () => {
    runReport.mockResolvedValue({
      metricHeaders: [{ name: "screenPageViews" }],
      rows: [{ dimensionValues: [{ value: "" }], metricValues: [{ value: "9" }] }],
    });
    expect(await buildPages(TOKEN, PROPERTY, WINDOW)).toEqual([]);
  });
});

// ─── Referrers ──────────────────────────────────────────────────────────────

describe("buildReferrers", () => {
  it("filters to the Referral channel only", async () => {
    runReport.mockResolvedValue(fixture("referrers"));
    await buildReferrers(TOKEN, PROPERTY, WINDOW);

    // Without the filter the list is dominated by "google" and "(direct)",
    // which the acquisition panel already covers.
    const body = runReport.mock.calls[0][2] as { dimensionFilter?: Record<string, unknown> };
    expect(JSON.stringify(body.dimensionFilter)).toContain("Referral");
    expect(JSON.stringify(body.dimensionFilter)).toContain("sessionDefaultChannelGroup");
  });

  it("returns sources ordered by sessions", async () => {
    runReport.mockResolvedValue(fixture("referrers"));
    const referrers = await buildReferrers(TOKEN, PROPERTY, WINDOW);
    expect(referrers[0].source).toBe("reddit.com");
    const counts = referrers.map((r) => r.sessions);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it("survives an empty property", async () => {
    runReport.mockResolvedValue(fixture("empty"));
    expect(await buildReferrers(TOKEN, PROPERTY, WINDOW)).toEqual([]);
  });
});

// ─── Value coercion ─────────────────────────────────────────────────────────

describe("GA4 string metric values", () => {
  it("coerces every metric from the string GA4 actually returns", async () => {
    // GA4 returns "4820", not 4820 — a missing coercion yields NaN or string
    // concatenation in every total.
    runReport.mockResolvedValue({
      metricHeaders: [{ name: "sessions" }, { name: "totalUsers" }],
      rows: [
        { dimensionValues: [{ value: "20260701" }], metricValues: [{ value: "10" }, { value: "8" }] },
      ],
    });
    const points = await buildTraffic(TOKEN, PROPERTY, WINDOW);
    expect(points[0].sessions).toBe(10);
    expect(typeof points[0].sessions).toBe("number");
  });

  it("treats a malformed value as zero rather than NaN", async () => {
    runReport.mockResolvedValue({
      metricHeaders: [{ name: "sessions" }, { name: "totalUsers" }],
      rows: [
        { dimensionValues: [{ value: "20260701" }], metricValues: [{ value: "oops" }, {}] },
      ],
    });
    const points = await buildTraffic(TOKEN, PROPERTY, WINDOW);
    expect(points[0].sessions).toBe(0);
    expect(points[0].users).toBe(0);
  });
});
