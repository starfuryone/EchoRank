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
    checkup: { create: (...a: unknown[]) => createCheckup(...a) },
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

  it("gives each brand a stable job id, so a slow checkup is not re-enqueued", async () => {
    // The sweep runs every 15 minutes. Without this, a checkup taking longer
    // than that is queued again and again — the runner's idempotency key stops
    // the RUNS doubling, but each duplicate job still creates a Checkup row.
    findManyBrands.mockResolvedValue([brandRow()]);
    await mod.__testing.sweep(NOW);
    expect(addJob.mock.calls[0][3]).toEqual({ jobId: "checkup:brand_1" });
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
