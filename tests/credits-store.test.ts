// tests/credits-store.test.ts
//
// The database side of credits: idempotent purchase, the insufficient-balance
// gate, the concurrent-batch reservation, and tenant isolation on every query.
//
// Prisma is stubbed with an in-memory ledger that enforces the real
// (tenantId, reason, ref) unique constraint, because that constraint IS the
// idempotency mechanism — a mock that accepted every insert would let all four
// of these tests pass against code that double-credits. Same approach
// tests/site-crawler-aggregate.test.ts takes for the same reason.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row {
  id: string;
  tenantId: string;
  delta: number;
  reason: string;
  ref: string;
  createdAt: Date;
}

// EVERYTHING THE vi.mock FACTORIES TOUCH LIVES INSIDE vi.hoisted. The factories
// are lifted above this file's own declarations, so anything declared at module
// scope below would be in its temporal dead zone when they run — including the
// stub object itself, not just the error class.
const { db, loggerFns, MockKnownError, creditLedger } = vi.hoisted(() => {
  const db = { rows: [] as Row[], seq: 0, failNextWith: null as string | null };
  const loggerFns = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  /** Mimics Prisma's P2002 on the unique index. */
  class MockKnownError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }

  /** Enforces the real (tenantId, reason, ref) unique — the whole point. */
  function create(data: Omit<Row, "id" | "createdAt">): Row {
    if (db.failNextWith) {
      const code = db.failNextWith;
      db.failNextWith = null;
      throw new MockKnownError(code);
    }
    const clash = db.rows.find(
      (r) => r.tenantId === data.tenantId && r.reason === data.reason && r.ref === data.ref,
    );
    if (clash) throw new MockKnownError("P2002");
    const row: Row = { ...data, id: `cl_${++db.seq}`, createdAt: new Date(2026, 7, 15, db.seq) };
    db.rows.push(row);
    return row;
  }

  const sum = (tenantId: string) =>
    db.rows.filter((r) => r.tenantId === tenantId).reduce((acc, r) => acc + r.delta, 0);

  const creditLedger = {
    create: vi.fn(async ({ data }: { data: Omit<Row, "id" | "createdAt"> }) => create(data)),
    // Postgres returns null, not 0, for a tenant with no rows.
    aggregate: vi.fn(async ({ where }: { where: { tenantId: string } }) => ({
      _sum: {
        delta: db.rows.some((r) => r.tenantId === where.tenantId) ? sum(where.tenantId) : null,
      },
    })),
    findUnique: vi.fn(
      async ({
        where,
      }: {
        where: { tenantId_reason_ref: { tenantId: string; reason: string; ref: string } };
      }) => {
        const k = where.tenantId_reason_ref;
        return (
          db.rows.find(
            (r) => r.tenantId === k.tenantId && r.reason === k.reason && r.ref === k.ref,
          ) ?? null
        );
      },
    ),
    findMany: vi.fn(async ({ where, take }: { where: { tenantId: string }; take?: number }) =>
      db.rows
        .filter((r) => r.tenantId === where.tenantId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, take ?? 100),
    ),
  };

  return { db, loggerFns, MockKnownError, creditLedger };
});

vi.mock("@/generated/prisma", async (orig) => {
  const actual = await orig<Record<string, unknown>>();
  return {
    ...actual,
    Prisma: {
      PrismaClientKnownRequestError: MockKnownError,
      TransactionIsolationLevel: { Serializable: "Serializable" },
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    creditLedger,
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ creditLedger }),
  },
}));

vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));

import {
  creditBalance,
  creditHistory,
  recordPurchase,
  releaseReservation,
  releaseUnconsumed,
  reserveCredits,
  reservedFor,
} from "@/lib/credits/store";

const TENANT = "tenant_a";
const OTHER = "tenant_b";

beforeEach(() => {
  vi.clearAllMocks();
  db.rows = [];
  db.seq = 0;
  db.failNextWith = null;
});

// ─── Purchase idempotency ───────────────────────────────────────────────────

