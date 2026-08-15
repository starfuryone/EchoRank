// tests/opportunity-scanner-worker.test.ts
//
// The worker's decisions, none of which are about scanning: the retry rule, the
// spend ordering, and who fires the completion notification.
//
// THE RETRY RULE IS THE ONE WORTH TESTING. ScanBatch.done is incremented by the
// same transaction that writes a row's terminal state, so writing that state on
// a non-final attempt would count the row twice when the retry succeeded — a
// batch that reports 1,004 of 1,000 and fires its notification four rows early.
// That bug is invisible in a small batch and permanent in a large one.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { store, sidecar, places, notify, prismaFns, loggerFns, addJob } = vi.hoisted(() => ({
  store: {
    completeRow: vi.fn(),
    failRow: vi.fn(),
    markRowRunning: vi.fn(),
    queuedRows: vi.fn(),
  },
  sidecar: { sidecarPost: vi.fn() },
  places: { lookupPlace: vi.fn() },
  notify: { notifyScanComplete: vi.fn() },
  prismaFns: { scanBatch: { findUnique: vi.fn() } },
  loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  addJob: vi.fn(),
}));

vi.mock("@/lib/opportunity-scanner/store", () => store);
vi.mock("@/lib/av-sidecar", () => sidecar);
vi.mock("@/lib/opportunity-scanner/places", () => places);
vi.mock("@/lib/notifications/adapters", () => notify);
vi.mock("@/lib/prisma", () => ({ prisma: prismaFns }));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));
vi.mock("@/infrastructure/queue/registry", () => ({ addJob, getQueue: vi.fn() }));
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: vi.fn(),
  getSubscriberConnection: vi.fn(),
}));
vi.mock("bullmq", () => ({ Worker: class {} }));

import {
  processOpportunityScanJob,
  fanOut,
  scanRow,
  CONCURRENCY,
  AUDIT_TIMEOUT_MS,
} from "@/infrastructure/queue/workers/opportunity-scan.worker";

const TENANT = "tenant_a";
const BATCH = "batch_1";

/** A BullMQ job envelope, only the fields the processor reads. */
function job(data: Record<string, unknown>, attemptsMade = 0, attempts = 2) {
  return { data, attemptsMade, opts: { attempts } } as never;
}

const OK_AUDIT = {
  status: 200,
  data: {
    score: 41,
    checks: [
      ["Rendering", 0, 15, "CSR shell", "Server-render it."],
      ["Structured data", 6, 20, "No JSON-LD", "Add it."],
      ["Sitemap", 5, 5, "Present", ""],
    ],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaFns.scanBatch.findUnique.mockResolvedValue({ tenantId: TENANT, placesEnabled: false });
  store.markRowRunning.mockResolvedValue(undefined);
  store.completeRow.mockResolvedValue({ batchComplete: false, total: 3, done: 1 });
  store.failRow.mockResolvedValue({ batchComplete: false, total: 3, done: 1 });
  places.lookupPlace.mockResolvedValue({ place: null, costUsd: 0, reason: "disabled" });
  sidecar.sidecarPost.mockResolvedValue(OK_AUDIT);
});

// ═══ Configuration ══════════════════════════════════════════════════════════

describe("worker configuration", () => {
  it("runs four rows at once, which the sidecar can now actually serve", () => {
    expect(CONCURRENCY).toBe(4);
  });

  it("allows longer than the sidecar's own worst case before giving up", () => {
    // Four sequential fetches at TIMEOUT=12 is 48s. Anything under that would
    // fail a slow-but-alive prospect, which is the false negative that makes an
    // agency skip a real lead.
    expect(AUDIT_TIMEOUT_MS).toBeGreaterThan(48_000);
  });
});

// ═══ Fan-out ════════════════════════════════════════════════════════════════

