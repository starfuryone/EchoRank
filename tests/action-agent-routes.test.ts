// tests/action-agent-routes.test.ts
//
// The two API routes: what gets audited, what gets refused, and the one thing
// `apply` must never do.
//
// ── THE LOAD-BEARING TEST IN THIS FILE ─────────────────────────────────────
// "apply writes no reply anywhere" and its siblings. v1 publishes NOTHING: no
// kind, no status, no setting. The way that guarantee dies is somebody adding
// a convenience write — stamping ExternalReview.replyContent on apply "since we
// have it right here" — which would turn a record-keeping action into a
// publishing action with no review. So the absence of every such write is
// asserted, not assumed.
//
// ── AND THE SECOND ONE ─────────────────────────────────────────────────────
// "blocked, not queued": an exhausted tenant must be refused at the route with
// a reset date, and nothing may reach the queue.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, auditLog, addJob, rateLimit, paidPlan, assertBudget, usage, store } =
  vi.hoisted(() => ({
    prisma: { actionItem: { findFirst: vi.fn(), updateMany: vi.fn() }, externalReview: { updateMany: vi.fn(), update: vi.fn() } },
    auditLog: vi.fn(),
    addJob: vi.fn(),
    rateLimit: vi.fn(),
    paidPlan: { requirePaidPlan: vi.fn() },
    assertBudget: vi.fn(),
    usage: vi.fn(),
    store: {
      listActionItems: vi.fn(),
      countByStatus: vi.fn(),
      getActionItem: vi.fn(),
      transition: vi.fn(),
      updateDraft: vi.fn(),
    },
  }));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/audit", () => ({ createAuditLog: auditLog }));
vi.mock("@/infrastructure/queue/registry", () => ({ addJob }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit }));
vi.mock("@/lib/paid-plan", () => ({ requirePaidPlan: paidPlan.requirePaidPlan }));
vi.mock("@/lib/action-agent/store", () => store);
vi.mock("@/lib/action-agent/generate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/action-agent/generate")>();
  return {
    ...actual,
    assertActionAgentBudget: assertBudget,
    buildActionAgentUsage: usage,
  };
});

import { ActionAgentBudgetError } from "@/lib/action-agent/generate";
import { GET, POST } from "@/app/api/action-agent/route";
import { PATCH } from "@/app/api/action-agent/[id]/route";

const TENANT = "tenant_a";
const USER = "user_1";

function post(body: unknown) {
  return new Request("https://echorank360.com/api/action-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

function patch(body: unknown) {
  return new Request("https://echorank360.com/api/action-agent/item_1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": "203.0.113.7" },
    body: JSON.stringify(body),
  }) as never;
}

const params = { params: Promise.resolve({ id: "item_1" }) };

function item(over: Record<string, unknown> = {}) {
  return {
    id: "item_1",
    kind: "review_reply",
    sourceRef: "ExternalReview:rev_9",
    draft: {
      reviewId: "rev_9",
      platform: "GOOGLE",
      rating: 2,
      authorName: "Sam",
      reviewExcerpt: "Slow.",
      reply: "Thank you for telling us.",
    },
    status: "draft",
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectedNote: null,
    createdAt: "2026-08-16T00:00:00.000Z",
    updatedAt: "2026-08-16T00:00:00.000Z",
    appliedAt: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  paidPlan.requirePaidPlan.mockResolvedValue({
    tenantId: TENANT,
    userId: USER,
    tenant: { planType: "STARTER" },
  });
  rateLimit.mockResolvedValue({ success: true });
  assertBudget.mockResolvedValue({ used: 0, limit: 200_000 });
  usage.mockResolvedValue({ used: 0, limit: 200_000, resetsAt: "2026-09-01T00:00:00.000Z", plan: "STARTER" });
  addJob.mockResolvedValue({ id: "job_1" });
  auditLog.mockResolvedValue({});
  store.listActionItems.mockResolvedValue([]);
  store.countByStatus.mockResolvedValue({ draft: 0, approved: 0, applied: 0, rejected: 0 });
});

// ─── POST: blocked, not queued ──────────────────────────────────────────────

