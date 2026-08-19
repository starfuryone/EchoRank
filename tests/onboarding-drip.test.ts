// tests/onboarding-drip.test.ts
//
// The onboarding drip schedule and its dedupe keys.
//
// THE JOB IDS ARE THE INTERESTING PART. They are what make the enqueue safe to
// call twice for one tenant — from a retry, or from a second provisioning path
// if one is ever added — because BullMQ replaces a job with an existing id
// rather than queueing a duplicate. A tenant that passes through two paths must
// still receive one d0, not two, and nothing at send time would deduplicate a
// second copy: sendOnboardingEmail has no "already sent" record to consult.
//
// The schedule itself is asserted because it used to live inline in
// /api/auth/register, where it read as a property of that route. A second copy
// elsewhere would drift silently — nothing fails when d5 goes out on day six.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { addJob } = vi.hoisted(() => ({ addJob: vi.fn() }));
vi.mock("@/infrastructure/queue/registry", () => ({ addJob }));

import {
  ONBOARDING_DRIP_DELAYS,
  ONBOARDING_DRIP_STAGES,
  enqueueOnboardingDrip,
  onboardingJobId,
} from "@/lib/onboarding-drip";

const TENANT = "tenant_drip_1";
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  addJob.mockResolvedValue({});
});

describe("the schedule", () => {
  it("is exactly d0, d2, d5, d10", () => {
    expect(ONBOARDING_DRIP_STAGES).toEqual(["d0", "d2", "d5", "d10"]);
  });

  it("keeps the intended delays", () => {
    // d0 is hours, not days, so the first audit exists when the recap renders.
    expect(ONBOARDING_DRIP_DELAYS.d0).toBe(3 * 60 * 60 * 1000);
    expect(ONBOARDING_DRIP_DELAYS.d2).toBe(2 * DAY);
    expect(ONBOARDING_DRIP_DELAYS.d5).toBe(5 * DAY);
    expect(ONBOARDING_DRIP_DELAYS.d10).toBe(10 * DAY);
  });

  it("names each stage after the day it fires", () => {
    // The one property that makes the schedule readable at a glance, and the
    // one a careless edit breaks.
    for (const stage of ONBOARDING_DRIP_STAGES) {
      if (stage === "d0") continue;
      const days = Number(stage.slice(1));
      expect(ONBOARDING_DRIP_DELAYS[stage]).toBe(days * DAY);
    }
  });
});

describe("enqueueOnboardingDrip", () => {
  it("queues one job per stage — four in total", async () => {
    await enqueueOnboardingDrip(TENANT);

    expect(addJob).toHaveBeenCalledTimes(4);
    const stages = addJob.mock.calls.map((c) => c[2].stage);
    expect(stages.sort()).toEqual(["d0", "d10", "d2", "d5"]);
  });

  it("stamps the deterministic dedupe id on every job", async () => {
    await enqueueOnboardingDrip(TENANT);

    for (const call of addJob.mock.calls) {
      const stage = call[2].stage;
      expect(call[3].jobId).toBe(`onboarding-${TENANT}-${stage}`);
      expect(call[3].jobId).toBe(onboardingJobId(TENANT, stage));
    }
  });

  it("uses ids BullMQ will accept — no colon", async () => {
    // Same rule that silently disabled the trial-ending notice: BullMQ throws
    // on a custom id containing ":" unless it splits into exactly three parts.
    await enqueueOnboardingDrip(TENANT);

    for (const call of addJob.mock.calls) {
      expect(call[3].jobId).not.toContain(":");
    }
  });

  it("produces the SAME ids on a second call, so a re-enqueue dedupes", async () => {
    // The property that makes this safe to call from more than one place.
    await enqueueOnboardingDrip(TENANT);
    const first = addJob.mock.calls.map((c) => c[3].jobId).sort();

    addJob.mockClear();
    await enqueueOnboardingDrip(TENANT);
    const second = addJob.mock.calls.map((c) => c[3].jobId).sort();

    expect(second).toEqual(first);
  });

  it("gives different tenants different ids", async () => {
    await enqueueOnboardingDrip("tenant_a");
    await enqueueOnboardingDrip("tenant_b");

    const ids = addJob.mock.calls.map((c) => c[3].jobId);
    expect(new Set(ids).size).toBe(8);
  });

  it("passes the delay each stage is scheduled for", async () => {
    await enqueueOnboardingDrip(TENANT);

    for (const call of addJob.mock.calls) {
      expect(call[3].delay).toBe(ONBOARDING_DRIP_DELAYS[call[2].stage as "d0"]);
    }
  });

  it("carries the tenant id as its own correlation id", async () => {
    // What ties the four sends together in logs.
    await enqueueOnboardingDrip(TENANT);

    for (const call of addJob.mock.calls) {
      expect(call[2]).toMatchObject({ tenantId: TENANT, correlationId: TENANT });
    }
  });
});
