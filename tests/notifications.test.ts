// In-app notifications — the isolation bar, per-user read state, and the
// fan-in adapters.
//
// Prisma and the logger are stubbed; everything else (tenant scoping, the
// severity mappings, dedupeKey construction, payload shaping, catalog
// rendering) is the real code path.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

// vi.hoisted, because vi.mock is lifted above every const in the file and the
// modules under test are imported statically below — a plain top-level const
// would not exist yet when the factory runs.
const { notification, notificationRead, loggerError } = vi.hoisted(() => ({
  notification: {
    createMany: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  notificationRead: {
    upsert: vi.fn(),
    createMany: vi.fn(),
  },
  loggerError: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { notification, notificationRead } }));

vi.mock("@/infrastructure/observability/logger", () => ({
  logger: { error: loggerError, warn: vi.fn(), info: vi.fn() },
}));

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  recordNotification,
  unreadNotificationCount,
} from "@/lib/notifications/store";
import {
  notifyEscalationAlert,
  notifyPromptTransitions,
  notifyReputationScoreChange,
  notifyVisibilityAlert,
} from "@/lib/notifications/adapters";
import { renderNotification } from "@/lib/notifications/render";
import type { NotificationDto } from "@/lib/notifications/types";

const TENANT = "tenant_a";
const OTHER_TENANT = "tenant_b";
const USER = "user_1";

beforeEach(() => {
  vi.clearAllMocks();
  notification.createMany.mockResolvedValue({ count: 1 });
  notification.findMany.mockResolvedValue([]);
  notification.findFirst.mockResolvedValue(null);
  notification.count.mockResolvedValue(0);
  notificationRead.upsert.mockResolvedValue({});
  notificationRead.createMany.mockResolvedValue({ count: 0 });
});

// ─── Tenant isolation ───────────────────────────────────────────────────────

describe("tenant isolation", () => {
  it("scopes the list to the caller's tenant and to rows addressed to them", async () => {
    await listNotifications({ tenantId: TENANT, userId: USER });

    const where = notification.findMany.mock.calls[0]![0].where;
    expect(where.tenantId).toBe(TENANT);
    // Tenant-wide rows (userId null) plus this user's own — never another
    // member's targeted row.
    expect(where.OR).toEqual([{ userId: null }, { userId: USER }]);
  });

  it("scopes the unread count to the caller's tenant", async () => {
    await unreadNotificationCount(TENANT, USER);

    const where = notification.count.mock.calls[0]![0].where;
    expect(where.tenantId).toBe(TENANT);
    expect(where.reads).toEqual({ none: { userId: USER } });
  });

  it("refuses to mark a notification belonging to another tenant", async () => {
    // findFirst is scoped by (id, tenantId), so a foreign id simply is not found.
    notification.findFirst.mockResolvedValue(null);

    const ok = await markNotificationRead(TENANT, USER, "notif_owned_by_b");

    expect(ok).toBe(false);
    // The decisive assertion: nothing was written for a row we do not own.
    expect(notificationRead.upsert).not.toHaveBeenCalled();
    expect(notification.findFirst.mock.calls[0]![0].where.tenantId).toBe(TENANT);
  });

  it("marks read only within the caller's tenant when the row does belong to them", async () => {
    notification.findFirst.mockResolvedValue({ id: "notif_1" });

    const ok = await markNotificationRead(TENANT, USER, "notif_1");

    expect(ok).toBe(true);
    expect(notificationRead.upsert).toHaveBeenCalledTimes(1);
    const args = notificationRead.upsert.mock.calls[0]![0];
    expect(args.create).toEqual({ notificationId: "notif_1", userId: USER });
  });

  it("mark-all only collects unread rows from the caller's tenant", async () => {
    notification.findMany.mockResolvedValue([{ id: "n1" }, { id: "n2" }]);
    notificationRead.createMany.mockResolvedValue({ count: 2 });

    const marked = await markAllNotificationsRead(TENANT, USER);

    expect(marked).toBe(2);
    const where = notification.findMany.mock.calls[0]![0].where;
    expect(where.tenantId).toBe(TENANT);
    expect(where.reads).toEqual({ none: { userId: USER } });
    expect(notificationRead.createMany.mock.calls[0]![0].data).toEqual([
      { notificationId: "n1", userId: USER },
      { notificationId: "n2", userId: USER },
    ]);
  });
});

// ─── Read state is per user, not per tenant ─────────────────────────────────