describe("fanOut", () => {
  it("enqueues one job per queued row, keyed so a replay cannot double it", async () => {
    store.queuedRows.mockResolvedValue([
      { id: "r1", domain: "a.com" },
      { id: "r2", domain: "b.com" },
    ]);

    expect(await fanOut(BATCH)).toBe(2);
    expect(addJob).toHaveBeenCalledTimes(2);
    expect(addJob.mock.calls[0]).toEqual([
      "opportunity-scan",
      "row",
      { rowId: "r1", domain: "a.com", batchId: BATCH },
      { jobId: "scan-row:r1" },
    ]);
  });

  it("enqueues nothing for a batch with no queued rows", async () => {
    store.queuedRows.mockResolvedValue([]);
    expect(await fanOut(BATCH)).toBe(0);
    expect(addJob).not.toHaveBeenCalled();
  });

  it("is routed by the fanOut flag on the job", async () => {
    store.queuedRows.mockResolvedValue([]);
    await processOpportunityScanJob(job({ fanOut: true, batchId: BATCH }));
    expect(store.queuedRows).toHaveBeenCalledWith(BATCH);
  });
});

// ═══ Scanning one row ═══════════════════════════════════════════════════════

describe("scanRow", () => {
  it("asks the sidecar for a PASSIVE audit — never a crawl", async () => {
    await scanRow({ rowId: "r1", domain: "example.com", batchId: BATCH });
    expect(sidecar.sidecarPost).toHaveBeenCalledWith(
      "/audit",
      { url: "example.com", crawl: false },
      { timeoutMs: AUDIT_TIMEOUT_MS },
    );
  });

  it("bands the grade and stores the three worst checks", async () => {
    await scanRow({ rowId: "r1", domain: "example.com", batchId: BATCH });
    expect(store.completeRow).toHaveBeenCalledWith({
      batchId: BATCH,
      rowId: "r1",
      score: 41,
      grade: "D",
      topGaps: [
        { category: "Structured data", status: "No JSON-LD", recommendation: "Add it.", lost: 14 },
        { category: "Rendering", status: "CSR shell", recommendation: "Server-render it.", lost: 15 },
      ].sort((a, b) => b.lost - a.lost || a.category.localeCompare(b.category)),
      place: null,
      // No lookup ran in this fixture, so nothing was billed and the row's
      // credit goes back at batch completion. Distinct from `place: null`,
      // which a lookup that ran and found nothing also produces.
      placesCharged: false,
    });
  });

  it("re-reads the spending flag from the batch, never from the job payload", async () => {
    prismaFns.scanBatch.findUnique.mockResolvedValue({ tenantId: TENANT, placesEnabled: true });
    // A forged payload claiming the opposite must not be believed.
    await scanRow({ rowId: "r1", domain: "example.com", batchId: BATCH, placesEnabled: false });
    expect(places.lookupPlace).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, tenantId: TENANT }),
    );
  });

  it("BUYS NOTHING when the audit fails — the ordering that makes retries free", async () => {
    sidecar.sidecarPost.mockResolvedValue({ status: 502, data: { error: "unreachable" } });

    await expect(scanRow({ rowId: "r1", domain: "dead.com", batchId: BATCH })).rejects.toThrow(
      "unreachable",
    );
    expect(places.lookupPlace).not.toHaveBeenCalled();
    expect(store.completeRow).not.toHaveBeenCalled();
  });

  it("throws on a 200 that carries no numeric score", async () => {
    sidecar.sidecarPost.mockResolvedValue({ status: 200, data: { checks: [] } });
    await expect(scanRow({ rowId: "r1", domain: "x.com", batchId: BATCH })).rejects.toThrow();
    expect(places.lookupPlace).not.toHaveBeenCalled();
  });

  it("returns quietly when the batch was deleted before the row ran", async () => {
    prismaFns.scanBatch.findUnique.mockResolvedValue(null);
    await expect(scanRow({ rowId: "r1", domain: "a.com", batchId: BATCH })).resolves.toBeUndefined();
    expect(sidecar.sidecarPost).not.toHaveBeenCalled();
  });

  it("rejects a malformed job rather than scanning something undefined", async () => {
    await expect(scanRow({ rowId: "r1", batchId: BATCH })).rejects.toThrow();
    await expect(scanRow({ domain: "a.com", batchId: BATCH })).rejects.toThrow();
    await expect(scanRow({ rowId: "r1", domain: "a.com" })).rejects.toThrow();
  });

  it("attaches a Places result to the row when the batch bought one", async () => {
    prismaFns.scanBatch.findUnique.mockResolvedValue({ tenantId: TENANT, placesEnabled: true });
    places.lookupPlace.mockResolvedValue({
      place: { name: "Acme", rating: 4.1, reviewCount: 40 },
      costUsd: 0.032,
    });
    await scanRow({ rowId: "r1", domain: "acme.com", batchId: BATCH });
    expect(store.completeRow.mock.calls[0][0].place).toEqual({
      name: "Acme", rating: 4.1, reviewCount: 40,
    });
  });
});

