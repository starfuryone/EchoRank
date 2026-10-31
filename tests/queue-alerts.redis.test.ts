// tests/queue-alerts.redis.test.ts
//
// Against a real, DISPOSABLE Redis with real BullMQ (skipped unless
// QUEUE_TEST_REDIS_URL is set; never point it at a server with data):
//   1. the two nightly sweeps that died on "Custom Id cannot contain :" now
//      run end to end: the sweep job enqueues its rollups and they run;
//   2. a job that fails for good is found by the failure alert even when
//      `removeOnFail: true` deleted it, because the alert reads the events
//      stream and not the failed set.
//
//   redis-server --port 63799 --save '' --daemonize yes
//   QUEUE_TEST_REDIS_URL=redis://127.0.0.1:63799 npx vitest run tests/queue-alerts.redis.test.ts

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const URL = process.env.QUEUE_TEST_REDIS_URL;

const { listCitationBrandProfiles, rollUpBrandProfile, listTenantIds, writeRollups } = vi.hoisted(() => ({
  listCitationBrandProfiles: vi.fn(),
  rollUpBrandProfile: vi.fn(),
  listTenantIds: vi.fn(),
  writeRollups: vi.fn(),
}));
vi.mock("@/lib/citations/store", () => ({ listCitationBrandProfiles, rollUpBrandProfile }));
vi.mock("@/lib/revenue/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revenue/store")>()),
  listTenantIds,
  writeRollups,
}));
vi.mock("@/infrastructure/observability/logger", () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: () => logger };
  return { logger };
});

/** Resolves once `n` calls have been made to `fn`, or rejects after `ms`. */
function calls(fn: ReturnType<typeof vi.fn>, n: number, ms = 15_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const t = setInterval(() => {
      if (fn.mock.calls.length >= n) {
        clearInterval(t);
        resolve();
      } else if (Date.now() - start > ms) {
        clearInterval(t);
        reject(new Error(`only ${fn.mock.calls.length}/${n} calls after ${ms} ms`));
      }
    }, 50);
  });
}

describe.skipIf(!URL)("queues against a real Redis", () => {
  let registry: typeof import("@/infrastructure/queue/registry");
  const stop: Array<() => Promise<void>> = [];

  beforeAll(async () => {
    process.env.REDIS_URL = URL;
    const { getRedisConnection } = await import("@/infrastructure/redis/connection");
    const r = getRedisConnection();
    // Refuse anything that is not empty: this test flushes it at the end.
    expect(await r.dbsize()).toBe(0);
    registry = await import("@/infrastructure/queue/registry");
  });

  afterAll(async () => {
    for (const s of stop) await s();
    const { getRedisConnection, shutdownRedis } = await import("@/infrastructure/redis/connection");
    await getRedisConnection().flushdb();
    await registry.closeAllQueues();
    await shutdownRedis();
  });

  it("citation-aggregation: the sweep enqueues and runs a rollup per brand", async () => {
    const w = await import("@/infrastructure/queue/workers/citation-aggregation.worker");
    listCitationBrandProfiles.mockResolvedValue([
      { brandProfileId: "bp1", tenantId: "t1" },
      { brandProfileId: "bp2", tenantId: "t1" },
    ]);
    rollUpBrandProfile.mockResolvedValue({ citations: 3, domains: 2 });
    w.startCitationAggregationWorker();
    stop.push(w.stopCitationAggregationWorker);

    // What the repeatable tick enqueues.
    await registry.addJob("citation-aggregation", "sweep", { sweep: true });
    await calls(rollUpBrandProfile, 2);
    const ids = (await registry.getQueue("citation-aggregation").getJobs(["completed"])).map((j) => j.id);
    expect(ids).toEqual(expect.arrayContaining([expect.stringMatching(/^citations-bp1-\d{4}-\d{2}-\d{2}$/)]));
  });

  it("revenue-rollup: the sweep enqueues and runs a rollup per tenant-month", async () => {
    const w = await import("@/infrastructure/queue/workers/revenue-rollup.worker");
    listTenantIds.mockResolvedValue(["t1", "t2"]);
    writeRollups.mockResolvedValue({ mode: "proxy", leads: 0, written: 4 });
    w.startRevenueRollupWorker();
    stop.push(w.stopRevenueRollupWorker);

    await registry.addJob("revenue-rollup", "sweep", { sweep: true });
    const months = w.monthsToRoll(new Date()).length;
    await calls(writeRollups, 2 * months);
  });

  it("the old ids are what BullMQ refused", async () => {
    await expect(
      registry.addJob("citation-aggregation", "rollup", {}, { jobId: "citations:bp1" }),
    ).rejects.toThrow("Custom Id cannot contain :");
  });

  it("the failure alert finds a job that failed for good and was removed on failure", async () => {
    const { Worker } = await import("bullmq");
    const { getSubscriberConnection } = await import("@/infrastructure/redis/connection");
    const { REDIS_CONFIG } = await import("@/infrastructure/redis/config");
    const { realQueueAlertDeps } = await import("@/infrastructure/queue/failure-alert");
    const { runQueueFailureAlert } = await import("@/lib/queue-alerts");

    const failedFinal = vi.fn();
    const worker = new Worker(
      "visibility-monitoring",
      async () => {
        throw new Error("all 25 prompts errored; first: overloaded");
      },
      { connection: getSubscriberConnection(), prefix: REDIS_CONFIG.queues.prefix },
    );
    worker.on("failed", (job) => {
      if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) failedFinal();
    });
    stop.push(() => worker.close());

    await registry.addJob(
      "visibility-monitoring",
      "run-prompt-batch",
      { promptTenantId: "t1" },
      { jobId: "pt-seed-t1-1", attempts: 2, backoff: { type: "fixed", delay: 10 }, removeOnComplete: true, removeOnFail: true },
    );
    await calls(failedFinal, 1);
    await new Promise((r) => setTimeout(r, 200));

    const queue = registry.getQueue("visibility-monitoring");
    expect(await queue.getJob("pt-seed-t1-1")).toBeUndefined(); // gone from Redis…
    expect((await queue.getJobCounts("failed")).failed).toBe(0); // …and from the failed count

    const send = vi.fn().mockResolvedValue(true);
    const result = await runQueueFailureAlert({ ...realQueueAlertDeps(), send });
    expect(result.sent).toBe(true);
    const group = result.groups.find((g) => g.queue === "visibility-monitoring");
    // One final failure, not one per attempt.
    expect(group).toMatchObject({ count: 1, jobIds: ["pt-seed-t1-1"] });
    expect(group?.reason).toContain("all 25 prompts errored");
    expect(send.mock.calls[0][0]).toMatch(/^\[Echorank360\] \d+ failed jobs?/);
  });
});
