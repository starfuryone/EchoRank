// tests/queue-job-ids.test.ts
//
// Custom job ids against BullMQ's own validator (Job#validateOptions, the code
// that threw "Custom Id cannot contain :" in production), not a copy of its
// rule. Three layers:
//   - queueJobId() itself;
//   - the two nightly sweeps that broke, run with their stores stubbed, so the
//     ids they really enqueue are the ones validated;
//   - every literal `jobId:` in src/, so the next one written with a ":" fails
//     here rather than at 03:35 UTC.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { addJob, listCitationBrandProfiles, listTenantIds } = vi.hoisted(() => ({
  addJob: vi.fn(),
  listCitationBrandProfiles: vi.fn(),
  listTenantIds: vi.fn(),
}));

vi.mock("bullmq", async (importOriginal) => ({
  ...(await importOriginal<typeof import("bullmq")>()),
  Worker: class {},
}));
vi.mock("@/infrastructure/queue/registry", () => ({ addJob, getQueue: vi.fn() }));
vi.mock("@/infrastructure/redis/connection", () => ({ getSubscriberConnection: () => ({}) }));
vi.mock("@/infrastructure/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/citations/store", () => ({ listCitationBrandProfiles, rollUpBrandProfile: vi.fn() }));
vi.mock("@/lib/revenue/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revenue/store")>()),
  listTenantIds,
  writeRollups: vi.fn(),
}));

import { Job } from "bullmq";
import { queueJobId, utcDay } from "@/infrastructure/queue/job-id";
import { sweep as citationSweep } from "@/infrastructure/queue/workers/citation-aggregation.worker";
import { sweep as revenueSweep } from "@/infrastructure/queue/workers/revenue-rollup.worker";

/** BullMQ's check, run exactly as Queue.add runs it. Throws on a bad id. */
function bullmqValidates(jobId: string): void {
  const job = Object.create(Job.prototype) as Job & { validateOptions(d: unknown): void };
  Object.assign(job, { name: "test", opts: { jobId } });
  job.validateOptions({ data: "{}" });
}

const enqueuedIds = () => addJob.mock.calls.map((c) => (c[3] as { jobId: string }).jobId);

beforeEach(() => addJob.mockReset());

describe("queueJobId", () => {
  it("never produces an id BullMQ rejects", () => {
    for (const id of [
      queueJobId("citations", "cmpu0slh30001di2x1j3v1vtu", "2026-10-31"),
      queueJobId("revenue", "t1", "2026-10", "2026-10-31"),
      queueJobId("a:b", "c:d:e"),
    ]) {
      expect(id).not.toContain(":");
      expect(() => bullmqValidates(id)).not.toThrow();
    }
    expect(() => queueJobId()).toThrow();
  });

  it("the validator is the real one: the old ids fail it", () => {
    expect(() => bullmqValidates("citations:abc")).toThrow("Custom Id cannot contain :");
    expect(() => bullmqValidates("revenue:t:2026-10:2026-10-31")).toThrow("Custom Id cannot contain :");
  });
});

describe("the nightly sweeps that failed", () => {
  const NIGHT = new Date("2026-10-31T03:35:00Z");

  it("citation-aggregation enqueues a valid id per brand, new each night", async () => {
    listCitationBrandProfiles.mockResolvedValue([
      { brandProfileId: "bp1", tenantId: "t1" },
      { brandProfileId: "bp2", tenantId: "t1" },
    ]);
    expect(await citationSweep(NIGHT)).toBe(2);
    const tonight = enqueuedIds();
    expect(tonight).toEqual(["citations-bp1-2026-10-31", "citations-bp2-2026-10-31"]);
    tonight.forEach((id) => expect(() => bullmqValidates(id)).not.toThrow());

    // Completed jobs live 24 h; tomorrow's id must not collide with tonight's.
    addJob.mockReset();
    await citationSweep(new Date("2026-11-01T03:35:00Z"));
    expect(enqueuedIds()).toEqual(["citations-bp1-2026-11-01", "citations-bp2-2026-11-01"]);
  });

  it("revenue-rollup enqueues a valid id per tenant-month, deduped within a night", async () => {
    listTenantIds.mockResolvedValue(["t1"]);
    await revenueSweep(new Date("2026-11-03T03:40:00Z")); // inside LATE_RESTATE_DAYS
    const ids = enqueuedIds();
    expect(ids).toEqual(["revenue-t1-2026-11-2026-11-03", "revenue-t1-2026-10-2026-11-03"]);
    ids.forEach((id) => expect(() => bullmqValidates(id)).not.toThrow());

    addJob.mockReset();
    await revenueSweep(new Date("2026-11-03T09:00:00Z")); // a second tick the same day
    expect(enqueuedIds()).toEqual(ids);
  });

  it("utcDay is the UTC date", () => {
    expect(utcDay(new Date("2026-10-31T23:59:59-04:00"))).toBe("2026-11-01");
  });
});

describe("every literal jobId in src/", () => {
  const ROOT = join(__dirname, "..", "src");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name !== "generated") walk(p);
      } else if (/\.(ts|tsx)$/.test(name)) files.push(p);
    }
  };
  walk(ROOT);

  // `jobId: "x"` and `jobId: \`x-${y}\``; interpolations become a placeholder.
  const literals = files.flatMap((f) =>
    [...readFileSync(f, "utf8").matchAll(/jobId:\s*(["'`])((?:(?!\1)[^\\]|\\.)*)\1/g)].map((m) => ({
      file: f.slice(ROOT.length + 1),
      id: m[2].replace(/\$\{[^}]*\}/g, "x"),
    })),
  );

  it("finds the literals (the scan works)", () => {
    expect(literals.length).toBeGreaterThan(5);
  });

  it.each(literals.map((l) => [l.file, l.id]))("%s: %s passes BullMQ", (_file, id) => {
    expect(() => bullmqValidates(id)).not.toThrow();
  });
});