describe("purchase is idempotent on the session id", () => {
  it("credits once and reports that it applied", async () => {
    const result = await recordPurchase({ tenantId: TENANT, credits: 500, sessionId: "cs_1" });

    expect(result).toEqual({ applied: true, balance: 500 });
    expect(db.rows).toHaveLength(1);
  });

  it("credits NOTHING on a replayed webhook, and says so", async () => {
    // The exact scenario the two-layer idempotency exists for: the
    // ProcessedWebhook marker is deleted when a handler throws, so Stripe's
    // retry re-enters this path with the same session.
    await recordPurchase({ tenantId: TENANT, credits: 500, sessionId: "cs_1" });
    const replay = await recordPurchase({ tenantId: TENANT, credits: 500, sessionId: "cs_1" });

    expect(replay).toEqual({ applied: false, balance: 500 });
    expect(db.rows).toHaveLength(1);
  });

  it("credits a genuine second purchase of the same size", async () => {
    // Two identical packs bought minutes apart are two real purchases. Only the
    // session id separates them, which is why it is the ref.
    await recordPurchase({ tenantId: TENANT, credits: 500, sessionId: "cs_1" });
    const second = await recordPurchase({ tenantId: TENANT, credits: 500, sessionId: "cs_2" });

    expect(second).toEqual({ applied: true, balance: 1000 });
  });

  it("refuses to record a zero or negative pack", async () => {
    await expect(
      recordPurchase({ tenantId: TENANT, credits: 0, sessionId: "cs_x" }),
    ).rejects.toThrow();
    expect(db.rows).toHaveLength(0);
  });

  it("does not let one tenant's session credit another", async () => {
    await recordPurchase({ tenantId: TENANT, credits: 500, sessionId: "cs_1" });

    expect(await creditBalance(TENANT)).toBe(500);
    expect(await creditBalance(OTHER)).toBe(0);
  });
});

// ─── The insufficient-balance gate ──────────────────────────────────────────

describe("the reservation gate", () => {
  it("refuses a batch bigger than the balance, and reports the real balance", async () => {
    await recordPurchase({ tenantId: TENANT, credits: 100, sessionId: "cs_1" });

    const hold = await reserveCredits({ tenantId: TENANT, batchId: "b1", rowCount: 250 });

    expect(hold).toEqual({ ok: false, balance: 100 });
    // Nothing held: a refused batch must not leave a partial hold behind.
    expect(db.rows.filter((r) => r.reason === "RESERVE")).toHaveLength(0);
  });

  it("allows a batch that lands exactly on the balance", async () => {
    await recordPurchase({ tenantId: TENANT, credits: 100, sessionId: "cs_1" });

    const hold = await reserveCredits({ tenantId: TENANT, batchId: "b1", rowCount: 100 });

    expect(hold).toEqual({ ok: true, balance: 0 });
  });

  it("holds the full row count as a NEGATIVE delta", async () => {
    await recordPurchase({ tenantId: TENANT, credits: 500, sessionId: "cs_1" });
    await reserveCredits({ tenantId: TENANT, batchId: "b1", rowCount: 120 });

    const held = db.rows.find((r) => r.reason === "RESERVE");
    expect(held?.delta).toBe(-120);
    expect(await creditBalance(TENANT)).toBe(380);
  });

  it("reserves nothing for a Places-off batch, whatever the balance", async () => {
    const hold = await reserveCredits({ tenantId: TENANT, batchId: "b1", rowCount: 0 });

    expect(hold.ok).toBe(true);
    expect(db.rows).toHaveLength(0);
  });
});

// ─── Concurrency ────────────────────────────────────────────────────────────

describe("concurrent batches", () => {
  it("does not let two batches both spend the same credits", async () => {
    await recordPurchase({ tenantId: TENANT, credits: 300, sessionId: "cs_1" });

    // Both read 300 and both want 200. Serialized by the transaction, the
    // second sees 100 and is refused — the balance must never go negative
    // through two successful reserves.
    const first = await reserveCredits({ tenantId: TENANT, batchId: "b1", rowCount: 200 });
    const second = await reserveCredits({ tenantId: TENANT, batchId: "b2", rowCount: 200 });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(await creditBalance(TENANT)).toBe(100);
  });

  it("reports a lost write race as insufficient balance, not a crash", async () => {
    // P2034 is Postgres' serialization failure surfaced by Prisma. The customer
    // submitted twice at once; a 500 would be the wrong answer to that.
    await recordPurchase({ tenantId: TENANT, credits: 300, sessionId: "cs_1" });
    db.failNextWith = "P2034";

    const hold = await reserveCredits({ tenantId: TENANT, batchId: "b1", rowCount: 100 });

    expect(hold.ok).toBe(false);
    expect(loggerFns.warn).toHaveBeenCalled();
  });

  it("treats a re-submitted batch id as already held rather than charging twice", async () => {
    await recordPurchase({ tenantId: TENANT, credits: 300, sessionId: "cs_1" });
    await reserveCredits({ tenantId: TENANT, batchId: "b1", rowCount: 100 });
    const again = await reserveCredits({ tenantId: TENANT, batchId: "b1", rowCount: 100 });

    expect(again.ok).toBe(true);
    expect(db.rows.filter((r) => r.reason === "RESERVE")).toHaveLength(1);
    expect(await creditBalance(TENANT)).toBe(200);
  });
});

// ─── Release ────────────────────────────────────────────────────────────────