describe("read state", () => {
  it("writes a NotificationRead row and never mutates the notification", async () => {
    notification.findFirst.mockResolvedValue({ id: "notif_1" });

    await markNotificationRead(TENANT, USER, "notif_1");

    // The EscalationAlert.acknowledged flaw is a shared flag on the alert row.
    // If this ever starts updating notifications, one teammate reading clears
    // the badge for the whole tenant.
    expect(notification.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.anything() }),
    );
    expect(notificationRead.upsert).toHaveBeenCalledTimes(1);
  });

  it("re-reading keeps the original readAt", async () => {
    notification.findFirst.mockResolvedValue({ id: "notif_1" });

    await markNotificationRead(TENANT, USER, "notif_1");

    // An empty update is what makes the upsert idempotent rather than moving
    // the timestamp forward every time the row is clicked.
    expect(notificationRead.upsert.mock.calls[0]![0].update).toEqual({});
  });

  it("flags each row read or unread for the requesting user", async () => {
    notification.findMany.mockResolvedValue([
      {
        id: "n1",
        type: "visibility_lost",
        severity: "critical",
        title: "t",
        body: null,
        href: "/visibility",
        payload: {},
        createdAt: new Date("2026-08-13T10:00:00Z"),
        reads: [{ id: "r1" }],
      },
      {
        id: "n2",
        type: "visibility_lost",
        severity: "critical",
        title: "t",
        body: null,
        href: "/visibility",
        payload: {},
        createdAt: new Date("2026-08-13T09:00:00Z"),
        reads: [],
      },
    ]);

    const { items } = await listNotifications({ tenantId: TENANT, userId: USER });

    expect(items.map((i) => i.read)).toEqual([true, false]);
  });
});

// ─── Fan-in from the sources ────────────────────────────────────────────────

describe("fan-in", () => {
  it("writes a notification for an escalation alert (source: EscalationAlert)", async () => {
    await notifyEscalationAlert(TENANT, {
      alertId: "alert_9",
      alertType: "escalation_risk",
      riskLevel: "CRITICAL",
      probability: 0.82,
      title: "CRITICAL Risk Escalation Detected",
      description: "…",
    });

    expect(notification.createMany).toHaveBeenCalledTimes(1);
    const row = notification.createMany.mock.calls[0]![0].data[0];
    expect(row.tenantId).toBe(TENANT);
    expect(row.type).toBe("escalation_risk");
    expect(row.severity).toBe("critical");
    expect(row.href).toBe("/intelligence");
    expect(row.sourceRef).toBe("EscalationAlert:alert_9");
    expect(row.payload).toEqual({
      riskLevel: "CRITICAL",
      probability: 0.82,
      alertId: "alert_9",
    });
  });

  it("writes a notification per prompt transition (source: recordPromptAlerts)", async () => {
    await notifyPromptTransitions(
      TENANT,
      [
        {
          promptId: "p1",
          promptText: "best dentist in Zurich",
          kind: "visibility_lost",
          prevRank: 3,
          newRank: null,
        },
        {
          promptId: "p2",
          promptText: "emergency dentist",
          kind: "visibility_regained",
          prevRank: null,
          newRank: 2,
        },
      ],
      (t) => `title for ${t.promptId}`,
    );

    expect(notification.createMany).toHaveBeenCalledTimes(2);

    const lost = notification.createMany.mock.calls[0]![0].data[0];
    expect(lost.type).toBe("visibility_lost");
    expect(lost.severity).toBe("critical");
    expect(lost.payload).toEqual({ promptText: "best dentist in Zurich", prevRank: 3 });

    // Good news must not be filed as a warning just because the source's
    // two-level severity had nowhere else to put it.
    const regained = notification.createMany.mock.calls[1]![0].data[0];
    expect(regained.type).toBe("visibility_regained");
    expect(regained.severity).toBe("info");
  });

  it("records a crawler block and a score drop as separate rows (source: sendVisibilityAlert)", async () => {
    await notifyVisibilityAlert({
      tenantId: TENANT,
      url: "https://example.com",
      prevScore: 80,
      newScore: 62,
      newGrade: "D",
      blockedBots: ["GPTBot", "ClaudeBot"],
    });

    expect(notification.createMany).toHaveBeenCalledTimes(2);
    const blocked = notification.createMany.mock.calls[0]![0].data[0];
    expect(blocked.type).toBe("visibility_crawler_blocked");
    expect(blocked.severity).toBe("critical");
    expect(blocked.payload.bots).toEqual(["GPTBot", "ClaudeBot"]);

    const drop = notification.createMany.mock.calls[1]![0].data[0];
    expect(drop.type).toBe("visibility_score_drop");
    expect(drop.severity).toBe("warning");
  });

  it("does not record a visibility notification when the score went up", async () => {
    await notifyVisibilityAlert({
      tenantId: TENANT,
      url: "https://example.com",
      prevScore: 60,
      newScore: 75,
      newGrade: "B",
      blockedBots: [],
    });

    expect(notification.createMany).not.toHaveBeenCalled();
  });

  it("records a reputation swing as a warning in both directions", async () => {
    await notifyReputationScoreChange({
      tenantId: TENANT,
      previousScore: 70,
      newScore: 84,
      location: null,
    });

    const row = notification.createMany.mock.calls[0]![0].data[0];
    expect(row.type).toBe("reputation_score_change");
    expect(row.severity).toBe("warning");
    expect(row.payload.direction).toBe("up");
    expect(row.href).toBe("/analytics");
  });

  it("dedupes: the unique dedupeKey plus skipDuplicates makes a repeated sweep a no-op", async () => {
    await notifyReputationScoreChange({
      tenantId: TENANT,
      previousScore: 70,
      newScore: 84,
      location: "zurich",
    });

    const call = notification.createMany.mock.calls[0]![0];
    expect(call.skipDuplicates).toBe(true);
    expect(call.data[0].dedupeKey).toMatch(/^notif:rep-score-zurich-\d{8}$/);
  });
});

