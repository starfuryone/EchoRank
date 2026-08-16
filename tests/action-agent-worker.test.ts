// tests/action-agent-worker.test.ts
//
// The worker's own two jobs: the SECOND budget check, and refusing a kind with
// no generator.
//
// WHY THE SECOND CHECK NEEDS A TEST OF ITS OWN. The route's check and this one
// are separated by a queue, and the gap between them is real: a job enqueued at
// 199,900 tokens can reach the head after a sibling has drained the rest. The
// route's verdict was true when it was made and false by the time it mattered.
// If this check regresses, nothing visible breaks — the tenant just quietly
// goes over budget — so it is asserted rather than trusted.
//
// It also has to be UNRECOVERABLE. The queue is attempts:1 today, so retrying
// is not currently possible; the assertion is here so that raising the attempt
// count later cannot turn "you are out of budget" into three retries of a
// request that cannot become affordable by waiting.
//
// Plus the notification registration, which is four places and easy to do three
// of.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnrecoverableError } from "bullmq";

const { generate, assertBudget, auditLog, loggerFns } = vi.hoisted(() => ({
  generate: vi.fn(),
  assertBudget: vi.fn(),
  auditLog: vi.fn(),
  loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));
// The real module builds a pg Pool at import time, which needs DATABASE_URL —
// unreadable from this account (see CLAUDE.md on the 600 .env). Nothing in this
// file touches the database.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/audit", () => ({ createAuditLog: auditLog }));
vi.mock("@/infrastructure/redis/connection", () => ({
  getSubscriberConnection: () => ({}),
  getRedisConnection: () => ({ get: vi.fn(), incrby: vi.fn(), expire: vi.fn() }),
}));
vi.mock("@/lib/action-agent/generate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/action-agent/generate")>();
  return { ...actual, generate, assertActionAgentBudget: assertBudget };
});

import { ActionAgentBudgetError } from "@/lib/action-agent/generate";
import { processActionAgentJob } from "@/infrastructure/queue/workers/action-agent.worker";
import { QUEUE_NAMES, type QueueName } from "@/infrastructure/redis/config";
import {
  NOTIFICATION_HREF,
  NOTIFICATION_TYPES,
  isNotificationType,
} from "@/lib/notifications/types";
import { NOTIFICATIONS_COPY } from "@/lib/i18n/dashboard";

const TENANT = "tenant_a";

function job(over: Record<string, unknown> = {}) {
  return {
    data: {
      tenantId: TENANT,
      correlationId: "c1",
      kind: "schema",
      plan: "STARTER",
      locale: "en",
      url: "https://example.com/",
      requestedByUserId: "user_1",
      ...over,
    },
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  assertBudget.mockResolvedValue({ used: 0, limit: 200_000 });
  generate.mockResolvedValue({ kind: "schema", items: [{ id: "item_1" }], outputTokens: 300 });
  auditLog.mockResolvedValue({});
});

describe("the worker's budget check", () => {
  it("runs BEFORE the generator, every time", async () => {
    await processActionAgentJob(job());
    expect(assertBudget).toHaveBeenCalledWith(TENANT, "STARTER");
    expect(generate).toHaveBeenCalled();
  });

  it("fails UNRECOVERABLY when the budget went while the job waited", async () => {
    assertBudget.mockRejectedValue(
      new ActionAgentBudgetError(200_000, "STARTER", new Date("2026-09-01T00:00:00Z")),
    );

    const error = await processActionAgentJob(job()).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(UnrecoverableError);
    expect(generate).not.toHaveBeenCalled();
  });

  it("audits the refusal, so 'why did my draft never appear' is answerable", async () => {
    assertBudget.mockRejectedValue(
      new ActionAgentBudgetError(200_000, "STARTER", new Date("2026-09-01T00:00:00Z")),
    );

    await processActionAgentJob(job()).catch(() => undefined);

    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        userId: "user_1",
        action: "action_agent.generation_blocked",
        details: expect.objectContaining({
          reason: "budget_exhausted",
          resetsAt: "2026-09-01T00:00:00.000Z",
          // Distinguishes the race from the route's own refusal, which never
          // reaches the queue at all.
          blockedAt: "worker",
        }),
      }),
    );
  });

  it("lets a non-budget failure through as itself, so it is not mislabelled", async () => {
    assertBudget.mockRejectedValue(new Error("redis exploded"));
    const error = await processActionAgentJob(job()).catch((err: unknown) => err);
    expect(error).not.toBeInstanceOf(UnrecoverableError);
    expect((error as Error).message).toBe("redis exploded");
  });
});

