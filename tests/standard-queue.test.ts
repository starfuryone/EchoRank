// The Standard-queue poller — the half of the SERP migration that runs
// unattended and therefore has to be idempotent.
//
// WHY THIS MATTERS FINANCIALLY. SERP Checker and Rank Tracker were moved off the
// Live endpoint ($0.02/query) onto the standard queue: task_post charges once
// (~$0.006 at depth 100), then a worker polls tasks_ready and task_get until the
// result lands. The polling reads are unbilled — tasks_ready genuinely returns a
// $0 envelope, and task_get merely ECHOES the charge already taken at post time.
//
// That echo is the trap this suite guards. If the poller ever metered task_get,
// or fetched one task twice and recorded both, every keyword would be billed
// two or three times over — silently, in a background worker, with no user
// staring at a wrong number. So: the sweep must ask for a given task at most
// once per tick, and must never route a read through the metered client.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const getEndpoint = vi.fn();
/** Metered entry points. Nothing in the poller may ever reach these. */
const postTask = vi.fn();
vi.mock("@/lib/dataforseo/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dataforseo/client")>()),
  getEndpoint: (...a: unknown[]) => getEndpoint(...a),
  postTask: (...a: unknown[]) => postTask(...a),
}));

const seoMeteredCall = vi.fn();
const seoMeteredCallResult = vi.fn();
/** Stamps the SeoApiCall row as having produced a result -> consumes a search. */
const markSeoCallResult = vi.fn(async (..._a: unknown[]) => 1);
// Declared explicitly rather than spread from the real module: metering imports
// prisma at module scope, which needs DATABASE_URL this suite has no business
// requiring. The poller only ever reaches markSeoCallResult; the other two are
// here so the test can assert it never reaches THEM.
vi.mock("@/lib/dataforseo/metering", () => ({
  seoMeteredCall: (...a: unknown[]) => seoMeteredCall(...a),
  seoMeteredCallResult: (...a: unknown[]) => seoMeteredCallResult(...a),
  markSeoCallResult: (...a: unknown[]) => markSeoCallResult(...a),
  recordCall: vi.fn(),
  spentThisMonth: vi.fn(async () => 0),
  monthlyCapUsd: vi.fn(async () => 25),
  seoErrorResponse: vi.fn(),
}));

vi.mock("@/infrastructure/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const {
  sweepStandardQueue,
  DIRECT_GET_AFTER_MS,
  MIN_AGE_MS,
  TASK_TIMEOUT_MS,
} = await import("@/lib/dataforseo/standard-queue");
const { DataforseoError } = await import("@/lib/dataforseo/client");
const { SERP } = await import("@/lib/dataforseo/endpoints");

// ─── A recording stand-in for a queue owner ─────────────────────────────────

interface Row {
  rowId: string;
  taskId: string;
  createdAt: Date;
}

/** Recording stand-in for a StandardQueueOwner. */
function owner(name: string, rows: Row[]) {
  const o = {
    name,
    rows,
    completed: [] as Array<{ rowId: string; result: unknown }>,
    failed: [] as Array<{ rowId: string; message: string }>,
    timeoutStale: vi.fn(async () => 0),
    findPending: vi.fn(async (createdBefore: Date, limit: number) =>
      rows.filter((r) => r.createdAt <= createdBefore).slice(0, limit),
    ),
    complete: vi.fn(async (rowId: string, result: unknown) => {
      o.completed.push({ rowId, result });
    }),
    fail: vi.fn(async (rowId: string, message: string) => {
      o.failed.push({ rowId, message });
    }),
  };
  return o;
}

const NOW = new Date("2026-07-30T15:00:00Z");
/** Old enough for findPending, young enough to skip the direct-get path. */
const eligible = new Date(NOW.getTime() - MIN_AGE_MS - 1_000);
/** Old enough that a tasks_ready miss triggers the direct task_get. */
const stale = new Date(NOW.getTime() - DIRECT_GET_AFTER_MS - 1_000);