describe("POST /api/action-agent", () => {
  it("enqueues with the plan and locale snapshotted, and no prompt of any kind", async () => {
    const response = await POST(post({ kind: "schema", url: "https://example.com/", locale: "fr" }));

    expect(response.status).toBe(202);
    const [queue, name, job] = addJob.mock.calls[0];
    expect(queue).toBe("action-agent");
    expect(name).toBe("schema");
    expect(job).toMatchObject({
      tenantId: TENANT,
      kind: "schema",
      plan: "STARTER",
      locale: "fr",
      url: "https://example.com/",
      requestedByUserId: USER,
    });
    // The injection boundary: nothing prompt-shaped crosses it.
    for (const forbidden of ["system", "prompt", "model", "maxTokens", "userMessage"]) {
      expect(job).not.toHaveProperty(forbidden);
    }
  });

  it("REFUSES an exhausted tenant with the reset date, and queues nothing", async () => {
    assertBudget.mockRejectedValue(
      new ActionAgentBudgetError(200_000, "STARTER", new Date("2026-09-01T00:00:00Z")),
    );

    const response = await POST(post({ kind: "faq", url: "https://example.com/" }));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(429);
    expect(body.code).toBe("BUDGET_EXCEEDED");
    expect(body.resetsAt).toBe("2026-09-01T00:00:00.000Z");
    expect(body.limit).toBe(200_000);
    expect(addJob).not.toHaveBeenCalled();
  });

  it("rate-limits BEFORE the budget, so a locked plan is not a free probe", async () => {
    rateLimit.mockResolvedValue({ success: false });

    const response = await POST(post({ kind: "schema", url: "https://example.com/" }));

    expect(response.status).toBe(429);
    expect(assertBudget).not.toHaveBeenCalled();
    expect(addJob).not.toHaveBeenCalled();
  });

  it("rejects a kind that has no generator", async () => {
    const response = await POST(post({ kind: "gbp_post", url: "https://example.com/" }));
    expect(response.status).toBe(400);
    expect(addJob).not.toHaveBeenCalled();
  });

  it("requires a url for the page-shaped kinds", async () => {
    const response = await POST(post({ kind: "schema" }));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("URL_REQUIRED");
  });

  it("audits the request, because the drafts carry no record of who asked", async () => {
    await POST(post({ kind: "review_reply", reviewLimit: 3 }));

    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        userId: USER,
        action: "action_agent.generation_requested",
        entity: "ActionItem",
        details: expect.objectContaining({ kind: "review_reply", reviewLimit: 3 }),
      }),
    );
  });
});

// ─── GET ────────────────────────────────────────────────────────────────────

describe("GET /api/action-agent", () => {
  it("scopes the list to the session's tenant, never to a query parameter", async () => {
    await GET(
      new Request(
        "https://echorank360.com/api/action-agent?status=approved&tenantId=tenant_b",
      ) as never,
    );

    expect(store.listActionItems).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, status: "approved" }),
    );
  });

  it("ignores an unrecognised filter rather than 400ing a stale bookmark", async () => {
    await GET(
      new Request("https://echorank360.com/api/action-agent?status=nonsense&kind=nope") as never,
    );

    expect(store.listActionItems).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined, kind: undefined }),
    );
  });
});

// ─── PATCH: the transitions, the audit trail, and the no-publish guarantee ──

