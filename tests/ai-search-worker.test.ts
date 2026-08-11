// tests/ai-search-worker.test.ts
//
// The AI checkup worker's composition: what the sweep enqueues, and what a run
// assembles before it hands over to the runner.
//
// THE RUNNER ITSELF IS MOCKED HERE. Its behaviour is covered exhaustively in
// tests/ai-search-runner.test.ts; what is untested until this file is the layer
// around it — the rollout gate, which checkup counts as "the last one", the
// engines and prompts a run is built from, and whether the per-provider limiter
// is actually bound to the ask port. Every one of those is a place where the
// worker could look completely healthy while doing the wrong thing quietly:
// spending money for tenants behind a flag, re-running a brand every fifteen
// minutes, or issuing unlimited concurrent calls to one vendor.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const addJob = vi.fn();
const findManyBrands = vi.fn();
const findUniqueBrand = vi.fn();
const findManyPrompts = vi.fn();
const updateManyPrompts = vi.fn();
const createCheckup = vi.fn();
const findManyCheckups = vi.fn();
const updateCheckup = vi.fn();
const findManyRuns = vi.fn();
const writeMetricsMock = vi.fn();
const findSubscription = vi.fn();
const runCheckupMock = vi.fn();
const prismaPortsMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    brandProfile: {
      findMany: (...a: unknown[]) => findManyBrands(...a),
      findUnique: (...a: unknown[]) => findUniqueBrand(...a),
    },
    trackedPrompt: {
      findMany: (...a: unknown[]) => findManyPrompts(...a),
      updateMany: (...a: unknown[]) => updateManyPrompts(...a),
    },
    checkup: {
      create: (...a: unknown[]) => createCheckup(...a),
      findMany: (...a: unknown[]) => findManyCheckups(...a),
      update: (...a: unknown[]) => updateCheckup(...a),
    },
    promptRun: { findMany: (...a: unknown[]) => findManyRuns(...a) },
    subscription: { findUnique: (...a: unknown[]) => findSubscription(...a) },
  },
}));

vi.mock("@/infrastructure/queue/registry", () => ({
  addJob: (...a: unknown[]) => addJob(...a),
  getQueue: () => ({ add: () => Promise.resolve() }),
}));

vi.mock("@/infrastructure/redis/connection", () => ({
  getSubscriberConnection: () => ({}),
}));

vi.mock("@/lib/ai-monitor/engine-registry", () => ({
  disabledProviders: async () => new Set<string>(),
}));

vi.mock("@/lib/ai-monitor/runner/ports", () => ({
  prismaPorts: (...a: unknown[]) => prismaPortsMock(...a),
}));

vi.mock("@/lib/ai-monitor/runner/checkup-runner", () => ({
  runCheckup: (...a: unknown[]) => runCheckupMock(...a),
}));

vi.mock("@/lib/ai-monitor/metrics-store", () => ({
  writeVisibilityMetrics: (...a: unknown[]) => writeMetricsMock(...a),
}));