// ─── Fan-in must never break the alert it mirrors ───────────────────────────

describe("failure tolerance", () => {
  it("swallows a write failure and reports it rather than throwing at the source", async () => {
    notification.createMany.mockRejectedValue(new Error("connection terminated"));

    const wrote = await recordNotification({
      tenantId: TENANT,
      type: "risk_threshold",
      severity: "critical",
      title: "Risk threshold crossed",
      payload: { score: 82, grade: "F" },
      dedupeKey: "notif:risk-threshold-x",
    });

    expect(wrote).toBe(false);
    expect(loggerError).toHaveBeenCalledTimes(1);
  });

  it("an adapter called from a worker does not reject when the write fails", async () => {
    notification.createMany.mockRejectedValue(new Error("db down"));

    // The risk engine, the escalation worker and the Stripe-adjacent consumers
    // all await these. A rejection here would fail the alert that already
    // succeeded.
    await expect(
      notifyEscalationAlert(TENANT, {
        alertId: "a1",
        alertType: "ai_risk",
        riskLevel: "HIGH",
        probability: 0.6,
        title: "t",
        description: null,
      }),
    ).resolves.toBeUndefined();
  });

  it("reports false on a duplicate without treating it as an error", async () => {
    notification.createMany.mockResolvedValue({ count: 0 });

    const wrote = await recordNotification({
      tenantId: OTHER_TENANT,
      type: "risk_spike",
      severity: "warning",
      title: "Risk spike",
      payload: { score: 70, previousScore: 50, delta: 20 },
      dedupeKey: "notif:risk-spike-x",
    });

    expect(wrote).toBe(false);
    expect(loggerError).not.toHaveBeenCalled();
  });
});

// ─── Rendering: the body must not stay English in a French dashboard ────────

describe("rendering", () => {
  const row: NotificationDto = {
    id: "n1",
    type: "visibility_rank_drop",
    severity: "warning",
    title: 'Rank dropped #2 -> #7: "best dentist"',
    body: null,
    href: "/visibility",
    payload: { promptText: "best dentist", prevRank: 2, newRank: 7 },
    createdAt: "2026-08-13T10:00:00Z",
    read: false,
  };

  it("renders from the payload through the locale catalog, not from the stored English", () => {
    const fr = renderNotification(row, "fr");
    expect(fr.title).toBe("Le rang a baissé pour « best dentist »");
    expect(fr.title).not.toContain("Rank dropped");

    const de = renderNotification(row, "de-CH");
    expect(de.title).toBe("Der Rang ist für «best dentist» gefallen");
    // House rule: Swiss German never uses ß.
    expect(de.title + de.body).not.toContain("ß");
  });

  it("falls back to the stored English title for a type the catalog does not know", () => {
    const unknown = { ...row, type: "some_future_type", body: "stored body" };
    const fr = renderNotification(unknown, "fr");

    expect(fr.title).toBe(row.title);
    expect(fr.body).toBe("stored body");
    expect(fr.label).toBeNull();
  });

  it("renders a missing payload value as an em dash, never 'undefined'", () => {
    const missing = { ...row, payload: { promptText: "best dentist", prevRank: null, newRank: null } };
    const en = renderNotification(missing, "en");

    expect(en.body).not.toContain("undefined");
    expect(en.body).toContain("—");
  });
});
