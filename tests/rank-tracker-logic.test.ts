// Rank Tracker pure logic: keyword parsing, position extraction, the weekly
// due-date rule, and the shared standard-queue dispatcher.
//
// The dispatcher test is the important one. `tasks_ready` is a DRAIN — reading
// it consumes the ids — so the sweep MUST hand each id to the owner that
// claims it. If SERP Checker and Rank Tracker ever poll it independently, each
// silently eats the other's completions. These tests pin that contract.
//
// Zero network, zero database, zero spend.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseKeywords } from "@/lib/rank-tracker/keywords";
import { domainMatches, extractPosition } from "@/lib/rank-tracker/position";
import { isDue, selectDueProjects, weekdayAnchor } from "@/lib/rank-tracker/schedule";

// ─── Keyword parsing ────────────────────────────────────────────────────────

describe("parseKeywords", () => {
  it("splits on newlines, trims, and collapses inner whitespace", () => {
    const { keywords } = parseKeywords("  plumber   toronto \n drain cleaning \n");
    expect(keywords).toEqual(["plumber toronto", "drain cleaning"]);
  });

  it("lowercases and dedupes case-insensitively — Google returns one SERP", () => {
    const { keywords, duplicates } = parseKeywords("Plumber Toronto\nplumber toronto\nPLUMBER TORONTO");
    expect(keywords).toEqual(["plumber toronto"]);
    // Two duplicates cost nothing instead of 2 x $0.0006 for identical data.
    expect(duplicates).toBe(2);
  });

  it("ignores blank lines without counting them as dropped", () => {
    const { keywords, dropped } = parseKeywords("a keyword\n\n\n   \nanother one");
    expect(keywords).toEqual(["a keyword", "another one"]);
    expect(dropped).toBe(0);
  });

  it("drops keywords past DataForSEO's 200-character limit", () => {
    const { keywords, dropped } = parseKeywords(`ok keyword\n${"x".repeat(201)}`);
    expect(keywords).toEqual(["ok keyword"]);
    expect(dropped).toBe(1);
  });

  it("returns nothing for empty input", () => {
    expect(parseKeywords("").keywords).toEqual([]);
    expect(parseKeywords("   \n  ").keywords).toEqual([]);
  });
});

// ─── Position extraction ────────────────────────────────────────────────────

function serpResult(items: { type: string; rank_group: number; domain?: string; url?: string }[]) {
  return [{ keyword: "test", item_types: ["organic", "people_also_ask"], items }];
}

describe("extractPosition", () => {
  it("returns the best organic position and the URL holding it", () => {
    const result = serpResult([
      { type: "organic", rank_group: 1, domain: "rival.com", url: "https://rival.com/" },
      { type: "organic", rank_group: 4, domain: "example.com", url: "https://example.com/pricing" },
      { type: "organic", rank_group: 9, domain: "example.com", url: "https://example.com/blog" },
    ]);
    const extracted = extractPosition(result, "example.com");
    expect(extracted.position).toBe(4);
    expect(extracted.url).toBe("https://example.com/pricing");
  });

  it("returns null — not 0, not 101 — when the domain is absent", () => {
    const result = serpResult([
      { type: "organic", rank_group: 1, domain: "rival.com", url: "https://rival.com/" },
    ]);
    const extracted = extractPosition(result, "example.com");
    // null is a RESULT ("not in the top 100"), and the column is nullable so
    // the chart can show the gap instead of implying a position we never saw.
    expect(extracted.position).toBeNull();
    expect(extracted.url).toBeNull();
  });

  it("ignores non-organic elements even when they carry the domain", () => {
    const result = serpResult([
      { type: "paid", rank_group: 1, domain: "example.com", url: "https://example.com/ad" },
      { type: "organic", rank_group: 7, domain: "example.com", url: "https://example.com/" },
    ]);
    expect(extractPosition(result, "example.com").position).toBe(7);
  });

  it("captures the SERP features present on the page", () => {
    const result = serpResult([
      { type: "organic", rank_group: 1, domain: "example.com", url: "https://example.com/" },
    ]);
    expect(extractPosition(result, "example.com").serpFeatures).toEqual(["people_also_ask"]);
  });

  it("survives an empty or malformed result", () => {
    expect(extractPosition([], "example.com").position).toBeNull();
    expect(extractPosition([{}], "example.com").position).toBeNull();
  });
});

