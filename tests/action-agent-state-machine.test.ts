// tests/action-agent-state-machine.test.ts
//
// The approval state machine and the store that enforces it.
//
// WHAT THIS COVERS AND WHY IT MATTERS: every legal transition, every illegal
// one (including both terminals), the compare-and-set that makes a double-click
// a 409 rather than two writes, edit-only-while-draft, and the re-generate path
// that has to produce a NEW row while leaving the rejected one terminal.
//
// Prisma is stubbed; the transition map, the guards and the where-clause
// construction are the real code. Same approach as
// tests/citation-opportunities-store.test.ts, and for the same reason: this
// box's .env is not readable by the test account and there is no test database.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { actionItem } = vi.hoisted(() => ({
  actionItem: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    groupBy: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: { actionItem } }));

import {
  ACTION_ITEM_TRANSITIONS,
  canTransition,
  isEditable,
  parseDraft,
  V1_KINDS,
  V2_KINDS,
  isV1Kind,
  type ActionItemStatus,
} from "@/lib/action-agent/types";
import {
  countByStatus,
  createDraft,
  getActionItem,
  listActionItems,
  regenerationSource,
  transition,
  updateDraft,
} from "@/lib/action-agent/store";

const TENANT = "tenant_a";
const OTHER_TENANT = "tenant_b";
const ACTOR = "user_1";

