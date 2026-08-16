// tests/assistant-pro-precompute.test.ts
//
// Phase 7: the weekly summary's arithmetic, and the heuristics that read it.
//
// ── THE LOAD-BEARING TESTS IN THIS FILE ────────────────────────────────────
//
//   TWO EQUAL WINDOWS. The summary compares seven days against the seven
//   before them. Comparing "the last week" against "everything before it" is
//   the mistake that makes every established account look like it is
//   collapsing, and it looks perfectly plausible on a chart.
//
//   ERRORED RUNS ARE NOT MISSES. A run that failed measured nothing. Counting
//   it as "brand not mentioned" turns an outage on OUR side into a visibility
//   drop on the CUSTOMER's chart.
//
//   NO-DATA IS ITS OWN ANSWER. An account with no runs must produce "there is
//   nothing to explain yet", never a 0% score with a story attached.
//
//   THE HEURISTICS NEVER CLAIM CAUSATION. They may say two things moved in the
//   same week. They may not say one caused the other.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, redis, store } = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    prisma: {
      promptRun: { findMany: vi.fn() },
      competitor: { findMany: vi.fn() },
      visibilityAudit: { findMany: vi.fn() },
    },
    redis: {
      get: vi.fn(async (k: string) => store.get(k) ?? null),
      // Variadic: writeCache calls set(key, value, "EX", ttl), and a
      // two-parameter fake makes the TTL unassertable.
      set: vi.fn(async (...args: unknown[]) => {
        store.set(String(args[0]), String(args[1]));
        return "OK";
      }),
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => redis }));
vi.mock("@/infrastructure/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const {
  computeIntelligence,
  intelligenceKey,
  readIntelligence,
  rootCauses,
  writeIntelligence,
} = await import("@/lib/assistant/pro/precompute");

const NOW = new Date("2026-08-16T12:00:00.000Z");
const THIS_WEEK = new Date("2026-08-13T12:00:00.000Z");
const LAST_WEEK = new Date("2026-08-06T12:00:00.000Z");

function run(promptId: string, at: Date, mentioned: boolean, text = "best dentist in Zurich") {
  return { promptId, brandMentioned: mentioned, createdAt: at, prompt: { text } };
}

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  prisma.promptRun.findMany.mockResolvedValue([]);
  prisma.competitor.findMany.mockResolvedValue([]);
  prisma.visibilityAudit.findMany.mockResolvedValue([]);
});

// ─── The windows ────────────────────────────────────────────────────────────

describe("the weekly delta", () => {
  it("compares two equal seven-day windows", async () => {
    prisma.promptRun.findMany.mockResolvedValue([
      run("p1", THIS_WEEK, true),
      run("p1", THIS_WEEK, false),
      run("p1", LAST_WEEK, true),
      run("p1", LAST_WEEK, true),
    ]);
    const summary = await computeIntelligence("tenant-a", NOW);
    expect(summary.visibility.thisWeek).toEqual({ runs: 2, mentioned: 1, rate: 50 });
    expect(summary.visibility.lastWeek).toEqual({ runs: 2, mentioned: 2, rate: 100 });
    expect(summary.visibility.delta).toBe(-50);
  });

  it("only reads runs from the last two weeks", async () => {
    await computeIntelligence("tenant-a", NOW);
    const where = prisma.promptRun.findMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe("tenant-a");
    // Exactly 14 days back, not "everything".
    const since = where.createdAt.gte as Date;
    expect(NOW.getTime() - since.getTime()).toBe(14 * 24 * 60 * 60 * 1000);
  });

  it("excludes errored runs, so our outage is not their drop", async () => {
    await computeIntelligence("tenant-a", NOW);
    expect(prisma.promptRun.findMany.mock.calls[0][0].where.error).toBeNull();
  });

  it("reports no delta when either window is empty", async () => {
    prisma.promptRun.findMany.mockResolvedValue([run("p1", THIS_WEEK, true)]);
    const summary = await computeIntelligence("tenant-a", NOW);
    expect(summary.visibility.delta).toBeNull();
  });
});

// ─── Winners and losers ─────────────────────────────────────────────────────

describe("prompt movement", () => {
  it("ignores prompts with too few runs to mean anything", async () => {
    // One run against one run is a coin flip rendered as a 100-point swing.
    prisma.promptRun.findMany.mockResolvedValue([
      run("p1", THIS_WEEK, true),
      run("p1", LAST_WEEK, false),
    ]);
    const summary = await computeIntelligence("tenant-a", NOW);
    expect(summary.winners).toEqual([]);
    expect(summary.losers).toEqual([]);
  });

  it("ranks winners best first and losers worst first", async () => {
    const runs = [
      // p1: 0% -> 100%
      ...[0, 1, 2].map(() => run("p1", LAST_WEEK, false, "cheap dentist")),
      ...[0, 1, 2].map(() => run("p1", THIS_WEEK, true, "cheap dentist")),
      // p2: 100% -> 0%
      ...[0, 1, 2].map(() => run("p2", LAST_WEEK, true, "emergency dentist")),
      ...[0, 1, 2].map(() => run("p2", THIS_WEEK, false, "emergency dentist")),
    ];
    prisma.promptRun.findMany.mockResolvedValue(runs);
    const summary = await computeIntelligence("tenant-a", NOW);

    expect(summary.winners[0].question).toBe("cheap dentist");
    expect(summary.winners[0].delta).toBe(100);
    expect(summary.losers[0].question).toBe("emergency dentist");
    expect(summary.losers[0].delta).toBe(-100);
  });
});

