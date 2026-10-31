// tests/prompt-batch-errors.test.ts
//
// The sidecar answers /track with HTTP 200 and a per-prompt `error` when the
// provider call fails. The batch used to store those, push every prompt a day
// out, meter all of them, log "Prompt batch complete … mentioned: 0" and
// complete — indistinguishable from 25 honest "not mentioned" answers.

import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  trackedPrompt: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  tenant: { findUnique: vi.fn() },
  visibilityMonitor: { findMany: vi.fn() },
  brandProfile: { findMany: vi.fn() },
  promptRun: { findMany: vi.fn(), create: vi.fn() },
}));
const { sidecarPost, record, checkQuota, log } = vi.hoisted(() => ({
  sidecarPost: vi.fn(),
  record: vi.fn(),
  checkQuota: vi.fn(),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("bullmq", async (importOriginal) => ({
  ...(await importOriginal<typeof import("bullmq")>()),
  Worker: class {},
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/generated/prisma", () => ({ Prisma: {} }));
vi.mock("@/lib/av-sidecar", () => ({ sidecarPost }));
vi.mock("@/infrastructure/metering/service", () => ({ meteringService: { record, checkQuota } }));
vi.mock("@/lib/visibility-alerts", () => ({ sendVisibilityAlert: vi.fn(), recordPromptAlerts: vi.fn() }));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: log }));
vi.mock("@/infrastructure/observability/telemetry", () => ({ withSpan: (_n: string, f: () => unknown) => f() }));
vi.mock("@/infrastructure/queue/registry", () => ({ addJob: vi.fn(), getQueue: vi.fn() }));
vi.mock("@/infrastructure/redis/connection", () => ({ getSubscriberConnection: () => ({}) }));

import { UnrecoverableError } from "bullmq";
import { processPromptBatch } from "@/infrastructure/queue/workers/visibility-monitoring.worker";

const HOUR = 3600_000;
const prompts = ["p1", "p2", "p3"].map((id) => ({ id, text: `prompt ${id}` }));
const result = (id: string, error: string | null, mentioned = false) => ({
  id,
  prompt: `prompt ${id}`,
  brand_mentioned: mentioned,
  brand_rank: mentioned ? 1 : null,
  competitors: [],
  excerpt: error ? "" : "an answer",
  error,
  model: "claude-haiku-4-5",
});

/** When each prompt was pushed out to, in hours from now (rounded). */
const pushedOutHours = () =>
  Object.fromEntries(
    db.trackedPrompt.update.mock.calls.map(([arg]) => [
      arg.where.id,
      Math.round((arg.data.nextRunAt.getTime() - Date.now()) / HOUR),
    ]),
  );

beforeEach(() => {
  vi.clearAllMocks();
  db.trackedPrompt.findMany.mockResolvedValue(prompts);
  db.tenant.findUnique.mockResolvedValue({ name: "Owner Co" });
  db.visibilityMonitor.findMany.mockResolvedValue([]);
  db.brandProfile.findMany.mockResolvedValue([{ name: "Echorank360", aliases: ["Echorank"] }]);
  db.promptRun.findMany.mockResolvedValue([]);
  checkQuota.mockResolvedValue({ allowed: true });
});

describe("prompt batch with provider errors", () => {
  it("a healthy batch: every prompt waits a day, every answer is metered", async () => {
    sidecarPost.mockResolvedValue({ status: 200, data: { results: prompts.map((p) => result(p.id, null, p.id === "p1")) } });
    await processPromptBatch("t1");
    expect(pushedOutHours()).toEqual({ p1: 24, p2: 24, p3: 24 });
    expect(record).toHaveBeenCalledWith("t1", "AI_INFERENCE", 3, expect.anything());
    expect(log.info).toHaveBeenCalledWith(expect.objectContaining({ answered: 3, errored: 0, mentioned: 1 }), "Prompt batch complete");
  });

  it("a partial failure: errored prompts retry in an hour, are not metered, and are logged as errors", async () => {
    sidecarPost.mockResolvedValue({
      status: 200,
      data: { results: [result("p1", null), result("p2", "overloaded_error"), result("p3", "overloaded_error")] },
    });
    await processPromptBatch("t1");
    expect(pushedOutHours()).toEqual({ p1: 24, p2: 1, p3: 1 });
    expect(record).toHaveBeenCalledWith("t1", "AI_INFERENCE", 1, expect.anything());
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ answered: 1, errored: 2, firstError: "overloaded_error" }),
      "Prompt batch complete with errors",
    );
    // Runs are still stored, error and all, so the report can show them.
    expect(db.promptRun.create).toHaveBeenCalledTimes(3);
  });

  it("an all-error batch fails the job for good (no retry that would 'complete' with nothing)", async () => {
    sidecarPost.mockResolvedValue({ status: 200, data: { results: prompts.map((p) => result(p.id, "credit balance too low")) } });
    const run = processPromptBatch("t1");
    await expect(run).rejects.toBeInstanceOf(UnrecoverableError);
    await expect(run).rejects.toThrow("all 3 prompts errored; first: credit balance too low");
    expect(record).not.toHaveBeenCalled();
    expect(pushedOutHours()).toEqual({ p1: 1, p2: 1, p3: 1 });
  });
});
