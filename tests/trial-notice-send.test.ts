// tests/trial-notice-send.test.ts
//
// sendTrialEndingEmail() — the money-path send, and the three ways it is
// allowed to stay quiet.
//
// WHAT THIS FILE IS REALLY ABOUT: the difference between "did not send" and
// "failed to send". The trial-notice queue retries three times with exponential
// backoff, because a transient relay error means a customer is charged with no
// warning. But a missing env var is not transient — retrying it burns all three
// attempts against a condition no retry can change, and buries the cause under
// "job failed" lines. So one of these outcomes THROWS and the others do not, and
// which is which is the thing under test.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { tenant, sendMail, isEmailConfigured, resolveIntervalFromPriceId } = vi.hoisted(() => ({
  tenant: { findUnique: vi.fn() },
  sendMail: vi.fn(),
  isEmailConfigured: vi.fn(),
  resolveIntervalFromPriceId: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { tenant } }));
vi.mock("@/lib/mailer", () => ({
  sendMail,
  isEmailConfigured,
  missingEmailEnv: () => ["SMTP_USER", "SMTP_PASS"],
}));
vi.mock("@/lib/stripe/prices", () => ({ resolveIntervalFromPriceId }));

import { sendTrialEndingEmail } from "@/lib/billing/trial-notice";
import { BILLING_URL } from "@/lib/billing/trial-ending-email";
import { PLAN_CONFIGS } from "@/lib/plan-config";

/** Amounts render grouped — see tests/trial-ending-email.test.ts. */
const money = (n: number) => new Intl.NumberFormat("en-CA").format(n);

/** Unix seconds, as Stripe reports trial_end. */
const TRIAL_END = Math.floor(new Date("2026-09-04T14:00:00.000Z").getTime() / 1000);

const JOB = {
  tenantId: "tenant_1",
  stripeSubscriptionId: "sub_1U64wN3EVL9YOBcoEFsu5LZS",
  trialEnd: TRIAL_END,
};

function tenantRow(over: Record<string, unknown> = {}) {
  return {
    defaultLanguage: "en",
    timezone: "America/Toronto",
    members: [{ user: { email: "owner@example.com" } }],
    subscription: {
      status: "TRIALING",
      planType: "GROWTH",
      stripePriceId: "price_growth_monthly",
    },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  isEmailConfigured.mockReturnValue(true);
  resolveIntervalFromPriceId.mockResolvedValue("month");
  sendMail.mockResolvedValue(true);
  tenant.findUnique.mockResolvedValue(tenantRow());
});

describe("the happy path", () => {
  it("sends one message to the tenant owner, with both parts", async () => {
    await sendTrialEndingEmail(JOB);

    expect(sendMail).toHaveBeenCalledTimes(1);
    const sent = sendMail.mock.calls[0][0];
    expect(sent.to).toEqual(["owner@example.com"]);
    expect(sent.subject).toContain("September 4");
    expect(sent.html).toContain("<p>");
    expect(sent.text).toContain(BILLING_URL);
    // The amount is the config's, resolved at send time.
    expect(sent.text).toContain(money(PLAN_CONFIGS.GROWTH.monthlyPrice));
  });

  it("writes in French when the tenant's stored language is French", async () => {
    tenant.findUnique.mockResolvedValue(tenantRow({ defaultLanguage: "fr-CA" }));
    await sendTrialEndingEmail(JOB);
    expect(sendMail.mock.calls[0][0].subject).toContain("Votre essai Echorank");
  });

  it("takes the interval from the price catalog, not from a guess", async () => {
    resolveIntervalFromPriceId.mockResolvedValue("year");
    await sendTrialEndingEmail(JOB);
    expect(resolveIntervalFromPriceId).toHaveBeenCalledWith("price_growth_monthly");
    expect(sendMail.mock.calls[0][0].text).toContain(
      money(PLAN_CONFIGS.GROWTH.annualPrice * 12),
    );
  });

  it("names no amount when the catalog cannot say which interval", async () => {
    resolveIntervalFromPriceId.mockResolvedValue(null);
    await sendTrialEndingEmail(JOB);
    expect(sendMail.mock.calls[0][0].text).not.toMatch(/\$\d/);
  });

  it("writes nothing to the database — a retry is safe to deliver twice", async () => {
    await sendTrialEndingEmail(JOB);
    await sendTrialEndingEmail(JOB);
    // The only Prisma call in the module is the read.
    expect(tenant.findUnique).toHaveBeenCalledTimes(2);
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(sendMail.mock.calls[0][0]).toEqual(sendMail.mock.calls[1][0]);
  });
});

describe("staying quiet without poisoning the queue", () => {
  it("completes without sending or throwing when SMTP is unconfigured", async () => {
    // A missing env var is not a transient failure. Throwing here would spend
    // all three attempts on a condition no retry can change.
    isEmailConfigured.mockReturnValue(false);
    await expect(sendTrialEndingEmail(JOB)).resolves.toBeUndefined();
    expect(sendMail).not.toHaveBeenCalled();
    // And it does not even reach the database.
    expect(tenant.findUnique).not.toHaveBeenCalled();
  });

  it("skips a subscription that is no longer trialing", async () => {
    // Re-checked here as well as in the worker: a customer can cancel or convert
    // between the two reads, and a warning about a charge that is not coming is
    // its own support ticket.
    for (const status of ["ACTIVE", "CANCELED", "PAST_DUE", "NONE"]) {
      vi.clearAllMocks();
      isEmailConfigured.mockReturnValue(true);
      tenant.findUnique.mockResolvedValue(
        tenantRow({ subscription: { status, planType: "GROWTH", stripePriceId: "price_x" } }),
      );
      await expect(sendTrialEndingEmail(JOB)).resolves.toBeUndefined();
      expect(sendMail, `status ${status}`).not.toHaveBeenCalled();
    }
  });

  it("skips when the subscription row is gone", async () => {
    tenant.findUnique.mockResolvedValue(tenantRow({ subscription: null }));
    await expect(sendTrialEndingEmail(JOB)).resolves.toBeUndefined();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("skips a deleted tenant", async () => {
    tenant.findUnique.mockResolvedValue(null);
    await expect(sendTrialEndingEmail(JOB)).resolves.toBeUndefined();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("skips when there is no owner address to warn", async () => {
    tenant.findUnique.mockResolvedValue(tenantRow({ members: [] }));
    await expect(sendTrialEndingEmail(JOB)).resolves.toBeUndefined();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("does not throw when the mailer holds the message", async () => {
    // false is "held" — SMTP_HOST unset, or the dev guard. Not a delivery
    // failure, so not something a retry fixes.
    sendMail.mockResolvedValue(false);
    await expect(sendTrialEndingEmail(JOB)).resolves.toBeUndefined();
  });
});

describe("failing loudly when a retry would help", () => {
  it("propagates a relay error so BullMQ retries with backoff", async () => {
    sendMail.mockRejectedValue(new Error("451 4.7.1 Try again later"));
    await expect(sendTrialEndingEmail(JOB)).rejects.toThrow("451 4.7.1 Try again later");
  });

  it("propagates a database error rather than silently sending nothing", async () => {
    tenant.findUnique.mockRejectedValue(new Error("connection terminated"));
    await expect(sendTrialEndingEmail(JOB)).rejects.toThrow("connection terminated");
    expect(sendMail).not.toHaveBeenCalled();
  });
});