describe("release", () => {
  beforeEach(async () => {
    await recordPurchase({ tenantId: TENANT, credits: 500, sessionId: "cs_1" });
    await reserveCredits({ tenantId: TENANT, batchId: "b1", rowCount: 200 });
  });

  it("reads back what a batch is holding, as a positive count", async () => {
    expect(await reservedFor(TENANT, "b1")).toBe(200);
  });

  it("reports zero held for a batch that never reserved", async () => {
    expect(await reservedFor(TENANT, "nope")).toBe(0);
  });

  it("gives back the unconsumed part at completion", async () => {
    const released = await releaseUnconsumed({
      tenantId: TENANT,
      batchId: "b1",
      reserved: 200,
      consumed: 60,
    });

    expect(released).toBe(140);
    expect(await creditBalance(TENANT)).toBe(440);
  });

  it("gives back nothing twice, however often the worker settles", async () => {
    await releaseUnconsumed({ tenantId: TENANT, batchId: "b1", reserved: 200, consumed: 60 });
    const again = await releaseUnconsumed({
      tenantId: TENANT,
      batchId: "b1",
      reserved: 200,
      consumed: 60,
    });

    expect(again).toBe(0);
    expect(await creditBalance(TENANT)).toBe(440);
  });

  it("writes no row when the batch spent its whole hold", async () => {
    const released = await releaseUnconsumed({
      tenantId: TENANT,
      batchId: "b1",
      reserved: 200,
      consumed: 200,
    });

    expect(released).toBe(0);
    expect(db.rows.filter((r) => r.reason === "CONSUME_RELEASE")).toHaveLength(0);
  });

  it("undoes a hold in full on the submit path's rollback", async () => {
    await releaseReservation({ tenantId: TENANT, batchId: "b1", rowCount: 200 });

    expect(await creditBalance(TENANT)).toBe(500);
  });

  it("never throws out of the rollback, even when the write fails", async () => {
    // The caller is already handling a failure; a throw here would replace the
    // original error with this one.
    db.failNextWith = "P1001";

    await expect(
      releaseReservation({ tenantId: TENANT, batchId: "b1", rowCount: 200 }),
    ).resolves.toBeUndefined();
    expect(loggerFns.error).toHaveBeenCalled();
  });
});

// ─── Tenant isolation ───────────────────────────────────────────────────────

describe("tenant isolation", () => {
  it("scopes every read to the caller's tenant", async () => {
    await recordPurchase({ tenantId: TENANT, credits: 500, sessionId: "cs_a" });
    await recordPurchase({ tenantId: OTHER, credits: 2000, sessionId: "cs_b" });

    expect(await creditBalance(TENANT)).toBe(500);
    expect(await creditBalance(OTHER)).toBe(2000);

    for (const call of creditLedger.aggregate.mock.calls) {
      expect(call[0].where).toHaveProperty("tenantId");
    }
  });

  it("does not let a foreign batch id read another tenant's hold", async () => {
    await recordPurchase({ tenantId: OTHER, credits: 500, sessionId: "cs_b" });
    await reserveCredits({ tenantId: OTHER, batchId: "b_other", rowCount: 100 });

    // Same batch id, wrong tenant: nothing found, so nothing is released.
    expect(await reservedFor(TENANT, "b_other")).toBe(0);
  });

  it("keeps two tenants' identical batch ids apart", async () => {
    await recordPurchase({ tenantId: TENANT, credits: 500, sessionId: "cs_a" });
    await recordPurchase({ tenantId: OTHER, credits: 500, sessionId: "cs_b" });

    // The unique is (tenantId, reason, ref), so the same ref under two tenants
    // is two rows, not a collision.
    const a = await reserveCredits({ tenantId: TENANT, batchId: "same", rowCount: 100 });
    const b = await reserveCredits({ tenantId: OTHER, batchId: "same", rowCount: 100 });

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(await creditBalance(TENANT)).toBe(400);
    expect(await creditBalance(OTHER)).toBe(400);
  });

  it("scopes the history list", async () => {
    await recordPurchase({ tenantId: TENANT, credits: 500, sessionId: "cs_a" });
    await recordPurchase({ tenantId: OTHER, credits: 2000, sessionId: "cs_b" });

    const rows = await creditHistory(TENANT);

    expect(rows).toHaveLength(1);
    expect(rows[0].delta).toBe(500);
  });

  it("returns history newest first", async () => {
    await recordPurchase({ tenantId: TENANT, credits: 100, sessionId: "cs_1" });
    await reserveCredits({ tenantId: TENANT, batchId: "b1", rowCount: 40 });

    const rows = await creditHistory(TENANT);

    expect(rows.map((r) => r.reason)).toEqual(["RESERVE", "PURCHASE"]);
  });
});
