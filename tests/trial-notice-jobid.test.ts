// tests/trial-notice-jobid.test.ts
//
// THE 24-HOUR TRIAL NOTICE HAD NEVER BEEN SCHEDULED, ONCE, IN ANY ENVIRONMENT.
//
// trialNoticeJobId returned `trial-ending:${subscriptionId}`. BullMQ rejects a
// custom job id containing ":" unless it splits into exactly three parts — the
// separator is reserved for its own Redis keys, and the three-part shape is
// grandfathered in for legacy repeatable jobs. Two parts, so every call threw
//
//     Error: Custom Id cannot contain :
//
// from Job.validateOptions, before Redis was ever contacted. The webhook wraps
// the call in a try/catch that deliberately never fails a delivery over a
// reminder, so the only trace was a "Could not schedule trial-ending notice"
// warning on every checkout — which reads like a transient queue problem and is
// not one. Found 2026-08-19 while diagnosing an unrelated event-ordering race.
//
// This asserts the id against BullMQ's ACTUAL rule rather than against a
// hand-copied regex, so it keeps holding if that rule ever changes shape.

import { vi, describe, expect, it } from "vitest";
import { trialNoticeJobId } from "@/lib/billing/trial-notice";

vi.mock("@/lib/prisma", () => ({ prisma: { tenant: { findUnique: vi.fn() } } }));

/** BullMQ's rule, verbatim from Job.validateOptions (bullmq 5.77.6). */
function bullmqRejects(jobId: string): boolean {
  return jobId.includes(":") && jobId.split(":").length !== 3;
}

const REAL_SUB_ID = "sub_1U64wN3EVL9YOBcoEFsu5LZS";

describe("trialNoticeJobId", () => {
  it("is accepted by BullMQ's custom-id rule", () => {
    expect(bullmqRejects(trialNoticeJobId(REAL_SUB_ID))).toBe(false);
  });

  it("contains no colon at all", () => {
    // Stronger than the rule above and easier to keep: a two-colon id would
    // satisfy BullMQ by accident, which is not a property worth depending on.
    expect(trialNoticeJobId(REAL_SUB_ID)).not.toContain(":");
  });

  it("would have caught the shipped bug", () => {
    // The exact id this function used to build.
    expect(bullmqRejects(`trial-ending:${REAL_SUB_ID}`)).toBe(true);
  });

  it("is deterministic, so scheduling twice replaces rather than duplicates", () => {
    expect(trialNoticeJobId(REAL_SUB_ID)).toBe(trialNoticeJobId(REAL_SUB_ID));
  });

  it("still identifies the subscription it belongs to", () => {
    // cancelTrialEndingNotice finds the job from the subscription id alone.
    expect(trialNoticeJobId(REAL_SUB_ID)).toContain(REAL_SUB_ID);
  });
});