function row(over: Record<string, unknown> = {}) {
  return {
    id: "item_1",
    tenantId: TENANT,
    kind: "schema",
    sourceRef: "https://example.com/",
    draft: {},
    status: "draft",
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectedNote: null,
    createdAt: new Date("2026-08-16T00:00:00Z"),
    updatedAt: new Date("2026-08-16T00:00:00Z"),
    appliedAt: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── The map itself ─────────────────────────────────────────────────────────

describe("the transition map", () => {
  it("allows exactly draft->approved, draft->rejected, approved->applied, approved->rejected", () => {
    expect(ACTION_ITEM_TRANSITIONS.draft).toEqual(["approved", "rejected"]);
    expect(ACTION_ITEM_TRANSITIONS.approved).toEqual(["applied", "rejected"]);
  });

  it("makes applied and rejected terminal — nothing leaves either", () => {
    expect(ACTION_ITEM_TRANSITIONS.applied).toEqual([]);
    expect(ACTION_ITEM_TRANSITIONS.rejected).toEqual([]);

    const all: ActionItemStatus[] = ["draft", "approved", "applied", "rejected"];
    for (const to of all) {
      expect(canTransition("applied", to)).toBe(false);
      expect(canTransition("rejected", to)).toBe(false);
    }
  });

  it("refuses draft->applied, so approval can never be skipped", () => {
    expect(canTransition("draft", "applied")).toBe(false);
  });

  it("refuses every self-transition", () => {
    for (const status of ["draft", "approved", "applied", "rejected"] as const) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it("only a draft is editable", () => {
    expect(isEditable("draft")).toBe(true);
    expect(isEditable("approved")).toBe(false);
    expect(isEditable("applied")).toBe(false);
    expect(isEditable("rejected")).toBe(false);
  });
});

// ─── The enum is wide, the generators are narrow ────────────────────────────

describe("v1 vs v2 kinds", () => {
  it("recognises only the three kinds that have a generator", () => {
    expect([...V1_KINDS]).toEqual(["schema", "faq", "review_reply"]);
    for (const kind of V1_KINDS) expect(isV1Kind(kind)).toBe(true);
  });

  it("rejects the declared-but-ungenerated kinds", () => {
    expect([...V2_KINDS]).toEqual(["page", "gbp_post"]);
    for (const kind of V2_KINDS) expect(isV1Kind(kind)).toBe(false);
  });
});

// ─── transition(): the compare-and-set ──────────────────────────────────────

describe("transition", () => {
  it("stamps approvedBy and approvedAt together on approve", async () => {
    actionItem.findFirst
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row({ status: "approved", approvedBy: ACTOR }));
    actionItem.updateMany.mockResolvedValue({ count: 1 });

    const now = new Date("2026-08-16T12:00:00Z");
    const result = await transition({
      tenantId: TENANT,
      id: "item_1",
      to: "approved",
      actorUserId: ACTOR,
      now,
    });

    expect(result.ok).toBe(true);
    const call = actionItem.updateMany.mock.calls[0][0];
    expect(call.data).toMatchObject({ status: "approved", approvedBy: ACTOR, approvedAt: now });
  });

  it("stamps rejectedBy, rejectedAt and the note on reject", async () => {
    actionItem.findFirst
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row({ status: "rejected" }));
    actionItem.updateMany.mockResolvedValue({ count: 1 });

    await transition({
      tenantId: TENANT,
      id: "item_1",
      to: "rejected",
      actorUserId: ACTOR,
      note: "  wrong business type  ",
    });

    const call = actionItem.updateMany.mock.calls[0][0];
    expect(call.data.rejectedBy).toBe(ACTOR);
    expect(call.data.rejectedAt).toBeInstanceOf(Date);
    // Trimmed, because the note is rendered in a quote in the queue.
    expect(call.data.rejectedNote).toBe("wrong business type");
  });

  it("stores null rather than an empty string for a blank note", async () => {
    actionItem.findFirst
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row({ status: "rejected" }));
    actionItem.updateMany.mockResolvedValue({ count: 1 });

    await transition({
      tenantId: TENANT,
      id: "item_1",
      to: "rejected",
      actorUserId: ACTOR,
      note: "   ",
    });

    expect(actionItem.updateMany.mock.calls[0][0].data.rejectedNote).toBeNull();
  });

  it("stamps appliedAt on apply and records no approver a second time", async () => {
    actionItem.findFirst
      .mockResolvedValueOnce(row({ status: "approved", approvedBy: ACTOR }))
      .mockResolvedValueOnce(row({ status: "applied" }));
    actionItem.updateMany.mockResolvedValue({ count: 1 });

    await transition({
      tenantId: TENANT,
      id: "item_1",
      to: "applied",
      actorUserId: "user_2",
    });

    const data = actionItem.updateMany.mock.calls[0][0].data;
    expect(data.appliedAt).toBeInstanceOf(Date);
    expect(data.approvedBy).toBeUndefined();
  });

  it("puts the EXPECTED CURRENT STATUS in the where clause", async () => {
    actionItem.findFirst
      .mockResolvedValueOnce(row({ status: "approved" }))
      .mockResolvedValueOnce(row({ status: "applied" }));
    actionItem.updateMany.mockResolvedValue({ count: 1 });

    await transition({ tenantId: TENANT, id: "item_1", to: "applied", actorUserId: ACTOR });

    expect(actionItem.updateMany.mock.calls[0][0].where).toEqual({
      id: "item_1",
      tenantId: TENANT,
      status: "approved",
    });
  });

  it("reports a conflict when the row moved between the read and the write", async () => {
    actionItem.findFirst.mockResolvedValueOnce(row());
    // Somebody else approved it first: the guarded update matches nothing.
    actionItem.updateMany.mockResolvedValue({ count: 0 });

    const result = await transition({
      tenantId: TENANT,
      id: "item_1",
      to: "approved",
      actorUserId: ACTOR,
    });

    expect(result).toEqual({ ok: false, reason: "conflict", from: "draft" });
  });

  it("refuses an illegal transition without touching the database", async () => {
    actionItem.findFirst.mockResolvedValueOnce(row({ status: "applied" }));

    const result = await transition({
      tenantId: TENANT,
      id: "item_1",
      to: "approved",
      actorUserId: ACTOR,
    });

    expect(result).toEqual({ ok: false, reason: "illegal_transition", from: "applied" });
    expect(actionItem.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to reopen a rejected row — re-generation is the only way forward", async () => {
    actionItem.findFirst.mockResolvedValueOnce(row({ status: "rejected" }));

    const result = await transition({
      tenantId: TENANT,
      id: "item_1",
      to: "draft",
      actorUserId: ACTOR,
    });

    expect(result).toEqual({ ok: false, reason: "illegal_transition", from: "rejected" });
    expect(actionItem.updateMany).not.toHaveBeenCalled();
  });
});

// ─── reject -> re-generate ──────────────────────────────────────────────────

describe("re-generation after a rejection", () => {
  it("reads the kind and source off the row, scoped by tenant", async () => {
    actionItem.findFirst.mockResolvedValue({
      kind: "review_reply",
      sourceRef: "ExternalReview:rev_9",
    });

    const source = await regenerationSource(TENANT, "item_1");

    expect(source).toEqual({ kind: "review_reply", sourceRef: "ExternalReview:rev_9" });
    expect(actionItem.findFirst.mock.calls[0][0].where).toEqual({
      id: "item_1",
      tenantId: TENANT,
    });
  });

  it("writes a NEW row carrying the same sourceRef", async () => {
    actionItem.create.mockResolvedValue(row({ id: "item_2", status: "draft" }));

    await createDraft({
      tenantId: TENANT,
      kind: "schema",
      sourceRef: "https://example.com/",
      draft: { anything: true },
    });

    const data = actionItem.create.mock.calls[0][0].data;
    expect(data.sourceRef).toBe("https://example.com/");
    // Never an upsert and never a dedupeKey: the second row is the point.
    expect(actionItem.create).toHaveBeenCalledTimes(1);
    expect(data.status).toBeUndefined(); // the column default is `draft`
  });

  it("returns null for another tenant's item rather than its source", async () => {
    actionItem.findFirst.mockResolvedValue(null);
    expect(await regenerationSource(OTHER_TENANT, "item_1")).toBeNull();
  });
});

// ─── updateDraft(): edit-in-place ───────────────────────────────────────────

describe("updateDraft", () => {
  it("puts status: draft in the where clause, not in a prior check", async () => {
    actionItem.updateMany.mockResolvedValue({ count: 1 });
    actionItem.findFirst.mockResolvedValue(row());

    await updateDraft(TENANT, "item_1", { reply: "hello" });

    expect(actionItem.updateMany.mock.calls[0][0].where).toEqual({
      id: "item_1",
      tenantId: TENANT,
      status: "draft",
    });
  });

  it("reports not_editable when the row exists but has moved on", async () => {
    actionItem.updateMany.mockResolvedValue({ count: 0 });
    actionItem.findFirst.mockResolvedValue(row({ status: "approved" }));

    const result = await updateDraft(TENANT, "item_1", { reply: "hello" });

    expect(result).toEqual({ ok: false, reason: "not_editable", from: "approved" });
  });

  it("reports not_found when nothing matched at all", async () => {
    actionItem.updateMany.mockResolvedValue({ count: 0 });
    actionItem.findFirst.mockResolvedValue(null);

    const result = await updateDraft(OTHER_TENANT, "item_1", { reply: "hello" });

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});

// ─── Draft validation, on generation AND on every edit ──────────────────────

describe("parseDraft", () => {
  it("accepts a well-formed review reply", () => {
    const result = parseDraft("review_reply", {
      reviewId: "rev_1",
      platform: "GOOGLE",
      rating: 2,
      authorName: "Sam",
      reviewExcerpt: "Slow service.",
      reply: "Thank you for telling us.",
    });
    expect(result.ok).toBe(true);
  });

  it("refuses an emptied reply, which is what makes edit-then-approve safe", () => {
    const result = parseDraft("review_reply", {
      reviewId: "rev_1",
      platform: "GOOGLE",
      rating: 2,
      authorName: null,
      reviewExcerpt: "Slow service.",
      reply: "",
    });
    expect(result.ok).toBe(false);
  });

  it("refuses a payload of the wrong kind", () => {
    const schemaShaped = {
      url: "https://example.com/",
      jsonLd: "<script></script>",
      businessType: "Organization",
      placement: ["paste it"],
      omitted: [],
    };
    expect(parseDraft("review_reply", schemaShaped).ok).toBe(false);
    expect(parseDraft("schema", schemaShaped).ok).toBe(true);
  });

  it("refuses an FAQ with no pairs", () => {
    expect(
      parseDraft("faq", { url: "https://e.com/", items: [], html: "", markdown: "" }).ok,
    ).toBe(false);
  });
});

// ─── Tenant isolation on every read ─────────────────────────────────────────

describe("tenant isolation", () => {
  it("getActionItem uses findFirst with tenantId, never findUnique", async () => {
    actionItem.findFirst.mockResolvedValue(null);
    await getActionItem(OTHER_TENANT, "item_1");
    expect(actionItem.findFirst.mock.calls[0][0].where).toEqual({
      id: "item_1",
      tenantId: OTHER_TENANT,
    });
  });

  it("listActionItems scopes by tenant and caps the page size", async () => {
    actionItem.findMany.mockResolvedValue([]);
    await listActionItems({ tenantId: TENANT, limit: 5000 });
    const call = actionItem.findMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe(TENANT);
    expect(call.take).toBe(100);
  });

  it("listActionItems omits an absent filter rather than passing undefined through", async () => {
    actionItem.findMany.mockResolvedValue([]);
    await listActionItems({ tenantId: TENANT });
    expect(actionItem.findMany.mock.calls[0][0].where).toEqual({ tenantId: TENANT });
  });

  it("countByStatus scopes by tenant and fills every status", async () => {
    actionItem.groupBy.mockResolvedValue([
      { status: "draft", _count: { _all: 3 } },
      { status: "applied", _count: { _all: 1 } },
    ]);

    const counts = await countByStatus(TENANT);

    expect(actionItem.groupBy.mock.calls[0][0].where).toEqual({ tenantId: TENANT });
    expect(counts).toEqual({ draft: 3, approved: 0, applied: 1, rejected: 0 });
  });
});