/** tasks_ready payload; anything else is a task_get. */
function readyList(ids: string[]) {
  return { data: ids.map((id) => ({ id })), billing: { path: [], costUsd: 0 } };
}
function taskGetResult() {
  return { data: [{ items: [] }], billing: { path: [], costUsd: 0 } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Idempotency ────────────────────────────────────────────────────────────
describe("the sweep asks for each task at most once per tick", () => {
  it("does not re-fetch a task it already collected from the ready list", async () => {
    // The row is old enough to also qualify for the direct-get pass. Without
    // the `attempted` guard it would be fetched twice in one tick.
    const o = owner("serp", [{ rowId: "r1", taskId: "t1", createdAt: stale }]);
    getEndpoint.mockImplementation(async (path: string) =>
      path === SERP.organicTasksReady ? readyList(["t1"]) : taskGetResult(),
    );

    const stats = await sweepStandardQueue([o], NOW);

    const gets = getEndpoint.mock.calls.filter(
      (c) => c[0] !== SERP.organicTasksReady,
    );
    expect(gets).toHaveLength(1);
    expect(gets[0][0]).toBe(`${SERP.organicTaskGet}/t1`);
    expect(o.complete).toHaveBeenCalledTimes(1);
    expect(stats.collected).toBe(1);
  });

  it("fetches once when the same id appears twice in the ready list", async () => {
    const o = owner("serp", [{ rowId: "r1", taskId: "t1", createdAt: eligible }]);
    getEndpoint.mockImplementation(async (path: string) =>
      path === SERP.organicTasksReady ? readyList(["t1", "t1"]) : taskGetResult(),
    );

    await sweepStandardQueue([o], NOW);

    // Second mention resolves to the same row, which was already attempted.
    expect(o.complete).toHaveBeenCalledTimes(1);
  });

  it("does not re-ask a task that reported 'in queue' this tick", async () => {
    // A not-yet-done task must be left for the NEXT tick, not retried by the
    // direct-get pass in the same one.
    const o = owner("serp", [{ rowId: "r1", taskId: "t1", createdAt: stale }]);
    getEndpoint.mockImplementation(async (path: string) => {
      if (path === SERP.organicTasksReady) return readyList(["t1"]);
      throw new DataforseoError("Task In Queue.", "TASK_FAILED");
    });

    const stats = await sweepStandardQueue([o], NOW);

    const gets = getEndpoint.mock.calls.filter((c) => c[0] !== SERP.organicTasksReady);
    expect(gets).toHaveLength(1);
    expect(o.complete).not.toHaveBeenCalled();
    expect(o.fail).not.toHaveBeenCalled(); // still cooking, not a failure
    expect(stats.collected).toBe(0);
  });

  it("direct-fetches a stale row the ready list never mentioned — once", async () => {
    const o = owner("serp", [{ rowId: "r1", taskId: "t1", createdAt: stale }]);
    getEndpoint.mockImplementation(async (path: string) =>
      path === SERP.organicTasksReady ? readyList([]) : taskGetResult(),
    );

    const stats = await sweepStandardQueue([o], NOW);

    const gets = getEndpoint.mock.calls.filter((c) => c[0] !== SERP.organicTasksReady);
    expect(gets).toHaveLength(1);
    expect(o.complete).toHaveBeenCalledTimes(1);
    expect(stats.retried).toBe(1);
  });

  it("leaves a young unmentioned row alone entirely", async () => {
    // Nothing is gained by asking about a task DataForSEO has barely received.
    const o = owner("serp", [{ rowId: "r1", taskId: "t1", createdAt: eligible }]);
    getEndpoint.mockImplementation(async (path: string) =>
      path === SERP.organicTasksReady ? readyList([]) : taskGetResult(),
    );

    await sweepStandardQueue([o], NOW);

    const gets = getEndpoint.mock.calls.filter((c) => c[0] !== SERP.organicTasksReady);
    expect(gets).toHaveLength(0);
    expect(o.complete).not.toHaveBeenCalled();
  });

  it("routes each id to its owning table only", async () => {
    const serp = owner("serp", [{ rowId: "s1", taskId: "t-serp", createdAt: eligible }]);
    const rank = owner("rank", [{ rowId: "k1", taskId: "t-rank", createdAt: eligible }]);
    getEndpoint.mockImplementation(async (path: string) =>
      path === SERP.organicTasksReady ? readyList(["t-rank"]) : taskGetResult(),
    );

    await sweepStandardQueue([serp, rank], NOW);

    expect(rank.complete).toHaveBeenCalledTimes(1);
    expect(serp.complete).not.toHaveBeenCalled();
  });
});

// ─── The poller must never bill ─────────────────────────────────────────────
describe("the poller never spends", () => {
  it("reads through the unmetered client, never the metered one", async () => {
    // task_get's envelope echoes the task_post charge. Metering it would bill
    // every keyword twice.
    const o = owner("serp", [{ rowId: "r1", taskId: "t1", createdAt: stale }]);
    getEndpoint.mockImplementation(async (path: string) =>
      path === SERP.organicTasksReady ? readyList(["t1"]) : taskGetResult(),
    );

    await sweepStandardQueue([o], NOW);

    expect(seoMeteredCall).not.toHaveBeenCalled();
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    expect(postTask).not.toHaveBeenCalled();
  });

  it("spends nothing on an empty tick", async () => {
    const o = owner("serp", []);
    await sweepStandardQueue([o], NOW);
    expect(getEndpoint).not.toHaveBeenCalled();
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });
});

// ─── Failure handling ───────────────────────────────────────────────────────
describe("failures and timeouts", () => {
  it("fails a row on a real upstream error rather than retrying forever", async () => {
    const o = owner("serp", [{ rowId: "r1", taskId: "t1", createdAt: stale }]);
    getEndpoint.mockImplementation(async (path: string) => {
      if (path === SERP.organicTasksReady) return readyList(["t1"]);
      throw new DataforseoError("Invalid Field: keyword", "INVALID_FIELD");
    });

    await sweepStandardQueue([o], NOW);

    expect(o.failed).toHaveLength(1);
    expect(o.failed[0].rowId).toBe("r1");
  });

  it("times rows out well inside DataForSEO's own 24h task expiry", async () => {
    // Once the upstream task expires the id is unfetchable, so a row must be
    // surfaced as failed long before then rather than sitting queued forever.
    expect(TASK_TIMEOUT_MS).toBeLessThan(24 * 60 * 60 * 1000);
    const o = owner("serp", []);
    await sweepStandardQueue([o], NOW);
    expect(o.timeoutStale).toHaveBeenCalledTimes(1);
    // The mock is declared without parameters, so read the recorded call
    // through unknown rather than widening the stub's signature.
    const [cutoff] = o.timeoutStale.mock.calls[0] as unknown as [Date];
    expect(NOW.getTime() - cutoff.getTime()).toBe(TASK_TIMEOUT_MS);
  });

  it("still runs the direct-get pass when tasks_ready is down", async () => {
    const o = owner("serp", [{ rowId: "r1", taskId: "t1", createdAt: stale }]);
    getEndpoint.mockImplementation(async (path: string) => {
      if (path === SERP.organicTasksReady) throw new Error("upstream 503");
      return taskGetResult();
    });

    const stats = await sweepStandardQueue([o], NOW);

    expect(o.complete).toHaveBeenCalledTimes(1);
    expect(stats.retried).toBe(1);
  });

  it("keeps going when one owner's findPending throws", async () => {
    const broken = owner("broken", []);
    broken.findPending.mockRejectedValue(new Error("db down"));
    const ok = owner("serp", [{ rowId: "r1", taskId: "t1", createdAt: eligible }]);
    getEndpoint.mockImplementation(async (path: string) =>
      path === SERP.organicTasksReady ? readyList(["t1"]) : taskGetResult(),
    );

    await sweepStandardQueue([broken, ok], NOW);

    expect(ok.complete).toHaveBeenCalledTimes(1);
  });
});

// ─── Search-quota credit ────────────────────────────────────────────────────
describe("crediting the pooled search quota", () => {
  it("credits the search only when a result actually lands", async () => {
    const o = owner("serp", [{ rowId: "r1", taskId: "t1", createdAt: stale }]);
    getEndpoint.mockImplementation(async (path: string) =>
      path === SERP.organicTasksReady ? readyList(["t1"]) : taskGetResult(),
    );

    await sweepStandardQueue([o], NOW);

    expect(markSeoCallResult).toHaveBeenCalledTimes(1);
    expect(markSeoCallResult).toHaveBeenCalledWith("t1");
  });

  it("does NOT credit a task that is still queued", async () => {
    // Billed at task_post, but the tenant has no answer yet — charging a search
    // now would take one for something they may never receive.
    const o = owner("serp", [{ rowId: "r1", taskId: "t1", createdAt: stale }]);
    getEndpoint.mockImplementation(async (path: string) => {
      if (path === SERP.organicTasksReady) return readyList(["t1"]);
      throw new DataforseoError("Task In Queue.", "TASK_FAILED");
    });

    await sweepStandardQueue([o], NOW);

    expect(markSeoCallResult).not.toHaveBeenCalled();
  });

  it("does NOT credit a task that failed outright", async () => {
    const o = owner("serp", [{ rowId: "r1", taskId: "t1", createdAt: stale }]);
    getEndpoint.mockImplementation(async (path: string) => {
      if (path === SERP.organicTasksReady) return readyList(["t1"]);
      throw new DataforseoError("Invalid Field: keyword", "INVALID_FIELD");
    });

    await sweepStandardQueue([o], NOW);

    expect(o.failed).toHaveLength(1);
    expect(markSeoCallResult).not.toHaveBeenCalled();
  });

  it("credits once when a duplicate id appears in one ready list", async () => {
    const o = owner("serp", [{ rowId: "r1", taskId: "t1", createdAt: eligible }]);
    getEndpoint.mockImplementation(async (path: string) =>
      path === SERP.organicTasksReady ? readyList(["t1", "t1"]) : taskGetResult(),
    );

    await sweepStandardQueue([o], NOW);

    expect(markSeoCallResult).toHaveBeenCalledTimes(1);
  });
});