describe("domainMatches", () => {
  it.each([
    ["example.com", "example.com", true],
    ["www.example.com", "example.com", true],
    ["https://example.com/path", "example.com", true],
    ["blog.example.com", "example.com", true], // subdomains count
    ["example.com", "www.example.com", true],
    ["notexample.com", "example.com", false], // no bare suffix match
    ["example.com.evil.net", "example.com", false],
    ["example.co.uk", "example.com", false],
    ["", "example.com", false],
  ])("%j vs %j -> %s", (candidate, target, expected) => {
    expect(domainMatches(candidate, target)).toBe(expected);
  });
});

// ─── Scheduling ─────────────────────────────────────────────────────────────

/** 2026-07-28 is a Tuesday (UTC). */
const TUESDAY = new Date("2026-07-28T06:00:00Z");
const WEDNESDAY = new Date("2026-07-29T06:00:00Z");

function project(overrides: Partial<Parameters<typeof isDue>[0]> = {}) {
  return {
    id: "p1",
    frequency: "daily",
    active: true,
    createdAt: TUESDAY,
    lastRunAt: null,
    ...overrides,
  };
}

describe("scheduling", () => {
  it("runs daily projects on every tick", () => {
    expect(isDue(project({ frequency: "daily" }), TUESDAY)).toBe(true);
    expect(isDue(project({ frequency: "daily" }), WEDNESDAY)).toBe(true);
  });

  it("runs weekly projects only on their createdAt weekday", () => {
    // Created on a Tuesday -> due Tuesdays, not Wednesdays.
    const weekly = project({ frequency: "weekly", createdAt: TUESDAY });
    expect(weekdayAnchor(TUESDAY)).toBe(2); // 0 = Sunday
    expect(isDue(weekly, TUESDAY)).toBe(true);
    expect(isDue(weekly, WEDNESDAY)).toBe(false);
    // A week later, that Tuesday comes round again.
    expect(isDue(weekly, new Date("2026-08-04T06:00:00Z"))).toBe(true);
  });

  it("spreads weekly projects across the week by their anchor", () => {
    const tue = project({ id: "tue", frequency: "weekly", createdAt: TUESDAY });
    const wed = project({ id: "wed", frequency: "weekly", createdAt: WEDNESDAY });
    expect(selectDueProjects([tue, wed], TUESDAY).map((p) => p.id)).toEqual(["tue"]);
    expect(selectDueProjects([tue, wed], WEDNESDAY).map((p) => p.id)).toEqual(["wed"]);
  });

  it("never runs an inactive project", () => {
    expect(isDue(project({ active: false }), TUESDAY)).toBe(false);
  });

  it("does not run twice in one UTC day, even if the tick is retried", () => {
    const ranEarlier = project({ lastRunAt: new Date("2026-07-28T06:00:05Z") });
    expect(isDue(ranEarlier, new Date("2026-07-28T18:00:00Z"))).toBe(false);
    // The next day it is due again.
    expect(isDue(ranEarlier, WEDNESDAY)).toBe(true);
  });

  it("skips an unrecognised cadence rather than guessing and spending", () => {
    expect(isDue(project({ frequency: "hourly" }), TUESDAY)).toBe(false);
  });
});

// ─── Shared standard-queue dispatch ─────────────────────────────────────────

const readyIds = vi.fn();
const taskGet = vi.fn();

vi.mock("@/lib/dataforseo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dataforseo/client")>();
  return {
    ...actual,
    getEndpoint: (path: string) =>
      path.includes("tasks_ready")
        ? Promise.resolve({ data: readyIds(), billing: { path: [], costUsd: 0 } })
        : Promise.resolve({ data: taskGet(path), billing: { path: [], costUsd: 0 } }),
  };
});

const { sweepStandardQueue } = await import("@/lib/dataforseo/standard-queue");
type Owner = Parameters<typeof sweepStandardQueue>[0][number];

