// tests/action-agent-budget.test.ts
//
// The shared meter: blocked-not-queued, the reset date, the spend row that puts
// this feature in Marketing Studio's monthly aggregate, and the batch that
// stops at the limit instead of failing.
//
// THE INVARIANT UNDER TEST is that the Action Agent and Marketing Studio spend
// ONE allowance. If someone later gives this feature its own counter, the
// `categoryId` and Redis-key assertions here fail — which is the point.
//
// Redis, Prisma, the Anthropic client, the notification adapter and the logger
// are stubbed; the quota arithmetic, the gate order and the batch's stop
// condition are the real code path.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { redis, prisma, callMarketingModel, notify, loggerFns } = vi.hoisted(() => ({
  redis: { get: vi.fn(), incrby: vi.fn(), expire: vi.fn() },
  prisma: {
    aiApiCall: { create: vi.fn() },
    actionItem: { create: vi.fn() },
    tenant: { findFirst: vi.fn() },
    externalReview: { findMany: vi.fn() },
    trackedPrompt: { findMany: vi.fn() },
    siteAudit: { findFirst: vi.fn() },
    crawlJob: { findFirst: vi.fn() },
    crawlPage: { findMany: vi.fn() },
  },
  callMarketingModel: vi.fn(),
  notify: vi.fn(),
  loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => redis }));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));
vi.mock("@/lib/marketing/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/marketing/client")>();
  return { ...actual, callMarketingModel };
});
vi.mock("@/lib/notifications/adapters", () => ({ notifyActionDraftReady: notify }));

import {
  marketingBudgetKey,
  marketingBudgetResetsAt,
  marketingTokenLimit,
} from "@/lib/marketing/quota";
import {
  ActionAgentBudgetError,
  assertActionAgentBudget,
  buildActionAgentUsage,
  generateReviewReplies,
  MAX_REVIEW_BATCH,
} from "@/lib/action-agent/generate";
import { MarketingPlanLockedError } from "@/lib/marketing/quota";

const TENANT = "tenant_a";

function modelResult(text: string, outputTokens = 100) {
  return { text, inputTokens: 500, outputTokens, cacheReadTokens: 0 };
}

function reviewRow(id: string) {
  return {
    id,
    platform: "GOOGLE",
    rating: 2,
    authorName: "Sam",
    content: "The wait was long and nobody explained why.",
    publishedAt: new Date("2026-08-10T00:00:00Z"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.tenant.findFirst.mockResolvedValue({ name: "Acme", brandVoiceGuide: null });
  prisma.actionItem.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({
      id: `item_${String(data.sourceRef)}`,
      tenantId: TENANT,
      kind: data.kind,
      sourceRef: data.sourceRef,
      draft: data.draft,
      status: "draft",
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectedNote: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      appliedAt: null,
    }),
  );
  prisma.aiApiCall.create.mockResolvedValue({});
  redis.incrby.mockResolvedValue(1);
  redis.expire.mockResolvedValue(1);
});

// ─── The reset date ─────────────────────────────────────────────────────────