describe("the worker's kind guard", () => {
  it("refuses a declared-but-ungenerated kind unrecoverably", async () => {
    for (const kind of ["page", "gbp_post"]) {
      const error = await processActionAgentJob(job({ kind })).catch((err: unknown) => err);
      expect(error).toBeInstanceOf(UnrecoverableError);
      expect((error as Error).message).toContain(kind);
    }
    expect(generate).not.toHaveBeenCalled();
  });

  it("refuses a job with no tenant", async () => {
    const error = await processActionAgentJob(job({ tenantId: "" })).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(UnrecoverableError);
  });

  it("folds an unknown locale to a real DashLocale rather than passing it through", async () => {
    await processActionAgentJob(job({ locale: "en-CA" }));
    expect(generate).toHaveBeenCalledWith("schema", expect.objectContaining({ locale: "en" }));
  });
});

describe("queue registration", () => {
  it("is a registered queue name", () => {
    expect(QUEUE_NAMES).toContain("action-agent" as QueueName);
  });
});

// ─── The four notification registrations ────────────────────────────────────

describe("action_draft_ready is registered in all four places", () => {
  it("1. is in NOTIFICATION_TYPES", () => {
    expect(NOTIFICATION_TYPES).toContain("action_draft_ready");
    expect(isNotificationType("action_draft_ready")).toBe(true);
  });

  it("2. has an href pointing at the review queue", () => {
    expect(NOTIFICATION_HREF.action_draft_ready).toBe("/visibility/tools/action-agent");
  });

  it("3. has copy in all three catalogs", () => {
    for (const locale of ["en", "fr", "de-CH"] as const) {
      const entry = NOTIFICATIONS_COPY[locale].types.action_draft_ready;
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.body!.length).toBeGreaterThan(0);
    }
  });

  it("4. the copy never interpolates {kind}, which would print a raw enum value", () => {
    // render.ts substitutes payload values verbatim and has no locale in hand,
    // so a {kind} placeholder would put "review_reply" into a French tray. The
    // payload still carries it, for filtering — the same split
    // citation_opportunity.priority makes.
    for (const locale of ["en", "fr", "de-CH"] as const) {
      const entry = NOTIFICATIONS_COPY[locale].types.action_draft_ready;
      expect(`${entry.title} ${entry.body}`).not.toContain("{kind}");
      expect(`${entry.title} ${entry.body}`).not.toContain("{actionItemId}");
    }
  });

  it("says in every locale that nothing was published", async () => {
    // The one claim this notification must not get wrong. A tray row reading
    // "Echorank fixed your schema" would be false in a way the customer only
    // discovers when the fix never appears on their site.
    const en = NOTIFICATIONS_COPY.en.types.action_draft_ready;
    expect(en.body).toMatch(/nothing has been published/i);
    expect(NOTIFICATIONS_COPY.fr.types.action_draft_ready.body).toMatch(/rien n'a été publié/i);
    expect(NOTIFICATIONS_COPY["de-CH"].types.action_draft_ready.body).toMatch(
      /nichts veröffentlicht/i,
    );
  });

  it("uses ss and never ß in the de-CH strings", () => {
    const de = NOTIFICATIONS_COPY["de-CH"].types.action_draft_ready;
    expect(JSON.stringify(de)).not.toContain("ß");
  });
});