// ═══ Completion notification ════════════════════════════════════════════════

describe("completion notification", () => {
  it("fires only for the row that finished the batch", async () => {
    store.completeRow.mockResolvedValue({ batchComplete: true, total: 3, done: 3 });
    await scanRow({ rowId: "r3", domain: "c.com", batchId: BATCH });
    expect(notify.notifyScanComplete).toHaveBeenCalledWith({
      tenantId: TENANT, batchId: BATCH, total: 3, done: 3,
    });
  });

  it("stays silent while rows remain", async () => {
    store.completeRow.mockResolvedValue({ batchComplete: false, total: 3, done: 2 });
    await scanRow({ rowId: "r2", domain: "b.com", batchId: BATCH });
    expect(notify.notifyScanComplete).not.toHaveBeenCalled();
  });

  it("still fires when the LAST row is the one that failed", async () => {
    sidecar.sidecarPost.mockResolvedValue({ status: 502, data: { error: "dead" } });
    store.failRow.mockResolvedValue({ batchComplete: true, total: 2, done: 2 });

    await processOpportunityScanJob(
      job({ rowId: "r2", domain: "dead.com", batchId: BATCH }, 1, 2),
    );

    // A progress bar that never reaches the end is worse than a batch that
    // reports its failures.
    expect(notify.notifyScanComplete).toHaveBeenCalledWith({
      tenantId: TENANT, batchId: BATCH, total: 2, done: 2,
    });
  });
});

// ═══ The retry rule ═════════════════════════════════════════════════════════

describe("retry handling", () => {
  it("RETHROWS on a non-final attempt so BullMQ retries, and writes nothing", async () => {
    sidecar.sidecarPost.mockResolvedValue({ status: 502, data: { error: "blip" } });

    await expect(
      processOpportunityScanJob(job({ rowId: "r1", domain: "a.com", batchId: BATCH }, 0, 2)),
    ).rejects.toThrow("blip");

    // The critical assertion: done must NOT have been incremented, or the
    // successful retry would count this row twice.
    expect(store.failRow).not.toHaveBeenCalled();
  });

  it("records the terminal failure on the final attempt, and does not rethrow", async () => {
    sidecar.sidecarPost.mockResolvedValue({ status: 502, data: { error: "still dead" } });

    await expect(
      processOpportunityScanJob(job({ rowId: "r1", domain: "a.com", batchId: BATCH }, 1, 2)),
    ).resolves.toBeUndefined();

    expect(store.failRow).toHaveBeenCalledWith({
      batchId: BATCH, rowId: "r1", error: "still dead",
    });
  });

  it("treats a single-attempt policy as immediately final", async () => {
    sidecar.sidecarPost.mockResolvedValue({ status: 500, data: {} });
    await processOpportunityScanJob(job({ rowId: "r1", domain: "a.com", batchId: BATCH }, 0, 1));
    expect(store.failRow).toHaveBeenCalled();
  });

  it("rethrows rather than swallowing when the job has no row to fail", async () => {
    await expect(
      processOpportunityScanJob(job({ batchId: BATCH }, 1, 2)),
    ).rejects.toThrow();
    expect(store.failRow).not.toHaveBeenCalled();
  });

  it("a successful retry completes the row exactly once", async () => {
    // Attempt 1 fails and writes nothing.
    sidecar.sidecarPost.mockResolvedValueOnce({ status: 502, data: { error: "blip" } });
    await expect(
      processOpportunityScanJob(job({ rowId: "r1", domain: "a.com", batchId: BATCH }, 0, 2)),
    ).rejects.toThrow();

    // Attempt 2 succeeds.
    sidecar.sidecarPost.mockResolvedValueOnce(OK_AUDIT);
    await processOpportunityScanJob(job({ rowId: "r1", domain: "a.com", batchId: BATCH }, 1, 2));

    expect(store.completeRow).toHaveBeenCalledTimes(1);
    expect(store.failRow).not.toHaveBeenCalled();
  });
});
