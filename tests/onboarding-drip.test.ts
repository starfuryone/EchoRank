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

import { TRIAL_DAYS } from "@/lib/plan-config";
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

  it("keeps the intended delays — d10 fires on day SIX", () => {
    // d0 is hours, not days, so the first audit exists when the recap renders.
    expect(ONBOARDING_DRIP_DELAYS.d0).toBe(3 * 60 * 60 * 1000);
    expect(ONBOARDING_DRIP_DELAYS.d2).toBe(2 * DAY);
    expect(ONBOARDING_DRIP_DELAYS.d5).toBe(5 * DAY);
    expect(ONBOARDING_DRIP_DELAYS.d10).toBe(6 * DAY);
  });

  it("lands d10 INSIDE the trial, which is the whole point of the move", () => {
    // TRIAL_DAYS is 7. At the old ten-day delay this stage arrived three days
    // after Stripe had already converted the tenant to ACTIVE, so its own
    // `billingStatus === "TRIALING"` gate skipped nearly everyone it was
    // written for. Asserted against the real constant so a change to the trial
    // length that invalidates the schedule fails here rather than in a month's
    // worth of unsent email.
    expect(ONBOARDING_DRIP_DELAYS.d10).toBeLessThan(TRIAL_DAYS * DAY);
  });

  it("keeps the d10 KEY even though it fires on day six", () => {
    // The key is half of the dedupe id, and jobs already queued under
    // `onboarding-<tenantId>-d10` carry it. Renaming it to d6 would orphan
    // those and let a re-enqueued tenant collect both ids — two sends. This
    // test exists to make that trade explicit rather than tempting.
    expect(ONBOARDING_DRIP_STAGES).toContain("d10");
    expect(ONBOARDING_DRIP_STAGES).not.toContain("d6");
    expect(onboardingJobId("t1", "d10")).toBe("onboarding-t1-d10");
  });

  it("never schedules two stages for the same day", () => {
    // The failure this guards: d5 at five days and d10 at six must stay a day
    // apart. Pulling d10 any earlier collides with d5 and puts two onboarding
    // mails in one inbox on one morning.
    const days = ONBOARDING_DRIP_STAGES.map((s) => Math.floor(ONBOARDING_DRIP_DELAYS[s] / DAY));
    expect(new Set(days).size).toBe(days.length);
  });

  it("keeps d5 and d10 a clear day apart", () => {
    expect(ONBOARDING_DRIP_DELAYS.d10 - ONBOARDING_DRIP_DELAYS.d5).toBe(1 * DAY);
  });

  it("fires the stages in ascending order", () => {
    const delays = ONBOARDING_DRIP_STAGES.map((s) => ONBOARDING_DRIP_DELAYS[s]);
    expect([...delays].sort((a, b) => a - b)).toEqual(delays);
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