describe("PATCH /api/action-agent/[id]", () => {
  it("audits an approval with who, what and where it came from", async () => {
    store.getActionItem.mockResolvedValue(item());
    store.transition.mockResolvedValue({ ok: true, item: item({ status: "approved" }) });

    const response = await PATCH(patch({ action: "approve" }), params);

    expect(response.status).toBe(200);
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        userId: USER,
        action: "action_agent.approve",
        entity: "ActionItem",
        entityId: "item_1",
        ipAddress: "203.0.113.7",
        details: expect.objectContaining({ fromStatus: "draft", toStatus: "approved" }),
      }),
    );
  });

  it("APPLY WRITES NO REPLY ANYWHERE — it is a record, not a publish", async () => {
    store.getActionItem.mockResolvedValue(item({ status: "approved" }));
    store.transition.mockResolvedValue({ ok: true, item: item({ status: "applied" }) });

    await PATCH(patch({ action: "apply" }), params);

    // The whole v1 promise, asserted at the only place it could be broken.
    expect(prisma.externalReview.update).not.toHaveBeenCalled();
    expect(prisma.externalReview.updateMany).not.toHaveBeenCalled();
  });

  it("records on every apply that nothing was published and how it was used", async () => {
    store.getActionItem.mockResolvedValue(item({ status: "approved" }));
    store.transition.mockResolvedValue({ ok: true, item: item({ status: "applied" }) });

    await PATCH(patch({ action: "apply" }), params);

    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "action_agent.apply",
        details: expect.objectContaining({ published: false, mechanism: "manual_copy" }),
      }),
    );
  });

  it("carries the rejection note into the audit row", async () => {
    store.getActionItem.mockResolvedValue(item());
    store.transition.mockResolvedValue({ ok: true, item: item({ status: "rejected" }) });

    await PATCH(patch({ action: "reject", note: "wrong tone" }), params);

    expect(store.transition).toHaveBeenCalledWith(
      expect.objectContaining({ to: "rejected", note: "wrong tone", actorUserId: USER }),
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "action_agent.reject",
        details: expect.objectContaining({ note: "wrong tone" }),
      }),
    );
  });

  it("returns 409 and does NOT audit when the transition is illegal", async () => {
    store.getActionItem.mockResolvedValue(item({ status: "applied" }));
    store.transition.mockResolvedValue({
      ok: false,
      reason: "illegal_transition",
      from: "applied",
    });

    const response = await PATCH(patch({ action: "approve" }), params);

    expect(response.status).toBe(409);
    // An audit row for something that did not happen is worse than none.
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("returns 404 for another tenant's id, the same as for a missing one", async () => {
    store.getActionItem.mockResolvedValue(null);
    const response = await PATCH(patch({ action: "approve" }), params);
    expect(response.status).toBe(404);
    expect(store.transition).not.toHaveBeenCalled();
  });

  it("validates an edit against the ROW's kind, not the body's claim", async () => {
    store.getActionItem.mockResolvedValue(item()); // kind: review_reply

    const response = await PATCH(
      patch({
        action: "edit",
        // A schema-shaped payload posted at a review_reply row.
        draft: {
          url: "https://example.com/",
          jsonLd: "<script></script>",
          businessType: "Organization",
          placement: ["paste"],
          omitted: [],
        },
      }),
      params,
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_DRAFT");
    expect(store.updateDraft).not.toHaveBeenCalled();
  });

  it("keeps the drafted content OUT of the audit row on an edit", async () => {
    store.getActionItem.mockResolvedValue(item());
    store.updateDraft.mockResolvedValue({ ok: true, item: item() });

    await PATCH(
      patch({
        action: "edit",
        draft: {
          reviewId: "rev_9",
          platform: "GOOGLE",
          rating: 2,
          authorName: "Sam",
          reviewExcerpt: "Slow.",
          reply: "A named customer complained about the wait.",
        },
      }),
      params,
    );

    const audited = auditLog.mock.calls[0][0] as { details: Record<string, unknown> };
    expect(audited.details).toEqual({ kind: "review_reply" });
    expect(JSON.stringify(audited)).not.toContain("A named customer complained");
  });

  it("re-generates from the ROW's source, never from the request", async () => {
    store.getActionItem.mockResolvedValue(item({ status: "rejected" }));

    const response = await PATCH(
      // A client trying to name a different target gets ignored.
      patch({ action: "regenerate", url: "https://attacker.example/" }),
      params,
    );

    expect(response.status).toBe(202);
    const job = addJob.mock.calls[0][2] as Record<string, unknown>;
    expect(job.reviewIds).toEqual(["rev_9"]);
    expect(job.url).toBeUndefined();
    // The rejected row is untouched: rejected is terminal.
    expect(store.transition).not.toHaveBeenCalled();
    expect(store.updateDraft).not.toHaveBeenCalled();
  });

  it("re-generation asserts the budget too, and queues nothing when it is gone", async () => {
    store.getActionItem.mockResolvedValue(item({ status: "rejected" }));
    assertBudget.mockRejectedValue(
      new ActionAgentBudgetError(200_000, "STARTER", new Date("2026-09-01T00:00:00Z")),
    );

    const response = await PATCH(patch({ action: "regenerate" }), params);

    expect(response.status).toBe(429);
    expect(addJob).not.toHaveBeenCalled();
  });

  it("re-generates a page kind from its URL sourceRef", async () => {
    store.getActionItem.mockResolvedValue(
      item({ kind: "schema", sourceRef: "https://example.com/services", status: "rejected" }),
    );

    await PATCH(patch({ action: "regenerate" }), params);

    const job = addJob.mock.calls[0][2] as Record<string, unknown>;
    expect(job.url).toBe("https://example.com/services");
    expect(job.reviewIds).toBeUndefined();
  });
});