describe("marketingBudgetResetsAt", () => {
  it("is midnight UTC on the 1st of the next month", () => {
    expect(marketingBudgetResetsAt(new Date("2026-08-16T13:45:00Z")).toISOString()).toBe(
      "2026-09-01T00:00:00.000Z",
    );
  });

  it("rolls the year over in December", () => {
    expect(marketingBudgetResetsAt(new Date("2026-12-31T23:59:59Z")).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });

  it("agrees with the key the counter actually lands on", () => {
    // The moment before the reset is still the old month's key; the moment
    // after is the new one. If these ever disagree the UI promises an
    // allowance back on a day the INCRBY has not moved.
    const before = new Date("2026-08-31T23:59:59Z");
    const resetsAt = marketingBudgetResetsAt(before);
    expect(marketingBudgetKey(TENANT, before)).toContain("2026-08");
    expect(marketingBudgetKey(TENANT, resetsAt)).toContain("2026-09");
  });

  it("is reported alongside usage so a surface with no meter can still say when", async () => {
    redis.get.mockResolvedValue("1234");
    const usage = await buildActionAgentUsage(TENANT, "STARTER", new Date("2026-08-16T00:00:00Z"));
    expect(usage).toEqual({
      used: 1234,
      limit: 200_000,
      resetsAt: "2026-09-01T00:00:00.000Z",
      plan: "STARTER",
    });
  });
});

// ─── Blocked, not queued ────────────────────────────────────────────────────

describe("assertActionAgentBudget", () => {
  it("throws with the limit, the plan and the reset date when the month is spent", async () => {
    redis.get.mockResolvedValue(String(marketingTokenLimit("STARTER")));

    const error = await assertActionAgentBudget(
      TENANT,
      "STARTER",
      new Date("2026-08-16T00:00:00Z"),
    ).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ActionAgentBudgetError);
    const budgetError = error as ActionAgentBudgetError;
    expect(budgetError.statusCode).toBe(429);
    expect(budgetError.limit).toBe(200_000);
    expect(budgetError.plan).toBe("STARTER");
    expect(budgetError.resetsAt.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("passes one token under the limit — the overshoot quota.ts documents", async () => {
    redis.get.mockResolvedValue(String(marketingTokenLimit("STARTER")! - 1));
    await expect(assertActionAgentBudget(TENANT, "STARTER")).resolves.toMatchObject({
      limit: 200_000,
    });
  });

  it("treats ENTERPRISE as unmetered rather than as a zero limit", async () => {
    // The `?? 0` bug quota.ts warns about, asserted from this side too.
    await expect(assertActionAgentBudget(TENANT, "ENTERPRISE")).resolves.toEqual({
      used: 0,
      limit: null,
    });
    expect(redis.get).not.toHaveBeenCalled();
  });

  it("unlocks every plan that exists today, including the retired AI_VISIBILITY alias", async () => {
    // marketing_studio is baseline from STARTER up and AI_VISIBILITY aliases
    // STARTER's set, so the gate this feature is registered behind excludes
    // nobody currently on the ladder. Asserted rather than assumed: this is the
    // whole reason the tool is gated on marketing_studio and not on
    // ai_visibility, whose GROWTH+ line would have refused STARTER tenants an
    // allowance they are entitled to spend.
    redis.get.mockResolvedValue("0");
    for (const plan of ["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY", "ENTERPRISE"] as const) {
      await expect(assertActionAgentBudget(TENANT, plan)).resolves.toBeDefined();
    }
  });

  it("refuses a plan the feature table does not know, before it reads the counter", async () => {
    // The backstop. Not reachable from a real PlanType today — it exists so a
    // tier added without a feature-set entry fails closed rather than getting
    // an unmetered allowance.
    await expect(
      assertActionAgentBudget(TENANT, "SOMETHING_NEW" as never),
    ).rejects.toBeInstanceOf(MarketingPlanLockedError);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it("fails CLOSED when Redis is unreachable", async () => {
    redis.get.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(assertActionAgentBudget(TENANT, "STARTER")).rejects.toMatchObject({
      name: "MarketingBudgetUnavailableError",
      statusCode: 503,
    });
  });
});

// ─── The spend row lands in Marketing Studio's aggregate ────────────────────

describe("metering", () => {
  it("writes an ai_api_calls row tagged action_agent:<kind>", async () => {
    redis.get.mockResolvedValue("0");
    prisma.externalReview.findMany.mockResolvedValue([reviewRow("rev_1")]);
    callMarketingModel.mockResolvedValue(modelResult("Thank you for the feedback.", 87));

    await generateReviewReplies({
      tenantId: TENANT,
      plan: "STARTER",
      locale: "en",
      reviewLimit: 1,
    });

    expect(prisma.aiApiCall.create).toHaveBeenCalledTimes(1);
    const data = prisma.aiApiCall.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      tenantId: TENANT,
      categoryId: "action_agent:review_reply",
      model: "claude-haiku-4-5",
      outputTokens: 87,
    });
  });

  it("increments the SAME Redis key Marketing Studio enforces against", async () => {
    redis.get.mockResolvedValue("0");
    prisma.externalReview.findMany.mockResolvedValue([reviewRow("rev_1")]);
    callMarketingModel.mockResolvedValue(modelResult("Thanks.", 42));

    const now = new Date();
    await generateReviewReplies({
      tenantId: TENANT,
      plan: "STARTER",
      locale: "en",
      reviewLimit: 1,
    });

    expect(redis.incrby).toHaveBeenCalledWith(marketingBudgetKey(TENANT, now), 42);
  });

  it("does not fail the generation when the spend row cannot be written", async () => {
    redis.get.mockResolvedValue("0");
    prisma.externalReview.findMany.mockResolvedValue([reviewRow("rev_1")]);
    callMarketingModel.mockResolvedValue(modelResult("Thanks.", 42));
    prisma.aiApiCall.create.mockRejectedValue(new Error("db down"));

    const outcome = await generateReviewReplies({
      tenantId: TENANT,
      plan: "STARTER",
      locale: "en",
      reviewLimit: 1,
    });

    // The tokens are spent and the draft exists; a metering blip must not
    // discard the work. It is logged instead.
    expect(outcome.items).toHaveLength(1);
    expect(loggerFns.error).toHaveBeenCalled();
  });
});

// ─── The batch stops at the limit ───────────────────────────────────────────

describe("review batches", () => {
  it("caps the batch at MAX_REVIEW_BATCH however many are asked for", async () => {
    redis.get.mockResolvedValue("0");
    prisma.externalReview.findMany.mockResolvedValue([]);

    await generateReviewReplies({
      tenantId: TENANT,
      plan: "STARTER",
      locale: "en",
      reviewLimit: 500,
    });

    expect(prisma.externalReview.findMany.mock.calls[0][0].take).toBe(MAX_REVIEW_BATCH);
  });

  it("makes ONE model call per review, not one for the batch", async () => {
    redis.get.mockResolvedValue("0");
    prisma.externalReview.findMany.mockResolvedValue([
      reviewRow("rev_1"),
      reviewRow("rev_2"),
      reviewRow("rev_3"),
    ]);
    callMarketingModel.mockResolvedValue(modelResult("Thanks.", 40));

    const outcome = await generateReviewReplies({
      tenantId: TENANT,
      plan: "STARTER",
      locale: "en",
      reviewLimit: 3,
    });

    expect(callMarketingModel).toHaveBeenCalledTimes(3);
    expect(outcome.items).toHaveLength(3);
    expect(outcome.outputTokens).toBe(120);
    expect(notify).toHaveBeenCalledTimes(3);
  });

  it("stops mid-batch when the budget runs out, keeping what it already drafted", async () => {
    prisma.externalReview.findMany.mockResolvedValue([
      reviewRow("rev_1"),
      reviewRow("rev_2"),
      reviewRow("rev_3"),
    ]);
    callMarketingModel.mockResolvedValue(modelResult("Thanks.", 40));
    // Under the limit for the first two assertions, over it for the third.
    redis.get
      .mockResolvedValueOnce("0")
      .mockResolvedValueOnce("0")
      .mockResolvedValue(String(marketingTokenLimit("STARTER")));

    const outcome = await generateReviewReplies({
      tenantId: TENANT,
      plan: "STARTER",
      locale: "en",
      reviewLimit: 3,
    });

    // Two drafts survive; the third is not attempted. The customer keeps the
    // work they paid for rather than losing the batch to an error.
    expect(outcome.items).toHaveLength(2);
    expect(callMarketingModel).toHaveBeenCalledTimes(2);
    expect(loggerFns.warn).toHaveBeenCalled();
  });

  it("refuses the whole batch, with no model call, when already exhausted", async () => {
    prisma.externalReview.findMany.mockResolvedValue([reviewRow("rev_1")]);
    redis.get.mockResolvedValue(String(marketingTokenLimit("STARTER")));

    await expect(
      generateReviewReplies({ tenantId: TENANT, plan: "STARTER", locale: "en", reviewLimit: 1 }),
    ).rejects.toBeInstanceOf(ActionAgentBudgetError);

    expect(callMarketingModel).not.toHaveBeenCalled();
    expect(prisma.actionItem.create).not.toHaveBeenCalled();
  });

  it("spends nothing when there is nothing unanswered", async () => {
    redis.get.mockResolvedValue("0");
    prisma.externalReview.findMany.mockResolvedValue([]);

    const outcome = await generateReviewReplies({
      tenantId: TENANT,
      plan: "STARTER",
      locale: "en",
    });

    expect(outcome).toMatchObject({ items: [], outputTokens: 0, emptyReason: "nothing_unanswered" });
    expect(callMarketingModel).not.toHaveBeenCalled();
  });
});