/** A recording stand-in for one table's stake in the queue. */
function fakeOwner(name: string, pending: { rowId: string; taskId: string }[]): Owner & {
  completed: string[];
  failed: string[];
} {
  const completed: string[] = [];
  const failed: string[] = [];
  return {
    name,
    completed,
    failed,
    timeoutStale: async () => 0,
    findPending: async () =>
      pending.map((p) => ({ ...p, createdAt: new Date("2026-07-28T12:00:00Z") })),
    complete: async (rowId: string) => {
      completed.push(rowId);
    },
    fail: async (rowId: string) => {
      failed.push(rowId);
    },
  };
}

describe("standard-queue dispatch", () => {
  beforeEach(() => {
    readyIds.mockReset();
    taskGet.mockReset();
  });

  it("routes each ready id to the owner that claims it — ids never cross", async () => {
    readyIds.mockReturnValue([{ id: "task_serp" }, { id: "task_rank" }]);
    taskGet.mockReturnValue([{ items: [] }]);

    const serp = fakeOwner("serp-check", [{ rowId: "serp_row", taskId: "task_serp" }]);
    const rank = fakeOwner("rank-snapshot", [{ rowId: "rank_row", taskId: "task_rank" }]);

    // The sweep is deliberately run at a time where nothing is old enough for
    // the direct-get fallback, so this asserts the ready-list path alone.
    await sweepStandardQueue([serp, rank], new Date("2026-07-28T12:01:00Z"));

    expect(serp.completed).toEqual(["serp_row"]);
    expect(rank.completed).toEqual(["rank_row"]);
    // Neither owner saw the other's row.
    expect(serp.completed).not.toContain("rank_row");
    expect(rank.completed).not.toContain("serp_row");
  });

  it("reads tasks_ready exactly once for all owners (it is a drain)", async () => {
    readyIds.mockReturnValue([]);
    const serp = fakeOwner("serp-check", [{ rowId: "s1", taskId: "t1" }]);
    const rank = fakeOwner("rank-snapshot", [{ rowId: "r1", taskId: "t2" }]);

    await sweepStandardQueue([serp, rank], new Date("2026-07-28T12:01:00Z"));

    // One read, not one per owner — a second reader would consume ids the
    // first owner still needed.
    expect(readyIds).toHaveBeenCalledTimes(1);
  });

  it("ignores ready ids that belong to neither owner", async () => {
    readyIds.mockReturnValue([{ id: "someone_elses_task" }]);
    const rank = fakeOwner("rank-snapshot", [{ rowId: "r1", taskId: "t_rank" }]);

    await sweepStandardQueue([rank], new Date("2026-07-28T12:01:00Z"));

    expect(rank.completed).toEqual([]);
    expect(rank.failed).toEqual([]);
  });

  it("keeps sweeping other owners when one owner's lookup throws", async () => {
    readyIds.mockReturnValue([{ id: "task_rank" }]);
    taskGet.mockReturnValue([{ items: [] }]);

    const broken: Owner = {
      name: "broken",
      timeoutStale: async () => 0,
      findPending: async () => {
        throw new Error("db down");
      },
      complete: async () => {},
      fail: async () => {},
    };
    const rank = fakeOwner("rank-snapshot", [{ rowId: "rank_row", taskId: "task_rank" }]);

    await sweepStandardQueue([broken, rank], new Date("2026-07-28T12:01:00Z"));

    expect(rank.completed).toEqual(["rank_row"]);
  });

  it("falls back to a direct task_get for rows the ready list never mentioned", async () => {
    readyIds.mockReturnValue([]); // the id was drained by something else
    taskGet.mockReturnValue([{ items: [] }]);

    const rank = fakeOwner("rank-snapshot", [{ rowId: "rank_row", taskId: "task_rank" }]);
    // 10 minutes on — past DIRECT_GET_AFTER_MS.
    await sweepStandardQueue([rank], new Date("2026-07-28T12:10:00Z"));

    expect(rank.completed).toEqual(["rank_row"]);
  });
});