// ─── Root causes ────────────────────────────────────────────────────────────

describe("root-cause heuristics", () => {
  const base = {
    computedAt: NOW.toISOString(),
    windowDays: 7 as const,
    visibility: {
      thisWeek: { runs: 10, mentioned: 5, rate: 50 },
      lastWeek: { runs: 10, mentioned: 7, rate: 70 },
      delta: -20,
    },
    winners: [],
    losers: [],
    competitors: [],
    audit: { score: null, previousScore: null, changed: false, at: null },
  };

  it("says there is nothing to explain when there is no data", () => {
    const causes = rootCauses({
      ...base,
      visibility: {
        thisWeek: { runs: 0, mentioned: 0, rate: null },
        lastWeek: { runs: 0, mentioned: 0, rate: null },
        delta: null,
      },
    });
    expect(causes).toHaveLength(1);
    expect(causes[0].id).toBe("no_data");
  });

  it("blames missing measurement, not lost visibility, when tracking stopped", () => {
    const causes = rootCauses({
      ...base,
      visibility: {
        thisWeek: { runs: 0, mentioned: 0, rate: null },
        lastWeek: { runs: 10, mentioned: 7, rate: 70 },
        delta: null,
      },
    });
    expect(causes[0].id).toBe("tracking_paused");
    expect(causes[0].evidence).toMatch(/missing measurement/i);
  });

  it("distinguishes a concentrated drop from a broad one", () => {
    const concentrated = rootCauses({
      ...base,
      losers: [
        {
          question: "emergency dentist",
          thisWeek: { runs: 5, mentioned: 0, rate: 0 },
          lastWeek: { runs: 5, mentioned: 5, rate: 100 },
          delta: -100,
        },
      ],
    });
    expect(concentrated[0].id).toBe("prompt_losses_concentrated");

    const broad = rootCauses(base);
    expect(broad.map((c) => c.id)).toContain("broad_visibility_drop");
  });

  it("observes competitor movement without claiming it caused anything", () => {
    const causes = rootCauses({
      ...base,
      competitors: [{ name: "Rival Dental", ratingChange: 0.2, reviewChange: 40 }],
    });
    const surge = causes.find((c) => c.id === "competitor_review_surge");
    expect(surge).toBeDefined();
    expect(surge!.evidence).toMatch(/not shown to be the cause/i);
    // No cause anywhere in the set asserts causation.
    for (const cause of causes) {
      expect(cause.evidence).not.toMatch(/\bcaused by\b|\bbecause of\b|\bdue to\b/i);
    }
  });

  it("ranks an audit regression above an audit improvement", () => {
    const worse = rootCauses({
      ...base,
      audit: { score: 40, previousScore: 70, changed: true, at: NOW.toISOString() },
    });
    const better = rootCauses({
      ...base,
      audit: { score: 90, previousScore: 70, changed: true, at: NOW.toISOString() },
    });
    const scoreOf = (causes: ReturnType<typeof rootCauses>, id: string) =>
      causes.find((c) => c.id === id)!.score;
    expect(scoreOf(worse, "audit_regressed")).toBeGreaterThan(
      scoreOf(better, "audit_improved"),
    );
  });

  it("returns causes ordered by score, biggest signal first", () => {
    const causes = rootCauses({
      ...base,
      audit: { score: 40, previousScore: 70, changed: true, at: NOW.toISOString() },
      competitors: [{ name: "Rival Dental", ratingChange: 0.2, reviewChange: 40 }],
    });
    const scores = causes.map((c) => c.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
});

// ─── Storage ────────────────────────────────────────────────────────────────

describe("the summary cache", () => {
  it("is keyed per tenant", () => {
    expect(intelligenceKey("tenant-a")).not.toBe(intelligenceKey("tenant-b"));
    expect(intelligenceKey("tenant-a")).toContain("tenant-a");
  });

  it("round-trips, and carries its own computedAt so staleness is visible", async () => {
    const summary = await computeIntelligence("tenant-a", NOW);
    await writeIntelligence("tenant-a", summary);
    const read = await readIntelligence("tenant-a");
    expect(read?.computedAt).toBe(NOW.toISOString());
  });

  it("expires rather than answering with month-old numbers", async () => {
    await writeIntelligence("tenant-a", await computeIntelligence("tenant-a", NOW));
    const [, , mode, ttl] = redis.set.mock.calls[0];
    expect(mode).toBe("EX");
    // Two weekly cadences of slack: one missed night degrades, three weeks
    // expires.
    expect(ttl).toBe(14 * 24 * 60 * 60);
  });

  it("returns null rather than throwing when Redis is unreachable", async () => {
    redis.get.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect(await readIntelligence("tenant-a")).toBeNull();
  });
});