const NOW = new Date("2026-08-10T09:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

type Worker = typeof import("@/infrastructure/queue/workers/ai-checkup.worker");
let mod: Worker;

beforeEach(async () => {
  vi.clearAllMocks();
  // The surface is behind a rollout flag that defaults off; these tests are
  // about what happens once it is on.
  vi.stubEnv("AI_SEARCH_ENABLED", "1");
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  runCheckupMock.mockResolvedValue({
    status: "READY",
    tally: { planned: 2, ok: 2, skippedCap: 0, failed: 0 },
    outcomes: [],
    wroteMetrics: true,
  });
  prismaPortsMock.mockReturnValue({ ask: vi.fn(async () => ({ answer: "hi" })) });
  createCheckup.mockResolvedValue({ id: "checkup_1" });
  // Nothing running and nothing to reap, unless a test says otherwise.
  findManyCheckups.mockResolvedValue([]);
  findManyRuns.mockResolvedValue([]);
  updateCheckup.mockResolvedValue({});
  // No standalone watcher unless a test says so: the tier's shape applies.
  findSubscription.mockResolvedValue(null);
  mod = await import("@/infrastructure/queue/workers/ai-checkup.worker");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const brandRow = (over: Record<string, unknown> = {}) => ({
  id: "brand_1",
  tenantId: "tenant_1",
  tenant: { planType: "GROWTH" },
  checkups: [{ completedAt: new Date(NOW.getTime() - 30 * DAY_MS) }],
  ...over,
});

describe("the sweep", () => {
  it("enqueues one run per due brand", async () => {
    findManyBrands.mockResolvedValue([brandRow()]);
    const enqueued = await mod.__testing.sweep(NOW);

    expect(enqueued).toBe(1);
    expect(addJob).toHaveBeenCalledTimes(1);
    const [queue, jobName, data] = addJob.mock.calls[0];
    expect(queue).toBe("ai-checkup");
    expect(jobName).toBe("run-checkup");
    expect(data).toEqual({ brandProfileId: "brand_1", tenantId: "tenant_1" });
  });

  it("buckets the job id by interval so retention cannot mute a brand", async () => {
    // A bare `checkup:<brand>` inherits this queue's retention: BullMQ ignores
    // `add` for an id that still exists, failed jobs are kept 7 days and
    // completed ones 24h, so one exhausted checkup would silence the brand for
    // a week and a successful one would clip the daily tier.
    findManyBrands.mockResolvedValue([brandRow()]);
    await mod.__testing.sweep(NOW);

    // GROWTH is twice_weekly, so the interval is 3.5 days.
    const bucket = Math.floor(NOW.getTime() / (3.5 * DAY_MS));
    expect(addJob.mock.calls[0][3]).toEqual({ jobId: `checkup:brand_1:${bucket}` });

    // A sweep in the NEXT interval gets a different id, so the enqueue lands
    // even if Redis is still holding the previous record.
    addJob.mockClear();
    findManyBrands.mockResolvedValue([brandRow({ checkups: [] })]);
    await mod.__testing.sweep(new Date(NOW.getTime() + 8 * DAY_MS));
    expect(addJob.mock.calls[0][3].jobId).not.toBe(`checkup:brand_1:${bucket}`);
  });

  it("collapses two sweeps inside one interval onto the same job id", async () => {
    findManyBrands.mockResolvedValue([brandRow()]);
    await mod.__testing.sweep(NOW);
    const first = addJob.mock.calls[0][3].jobId;
    addJob.mockClear();
    await mod.__testing.sweep(new Date(NOW.getTime() + 20 * 60_000));
    expect(addJob.mock.calls[0][3].jobId).toBe(first);
  });

  it("skips a brand whose checkup is genuinely still running", async () => {
    // The real guard against starting a second checkup on a live one; the job
    // id is a first line that lives in Redis, this lives in the same table the
    // runner writes.
    findManyBrands.mockResolvedValue([brandRow()]);
    findManyCheckups.mockResolvedValue([
      { id: "c_live", brandProfileId: "brand_1", startedAt: NOW, promptCount: 2, repetitions: 2, providers: ["CLAUDE"] },
    ]);
    expect(await mod.__testing.sweep(NOW)).toBe(0);
    expect(addJob).not.toHaveBeenCalled();
  });

  it("skips a tenant the rollout flag does not cover", async () => {
    // Spending money for tenants behind a flag is the failure this prevents.
    vi.stubEnv("AI_SEARCH_ENABLED", "");
    vi.stubEnv("AI_SEARCH_TENANT_IDS", "");
    findManyBrands.mockResolvedValue([brandRow()]);

    expect(await mod.__testing.sweep(NOW)).toBe(0);
    expect(addJob).not.toHaveBeenCalled();
  });

  it("covers an allowlisted tenant while the global switch is off", async () => {
    vi.stubEnv("AI_SEARCH_ENABLED", "");
    vi.stubEnv("AI_SEARCH_TENANT_IDS", "tenant_1");
    findManyBrands.mockResolvedValue([brandRow()]);
    expect(await mod.__testing.sweep(NOW)).toBe(1);
  });

  it("counts only finished checkups as satisfying the cadence", async () => {
    // The query asks for READY/PARTIAL. A checkup still RUNNING, or one that
    // FAILED before asking anything, has not covered the interval, and treating
    // it as though it had would drop a brand's coverage for a whole cycle.
    findManyBrands.mockResolvedValue([brandRow()]);
    await mod.__testing.sweep(NOW);
    const where = findManyBrands.mock.calls[0][0].select.checkups.where;
    expect(where.status.in.sort()).toEqual(["PARTIAL", "READY"]);
  });

  it("treats a brand with no finished checkup as due now", async () => {
    findManyBrands.mockResolvedValue([brandRow({ checkups: [] })]);
    expect(await mod.__testing.sweep(NOW)).toBe(1);
  });

  it("leaves a recently-checked brand alone", async () => {
    findManyBrands.mockResolvedValue([brandRow({ checkups: [{ completedAt: NOW }] })]);
    expect(await mod.__testing.sweep(NOW)).toBe(0);
  });

  it("bounds one sweep, draining the rest on the next", async () => {
    // Otherwise one sweep enqueues the whole backlog and every job competes for
    // the same provider slots.
    findManyBrands.mockResolvedValue(
      Array.from({ length: mod.__testing.SWEEP_BATCH + 10 }, (_, i) =>
        brandRow({ id: `brand_${i}`, tenantId: `tenant_${i}` }),
      ),
    );
    expect(await mod.__testing.sweep(NOW)).toBe(mod.__testing.SWEEP_BATCH);
  });

  it("asks the database only for brands that finished their wizard", async () => {
    findManyBrands.mockResolvedValue([]);
    await mod.__testing.sweep(NOW);
    expect(findManyBrands.mock.calls[0][0].where).toEqual({ trackingActive: true });
  });
});

describe("running one brand's checkup", () => {
  const prompts = [
    { id: "p1", text: "best AI visibility tools" },
    { id: "p2", text: "alternatives to Ahrefs" },
  ];

  beforeEach(() => {
    findUniqueBrand.mockResolvedValue({
      id: "brand_1",
      tenantId: "tenant_1",
      name: "Echorank360",
      website: "https://echorank360.com",
      aliases: ["Echo rank"],
      competitors: ["Ahrefs"],
      tenant: { planType: "GROWTH" },
    });
    findManyPrompts.mockResolvedValue(prompts);
  });

  it("creates a checkup carrying the shape it will run", async () => {
    await mod.__testing.runOne({ brandProfileId: "brand_1" }, NOW);

    const data = createCheckup.mock.calls[0][0].data;
    expect(data.providers).toEqual(["CLAUDE"]);
    expect(data.promptCount).toBe(2);
    // GROWTH's tier shape.
    expect(data.repetitions).toBe(2);
  });

  it("plans prompts x engines x tier repetitions", async () => {
    await mod.__testing.runOne({ brandProfileId: "brand_1" }, NOW);
    const args = runCheckupMock.mock.calls[0][0];
    expect(args.slots).toHaveLength(2 * 1 * 2);
    expect(args.day.toISOString()).toBe("2026-08-10T00:00:00.000Z");
    expect(args.plan).toBe("GROWTH");
  });

  it("takes only as many prompts as the tier allows, least recently run first", async () => {
    await mod.__testing.runOne({ brandProfileId: "brand_1" }, NOW);
    const query = findManyPrompts.mock.calls[0][0];
    expect(query.take).toBe(15); // GROWTH
    expect(query.where).toMatchObject({ active: true, selected: true });
    expect(query.orderBy[0]).toEqual({ lastRunAt: "asc" });
  });

  it("creates nothing when no engine can run", async () => {
    // No key, so CLAUDE is unreachable; a Checkup row with nothing to ask would
    // land FAILED and look like a fault rather than a missing API key.
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await mod.__testing.runOne({ brandProfileId: "brand_1" }, NOW);
    expect(createCheckup).not.toHaveBeenCalled();
    expect(runCheckupMock).not.toHaveBeenCalled();
  });

  it("creates nothing when the brand has no selected prompts", async () => {
    findManyPrompts.mockResolvedValue([]);
    await mod.__testing.runOne({ brandProfileId: "brand_1" }, NOW);
    expect(createCheckup).not.toHaveBeenCalled();
  });

  it("does nothing if the brand was deleted between sweep and run", async () => {
    findUniqueBrand.mockResolvedValue(null);
    await expect(mod.__testing.runOne({ brandProfileId: "brand_1" }, NOW)).resolves.toBeUndefined();
    expect(createCheckup).not.toHaveBeenCalled();
  });

  it("passes the brand's aliases and competitors to the analysis", async () => {
    await mod.__testing.runOne({ brandProfileId: "brand_1" }, NOW);
    expect(runCheckupMock.mock.calls[0][0].brand).toEqual({
      brand: "Echorank360",
      domain: "https://echorank360.com",
      brandVariations: ["Echo rank"],
      competitors: ["Ahrefs"],
    });
  });

  it("tells the runner which engines can cite, so citationScore is null not zero", async () => {
    await mod.__testing.runOne({ brandProfileId: "brand_1" }, NOW);
    expect([...runCheckupMock.mock.calls[0][0].citationCapableEngines]).toEqual(["CLAUDE"]);
  });

  it("marks only the prompts that actually answered as run", async () => {
    // A prompt skipped at the spend cap was not sampled, and advancing its
    // lastRunAt would push its next turn out by a whole interval for a question
    // nobody asked.
    runCheckupMock.mockResolvedValue({
      status: "PARTIAL",
      tally: { planned: 4, ok: 1, skippedCap: 3, failed: 0 },
      wroteMetrics: true,
      outcomes: [
        { status: "OK", slot: { promptId: "p1" } },
        { status: "SKIPPED_CAP", slot: { promptId: "p2" } },
      ],
    });

    await mod.__testing.runOne({ brandProfileId: "brand_1" }, NOW);
    expect(updateManyPrompts).toHaveBeenCalledTimes(1);
    expect(updateManyPrompts.mock.calls[0][0].where.id.in).toEqual(["p1"]);
  });

  it("touches no prompt when nothing answered", async () => {
    runCheckupMock.mockResolvedValue({
      status: "FAILED",
      tally: { planned: 2, ok: 0, skippedCap: 2, failed: 0 },
      wroteMetrics: false,
      outcomes: [{ status: "SKIPPED_CAP", slot: { promptId: "p1" } }],
    });
    await mod.__testing.runOne({ brandProfileId: "brand_1" }, NOW);
    expect(updateManyPrompts).not.toHaveBeenCalled();
  });
});

describe("the per-provider limiter", () => {
  beforeEach(() => {
    findUniqueBrand.mockResolvedValue({
      id: "brand_1",
      tenantId: "tenant_1",
      name: "Echorank360",
      website: "https://echorank360.com",
      aliases: [],
      competitors: [],
      tenant: { planType: "GROWTH" },
    });
    findManyPrompts.mockResolvedValue([{ id: "p1", text: "q" }]);
  });

  it("wraps the ask port rather than leaving it unthrottled", async () => {
    // The runner asks one slot at a time, so a single checkup never needs the
    // limiter — what needs it is several checkups in this process reaching for
    // the same vendor. Binding it here is the only thing that makes that true,
    // and an unwrapped ask would look identical in every other test.
    let inFlight = 0;
    let peak = 0;
    const release: (() => void)[] = [];
    prismaPortsMock.mockReturnValue({
      ask: vi.fn(async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise<void>((resolve) => release.push(resolve));
        inFlight -= 1;
        return { answer: "hi" };
      }),
    });

    await mod.__testing.runOne({ brandProfileId: "brand_1" }, NOW);
    const ports = runCheckupMock.mock.calls[0][1];

    // Four concurrent asks at one provider; the default limit is 2.
    const calls = [0, 1, 2, 3].map(() => ports.ask({ engine: "CLAUDE" }));
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(peak).toBe(2);

    while (release.length > 0) {
      release.shift()!();
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    await Promise.all(calls);
    expect(peak).toBe(2);
  });
});

describe("reaping an abandoned checkup", () => {
  // GROWTH: 2 prompts x 1 engine x 2 reps = 4 slots -> 80s expected, so the
  // 15-minute floor is what actually governs here.
  const stale = (over: Record<string, unknown> = {}) => ({
    id: "c_dead",
    brandProfileId: "brand_1",
    startedAt: new Date(NOW.getTime() - 3 * 60 * 60_000),
    promptCount: 2,
    repetitions: 2,
    providers: ["CLAUDE"],
    ...over,
  });

  const okRun = (promptId: string) => ({
    engine: "CLAUDE",
    promptId,
    status: "OK",
    brandMentioned: true,
    analysis: { mentionCount: 1, recommendationPosition: 1, sentiment: "positive" },
    citations: [{ domain: "echorank360.com", citationPosition: 1, supportsBrand: true }],
    competitorMentions: [{ name: "Ahrefs", recommendationPosition: 2 }],
  });

  it("leaves a checkup that is merely slow alone", async () => {
    // Reaping a live checkup would throw away the answers it is still
    // collecting, which is worse than a row that looks stuck for a while.
    findManyCheckups.mockResolvedValue([stale({ startedAt: new Date(NOW.getTime() - 60_000) })]);
    expect(await mod.__testing.reapStale(NOW)).toBe(0);
    expect(updateCheckup).not.toHaveBeenCalled();
  });

  it("finishes a dead checkup as PARTIAL and scores what it paid for", async () => {
    findManyCheckups.mockResolvedValue([stale()]);
    findManyRuns.mockResolvedValue([okRun("p1"), okRun("p2")]);

    expect(await mod.__testing.reapStale(NOW)).toBe(1);

    // The answers were bought; scoring them is the same call the runner makes
    // when a cap cuts a checkup short.
    expect(writeMetricsMock).toHaveBeenCalledTimes(1);
    const [, , engines, coverage] = writeMetricsMock.mock.calls[0];
    expect(engines.map((e: { engine: string }) => e.engine)).toEqual(["CLAUDE"]);
    expect(coverage).toEqual({ partialCoverage: true, skippedRuns: 2 });

    const update = updateCheckup.mock.calls[0][0];
    expect(update.data.status).toBe("PARTIAL");
    expect(update.data.stoppedReason).toMatch(/abandoned: 2 of 4/);
    expect(update.data.completedAt).toEqual(NOW);
  });

  it("finishes a dead checkup that got nothing as FAILED, with no metrics row", async () => {
    // A row of zeroes would put "you are invisible" on the chart for a day the
    // worker died before asking.
    findManyCheckups.mockResolvedValue([stale()]);
    findManyRuns.mockResolvedValue([]);

    expect(await mod.__testing.reapStale(NOW)).toBe(1);
    expect(writeMetricsMock).not.toHaveBeenCalled();
    expect(updateCheckup.mock.calls[0][0].data.status).toBe("FAILED");
  });

  it("counts the PLAN as what was owed, not the rows that happen to exist", async () => {
    // A worker killed before writing a slot left no row at all. Counting only
    // what is there would report full coverage over a third of a checkup.
    findManyCheckups.mockResolvedValue([stale()]);
    findManyRuns.mockResolvedValue([okRun("p1")]);

    await mod.__testing.reapStale(NOW);
    expect(writeMetricsMock.mock.calls[0][3]).toEqual({
      partialCoverage: true,
      skippedRuns: 3,
    });
  });

  it("never scores a run that was skipped or failed", async () => {
    findManyCheckups.mockResolvedValue([stale()]);
    findManyRuns.mockResolvedValue([
      okRun("p1"),
      { ...okRun("p2"), status: "SKIPPED_CAP", brandMentioned: false, analysis: null },
    ]);

    await mod.__testing.reapStale(NOW);
    // One scoreable run of a four-slot plan.
    expect(writeMetricsMock.mock.calls[0][3].skippedRuns).toBe(3);
  });

  it("dates the salvaged metrics to the day the checkup began", async () => {
    // Not the day the reaper happened to run — a checkup that died on Tuesday
    // is Tuesday's data however long the corpse sat there.
    findManyCheckups.mockResolvedValue([
      stale({ startedAt: new Date("2026-08-07T22:00:00Z") }),
    ]);
    findManyRuns.mockResolvedValue([okRun("p1")]);

    await mod.__testing.reapStale(NOW);
    expect((writeMetricsMock.mock.calls[0][1] as Date).toISOString()).toBe(
      "2026-08-07T00:00:00.000Z",
    );
  });

  it("runs before the sweep decides what is due", async () => {
    // So a brand whose checkup died is eligible again on THIS tick rather than
    // waiting another fifteen minutes to be noticed.
    findManyCheckups
      .mockResolvedValueOnce([stale()]) // the reaper's read
      .mockResolvedValueOnce([]); // nothing still in flight afterwards
    findManyRuns.mockResolvedValue([]);
    findManyBrands.mockResolvedValue([brandRow()]);

    expect(await mod.__testing.sweep(NOW)).toBe(1);
    expect(updateCheckup).toHaveBeenCalled();
    expect(addJob).toHaveBeenCalledTimes(1);
  });
});

describe("the checkup shape the worker runs", () => {
  beforeEach(() => {
    findUniqueBrand.mockResolvedValue({
      id: "brand_1",
      tenantId: "tenant_1",
      name: "Echorank360",
      website: "https://echorank360.com",
      aliases: [],
      competitors: [],
      tenant: { planType: "GROWTH" },
    });
    findManyPrompts.mockResolvedValue([{ id: "p1", text: "q", category: "COMPARISON" }]);
  });

  it("uses the tier's shape for a plan tenant", async () => {
    await mod.__testing.runOne({ brandProfileId: "brand_1" }, NOW);
    // GROWTH: 15 prompts, 2 repetitions.
    expect(findManyPrompts.mock.calls[0][0].take).toBe(15);
    expect(createCheckup.mock.calls[0][0].data.repetitions).toBe(2);
  });

  it("composes the field-wise max when a tier tenant also holds a watcher", async () => {
    // STARTER is the case that proves the max: 10 prompts from the tier, but 3
    // repetitions from solo where the tier runs 1. "Plan wins" would have given
    // a paying add-on customer fewer repetitions than the SKU promised.
    findUniqueBrand.mockResolvedValue({
      id: "brand_1",
      tenantId: "tenant_1",
      name: "Echorank360",
      website: "https://echorank360.com",
      aliases: [],
      competitors: [],
      tenant: { planType: "STARTER" },
    });
    findSubscription.mockResolvedValue({ productKind: "WATCHER", status: "ACTIVE" });

    await mod.__testing.runOne({ brandProfileId: "brand_1" }, NOW);
    expect(findManyPrompts.mock.calls[0][0].take).toBe(10);
    expect(createCheckup.mock.calls[0][0].data.repetitions).toBe(3);
  });

  it("never downgrades a plan tenant who also holds a watcher row", async () => {
    findSubscription.mockResolvedValue({ productKind: "WATCHER", status: "ACTIVE" });
    await mod.__testing.runOne({ brandProfileId: "brand_1" }, NOW);
    // GROWTH keeps its 15 prompts, and takes solo's 3 repetitions over its 2.
    // The composite is never weaker than either input on any dimension.
    expect(findManyPrompts.mock.calls[0][0].take).toBe(15);
    expect(createCheckup.mock.calls[0][0].data.repetitions).toBe(3);
  });
});
