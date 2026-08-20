// tests/onboarding-d10-framing.test.ts
//
// THE d10 MAIL MUST NOT CARRY A DATE.
//
// It used to send hasTrialEnd + trialEndDate and read as "your trial ends on
// <date>". There is already a mail that owns that message properly — the 24h
// trial-ending notice, scheduled from the subscription's real trial_end — and
// now that d10 fires on day six of a seven-day trial the two land on the SAME
// DAY. What keeps them complementary rather than duplicate is that only one of
// them names the deadline:
//
//   trial notice -> "your card is charged tomorrow"   (the deadline)
//   d10          -> "here is what you have built"     (the value)
//
// So the absence of a date in this payload is a load-bearing property, not a
// tidy-up, and it is asserted directly. The date also came from the wrong clock:
// currentPeriodEnd stops meaning "trial end" the moment the trial converts.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { tenant, visibilityAudit, promptRun, snapshot, loggerFns } = vi.hoisted(() => ({
  tenant: { findUnique: vi.fn() },
  visibilityAudit: { findFirst: vi.fn() },
  promptRun: { findMany: vi.fn() },
  snapshot: { get: vi.fn() },
  loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
}));
loggerFns.child.mockReturnValue(loggerFns);

vi.mock("@/lib/prisma", () => ({ prisma: { tenant, visibilityAudit, promptRun } }));
vi.mock("@/lib/onboarding", () => ({ getOnboardingSnapshot: snapshot.get }));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));

import { sendOnboardingEmail } from "@/lib/onboarding-email";

const TENANT = "tenant_d10";

/** A tenant mid-trial on day six: the audience this stage is written for. */
function trialingTenant(over: Record<string, unknown> = {}) {
  return {
    id: TENANT,
    name: "Acme Dental",
    planType: "GROWTH",
    billingStatus: "TRIALING",
    marketingConsent: true,
    defaultLanguage: "en",
    members: [{ user: { id: "user_1", name: "Dana Reyes", email: "dana@example.test" } }],
    // Still populated — the point is that the mail no longer READS it.
    subscription: { currentPeriodEnd: new Date("2026-08-27T00:00:00Z") },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tenant.findUnique.mockResolvedValue(trialingTenant());
  visibilityAudit.findFirst.mockResolvedValue({ score: 62, grade: "C", checks: [] });
  promptRun.findMany.mockResolvedValue([]);
  snapshot.get.mockResolvedValue({
    completedCount: 3,
    steps: [
      { key: "first_audit", done: true, href: "/visibility" },
      { key: "download_pdf", done: true, href: "/visibility" },
      { key: "review_link", done: true, href: "/review-links" },
      { key: "add_prompts", done: false, href: "/visibility" },
      { key: "explore_roadmap", done: false, href: "/visibility" },
    ],
  });
  delete process.env.BREVO_API_KEY;
});

async function d10() {
  const out = await sendOnboardingEmail(TENANT, "d10");
  if (out.status !== "dry_run") throw new Error(`expected dry_run, got ${out.status}`);
  return out.payload.params as Record<string, unknown>;
}

describe("the d10 payload", () => {
  it("is SENT to a tenant still trialing on day six", async () => {
    // The regression the move to day six exists to fix: at ten days this tenant
    // had already converted to ACTIVE and was skipped.
    const out = await sendOnboardingEmail(TENANT, "d10");
    expect(out.status).toBe("dry_run");
  });

  it("carries NO trial end date, under any key", async () => {
    const params = await d10();

    expect(params).not.toHaveProperty("trialEndDate");
    expect(params).not.toHaveProperty("hasTrialEnd");
    // Belt and braces: no value anywhere in the payload looks like the date we
    // used to send, however it might get renamed.
    const rendered = JSON.stringify(params);
    expect(rendered).not.toContain("2026-08-27");
    expect(rendered).not.toContain("August 27");
  });

  it("recaps what the tenant has set up", async () => {
    const params = await d10();

    expect(params.doneCount).toBe(3);
    expect(params.totalCount).toBe(5);
  });

  it("ships hasDoneCount, which the template gates the recap on", async () => {
    // Without it `{% if params.hasDoneCount %}` is always false and the Brevo
    // template silently renders its fallback — for the one mail whose entire
    // point is the recap, that means sending the sentence that omits it.
    expect((await d10()).hasDoneCount).toBe(true);
  });

  it("guards on the TOTAL, so a tenant who has done nothing still gets numbers", async () => {
    // "0 of 5" is a true and useful sentence; suppressing it would hide exactly
    // the tenant most worth nudging.
    snapshot.get.mockResolvedValue({
      completedCount: 0,
      steps: [{ key: "first_audit", done: false, href: "/visibility" }],
    });
    const params = await d10();

    expect(params.hasDoneCount).toBe(true);
    expect(params.doneCount).toBe(0);
  });

  it("drops the recap when the checklist produced no steps at all", async () => {
    // "0 of 0" is not a sentence worth sending.
    snapshot.get.mockResolvedValue({ completedCount: 0, steps: [] });

    expect((await d10()).hasDoneCount).toBe(false);
  });

  it("names the plan rather than dating it", async () => {
    const params = await d10();

    expect(params.planName).toBe("Growth");
    expect(params.billingUrl).toContain("/billing");
  });

  it("folds the retired AI_VISIBILITY tier to a real plan name", async () => {
    // PLAN_CONFIGS is keyed by SellablePlanType; a tenant can still carry the
    // retired tier, and an undefined plan name in a customer email is worse
    // than a slightly wrong one.
    tenant.findUnique.mockResolvedValue(trialingTenant({ planType: "AI_VISIBILITY" }));

    expect((await d10()).planName).toBe("Starter");
  });
});

describe("who d10 is withheld from", () => {
  it.each(["ACTIVE", "CANCELED", "PAST_DUE", "NONE"] as const)(
    "skips a %s tenant — nothing to recap a conversion for",
    async (billingStatus) => {
      // ACTIVE is deliberate and worth stating: a tenant who already converted
      // must not be told what is about to start. Widening this gate is what
      // would send them a stale, wrongly-dated notice.
      tenant.findUnique.mockResolvedValue(trialingTenant({ billingStatus }));

      const out = await sendOnboardingEmail(TENANT, "d10");
      expect(out).toEqual({ status: "skipped", reason: "not_trialing" });
    },
  );

  it("still honours the unsubscribe and deleted skips", async () => {
    tenant.findUnique.mockResolvedValue(trialingTenant({ marketingConsent: false }));
    expect(await sendOnboardingEmail(TENANT, "d10")).toEqual({
      status: "skipped",
      reason: "unsubscribed",
    });

    tenant.findUnique.mockResolvedValue(null);
    expect(await sendOnboardingEmail(TENANT, "d10")).toEqual({
      status: "skipped",
      reason: "tenant_deleted",
    });
  });
});
