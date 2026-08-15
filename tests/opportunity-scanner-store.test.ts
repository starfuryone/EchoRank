// tests/opportunity-scanner-store.test.ts
//
// The database-, Redis- and network-facing half: tenant isolation on every
// read, the monthly batch quota, the metered Places call, the batch-completion
// transaction, and the worker's retry rule.
//
// Prisma, Redis, the metered client, the Places client and the logger are
// stubbed; everything else is the real code path. Same approach as
// tests/citation-opportunities-store.test.ts, and for the same reason: this
// box's .env is not readable by the test account and there is no test database,
// so what can be verified without one is verified thoroughly.
//
// TENANT ISOLATION IS THE HEADLINE. ScanRow has no tenantId of its own — it
// hangs off ScanBatch — so the natural query for "this batch's rows" is a bare
// batchId filter that would hand one agency another agency's prospect list.
// Every read is asserted to carry the relation filter.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const { scanBatch, scanRow, tenant, txClient, redis, loggerFns, metering, places } =
  vi.hoisted(() => {
    const txClient = {
      scanBatch: { create: vi.fn(), update: vi.fn() },
      scanRow: { createMany: vi.fn(), update: vi.fn() },
    };
    return {
      txClient,
      scanBatch: {
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      scanRow: {
        createMany: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      tenant: { findUnique: vi.fn() },
      redis: { incr: vi.fn(), decr: vi.fn(), expire: vi.fn(), get: vi.fn() },
      loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      metering: { spentThisMonth: vi.fn(), monthlyCapUsd: vi.fn(), recordCall: vi.fn() },
      places: { searchPlaces: vi.fn(), placesConfigured: vi.fn() },
    };
  });

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scanBatch,
    scanRow,
    tenant,
    $transaction: (fn: (tx: unknown) => unknown) => fn(txClient),
  },
}));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => redis,
  getSubscriberConnection: () => redis,
}));
vi.mock("@/lib/dataforseo/metering", () => metering);
vi.mock("@/lib/signals/competitors", () => places);

import {
  createBatch,
  listBatches,
  getBatch,
  getRow,
  listRows,
  completeRow,
  failRow,
} from "@/lib/opportunity-scanner/store";
import {
  reserveScanBatch,
  releaseScanBatch,
  scanBatchesUsed,
  batchLimit,
  scanQuotaKey,
  scanMonthKey,
  BATCH_LIMITS,
  ScanQuotaUnavailableError,
} from "@/lib/opportunity-scanner/quota";
import { lookupPlace } from "@/lib/opportunity-scanner/places";
import { PLACES_TEXTSEARCH_USD } from "@/lib/explain/cost";

const TENANT = "tenant_a";
const OTHER = "tenant_b";
const BATCH = "batch_1";

function batchRow(over: Record<string, unknown> = {}) {
  return {
    id: BATCH,
    tenantId: TENANT,
    status: "running",
    total: 3,
    done: 0,
    placesEnabled: false,
    createdAt: new Date("2026-08-15T00:00:00Z"),
    completedAt: null,
    ...over,
  };
}

function rowRow(over: Record<string, unknown> = {}) {
  return {
    id: "row_1",
    batchId: BATCH,
    domain: "example.com",
    score: 41,
    grade: "D",
    topGaps: [{ category: "Rendering", status: "CSR", recommendation: "SSR", lost: 12 }],
    place: null,
    status: "done",
    error: null,
    createdAt: new Date(),
    completedAt: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  redis.expire.mockResolvedValue(1);
  metering.recordCall.mockResolvedValue(undefined);
  metering.spentThisMonth.mockResolvedValue(0);
  metering.monthlyCapUsd.mockResolvedValue(150);
  places.placesConfigured.mockReturnValue(true);
});

// ═══ Tenant isolation ═══════════════════════════════════════════════════════

describe("tenant isolation", () => {
  it("getBatch filters on tenantId, never on the id alone", async () => {
    scanBatch.findFirst.mockResolvedValue(null);
    await getBatch(TENANT, BATCH);
    expect(scanBatch.findFirst).toHaveBeenCalledWith({ where: { id: BATCH, tenantId: TENANT } });
    // findUnique on a cuid an agency can read off its own URL bar is the bug
    // this whole module exists to prevent.
    expect(scanBatch.findUnique).not.toHaveBeenCalled();
  });

  it("getBatch returns null for another tenant's batch", async () => {
    scanBatch.findFirst.mockResolvedValue(null); // the filter matched nothing
    expect(await getBatch(OTHER, BATCH)).toBeNull();
  });

  it("listRows reaches tenantId through the batch relation", async () => {
    scanRow.findMany.mockResolvedValue([]);
    await listRows(TENANT, BATCH);
    expect(scanRow.findMany).toHaveBeenCalledWith({
      where: { batchId: BATCH, batch: { tenantId: TENANT } },
    });
  });

  it("getRow — the PDF download's lookup — carries all three ids", async () => {
    scanRow.findFirst.mockResolvedValue(null);
    await getRow(TENANT, BATCH, "row_1");
    expect(scanRow.findFirst).toHaveBeenCalledWith({
      where: { id: "row_1", batchId: BATCH, batch: { tenantId: TENANT } },
    });
  });

  it("getRow returns null when the row belongs to another tenant's batch", async () => {
    scanRow.findFirst.mockResolvedValue(null);
    expect(await getRow(OTHER, BATCH, "row_1")).toBeNull();
  });

  it("listBatches only ever asks for one tenant's batches", async () => {
    scanBatch.findMany.mockResolvedValue([]);
    await listBatches(TENANT);
    expect(scanBatch.findMany.mock.calls[0][0].where).toEqual({ tenantId: TENANT });
  });
});

// ═══ Reads ══════════════════════════════════════════════════════════════════

describe("listRows", () => {
  it("sorts worst grade first, with unreachable rows last", async () => {
    scanRow.findMany.mockResolvedValue([
      rowRow({ id: "a", domain: "a.com", grade: "A", score: 90 }),
      rowRow({ id: "f", domain: "f.com", grade: "F", score: 20 }),
      rowRow({ id: "x", domain: "x.com", grade: null, score: null, status: "failed" }),
      rowRow({ id: "c", domain: "c.com", grade: "C", score: 60 }),
    ]);
    const rows = await listRows(TENANT, BATCH);
    expect(rows.map((r) => r.domain)).toEqual(["f.com", "c.com", "a.com", "x.com"]);
  });

  it("breaks a grade tie on score, then on domain, so the order is stable", async () => {
    scanRow.findMany.mockResolvedValue([
      rowRow({ id: "1", domain: "b.com", grade: "D", score: 45 }),
      rowRow({ id: "2", domain: "a.com", grade: "D", score: 42 }),
      rowRow({ id: "3", domain: "c.com", grade: "D", score: 42 }),
    ]);
    const rows = await listRows(TENANT, BATCH);
    expect(rows.map((r) => r.domain)).toEqual(["a.com", "c.com", "b.com"]);
  });

  it("reads jsonb defensively — a shape change upstream thins the row", async () => {
    scanRow.findMany.mockResolvedValue([
      rowRow({ topGaps: "not an array", place: "not an object" }),
      rowRow({ id: "r2", topGaps: null, place: [] }),
    ]);
    const rows = await listRows(TENANT, BATCH);
    expect(rows[0].topGaps).toEqual([]);
    expect(rows[0].place).toBeNull();
    expect(rows[1].topGaps).toEqual([]);
    expect(rows[1].place).toBeNull();
  });
});

// ═══ Batch creation ═════════════════════════════════════════════════════════

describe("createBatch", () => {
  it("writes the batch and its rows in one transaction", async () => {
    txClient.scanBatch.create.mockResolvedValue(batchRow({ total: 2 }));
    txClient.scanRow.createMany.mockResolvedValue({ count: 2 });

    await createBatch({ tenantId: TENANT, domains: ["a.com", "b.com"], placesEnabled: false });

    expect(txClient.scanBatch.create).toHaveBeenCalledWith({
      data: { tenantId: TENANT, total: 2, placesEnabled: false },
    });
    expect(txClient.scanRow.createMany).toHaveBeenCalledWith({
      data: [
        { batchId: BATCH, domain: "a.com" },
        { batchId: BATCH, domain: "b.com" },
      ],
      skipDuplicates: true,
    });
  });

  it("makes a double-submit idempotent rather than doubling the batch", async () => {
    txClient.scanBatch.create.mockResolvedValue(batchRow());
    txClient.scanRow.createMany.mockResolvedValue({ count: 0 });
    await createBatch({ tenantId: TENANT, domains: ["a.com"], placesEnabled: false });
    expect(txClient.scanRow.createMany.mock.calls[0][0].skipDuplicates).toBe(true);
  });

  it("carries placesEnabled onto the batch, since it is the spending flag", async () => {
    txClient.scanBatch.create.mockResolvedValue(batchRow({ placesEnabled: true }));
    txClient.scanRow.createMany.mockResolvedValue({ count: 1 });
    const batch = await createBatch({ tenantId: TENANT, domains: ["a.com"], placesEnabled: true });
    expect(batch.placesEnabled).toBe(true);
  });
});

// ═══ The completion transaction ═════════════════════════════════════════════

describe("completeRow / failRow", () => {
  it("increments done and reports the batch incomplete while rows remain", async () => {
    txClient.scanRow.update.mockResolvedValue({});
    txClient.scanBatch.update.mockResolvedValue({ total: 3, done: 1, status: "running" });

    const result = await completeRow({
      batchId: BATCH, rowId: "row_1", score: 41, grade: "D", topGaps: [], place: null,
    });

    expect(result).toEqual({ batchComplete: false, total: 3, done: 1 });
    expect(txClient.scanBatch.update).toHaveBeenCalledWith({
      where: { id: BATCH },
      data: { done: { increment: 1 } },
      select: { total: true, done: true, status: true },
    });
  });

  it("flips the batch to complete exactly once, on the row that finishes it", async () => {
    txClient.scanRow.update.mockResolvedValue({});
    txClient.scanBatch.update.mockResolvedValueOnce({ total: 3, done: 3, status: "running" });

    const result = await completeRow({
      batchId: BATCH, rowId: "row_3", score: 90, grade: "A", topGaps: [], place: null,
    });

    expect(result.batchComplete).toBe(true);
    // Second update is the status flip.
    expect(txClient.scanBatch.update).toHaveBeenCalledTimes(2);
    expect(txClient.scanBatch.update.mock.calls[1][0].data.status).toBe("complete");
  });

  it("does NOT re-fire for a batch already marked complete", async () => {
    // The guard that stops a replayed job sending a second notification.
    txClient.scanRow.update.mockResolvedValue({});
    txClient.scanBatch.update.mockResolvedValueOnce({ total: 3, done: 4, status: "complete" });

    const result = await completeRow({
      batchId: BATCH, rowId: "row_x", score: 50, grade: "D", topGaps: [], place: null,
    });

    expect(result.batchComplete).toBe(false);
    expect(txClient.scanBatch.update).toHaveBeenCalledTimes(1);
  });

  it("a failed last row still completes the batch", async () => {
    txClient.scanRow.update.mockResolvedValue({});
    txClient.scanBatch.update.mockResolvedValueOnce({ total: 2, done: 2, status: "running" });

    const result = await failRow({ batchId: BATCH, rowId: "row_2", error: "timeout" });
    expect(result.batchComplete).toBe(true);
  });

  it("caps the stored error, which renders in a table cell", async () => {
    txClient.scanRow.update.mockResolvedValue({});
    txClient.scanBatch.update.mockResolvedValue({ total: 2, done: 1, status: "running" });

    await failRow({ batchId: BATCH, rowId: "row_1", error: "x".repeat(5000) });
    const data = txClient.scanRow.update.mock.calls[0][0].data;
    expect(data.error).toHaveLength(300);
    expect(data.status).toBe("failed");
  });
});

// ═══ Quota ══════════════════════════════════════════════════════════════════

describe("batch quota", () => {
  it("only AGENCY and ENTERPRISE have an allowance", () => {
    expect(batchLimit("AGENCY")).toBe(20);
    expect(batchLimit("ENTERPRISE")).toBe(100);
    expect(batchLimit("GROWTH")).toBe(0);
    expect(batchLimit("STARTER")).toBe(0);
    expect(batchLimit("AI_VISIBILITY")).toBe(0);
  });

  it("is exhaustive over PlanType, so a new tier cannot grant infinity", () => {
    // An `undefined` limit would compare false against every count.
    for (const plan of ["AI_VISIBILITY", "STARTER", "GROWTH", "AGENCY", "ENTERPRISE"] as const) {
      expect(BATCH_LIMITS[plan]).toBeTypeOf("number");
    }
  });

  it("keys the counter per tenant and per UTC month, with a TTL", async () => {
    redis.incr.mockResolvedValue(1);
    const now = new Date("2026-08-15T12:00:00Z");
    await reserveScanBatch(TENANT, "AGENCY", now);

    expect(scanMonthKey(now)).toBe("2026-08");
    expect(scanQuotaKey(TENANT, now)).toBe(
      `echorank:opportunity-scanner:batches:${TENANT}:2026-08`,
    );
    expect(redis.incr).toHaveBeenCalledWith(scanQuotaKey(TENANT, now));
    expect(redis.expire).toHaveBeenCalledWith(scanQuotaKey(TENANT, now), 40 * 24 * 60 * 60);
  });

  it("pads a single-digit month so keys sort", () => {
    expect(scanMonthKey(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01");
  });

  it("allows a reservation under the limit", async () => {
    redis.incr.mockResolvedValue(7);
    expect(await reserveScanBatch(TENANT, "AGENCY")).toEqual({ allowed: true, used: 7, limit: 20 });
  });

  it("allows the very last slot", async () => {
    redis.incr.mockResolvedValue(20);
    expect((await reserveScanBatch(TENANT, "AGENCY")).allowed).toBe(true);
  });

  it("refuses one past the limit AND rolls the counter back", async () => {
    redis.incr.mockResolvedValue(21);
    const decision = await reserveScanBatch(TENANT, "AGENCY");
    expect(decision).toEqual({ allowed: false, used: 20, limit: 20 });
    // INCR-then-rollback rather than read-then-write: the read-first version
    // races two concurrent submits past the last slot.
    expect(redis.decr).toHaveBeenCalledWith(scanQuotaKey(TENANT));
  });

  it("refuses every plan below AGENCY on the first attempt", async () => {
    redis.incr.mockResolvedValue(1);
    expect((await reserveScanBatch(TENANT, "GROWTH")).allowed).toBe(false);
  });

  it("FAILS CLOSED when Redis is unreachable", async () => {
    redis.incr.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(reserveScanBatch(TENANT, "AGENCY")).rejects.toBeInstanceOf(
      ScanQuotaUnavailableError,
    );
  });

  it("releases a reservation without letting the rollback throw", async () => {
    redis.decr.mockRejectedValue(new Error("down"));
    await expect(releaseScanBatch(TENANT)).resolves.toBeUndefined();
  });

  it("reports usage as zero rather than throwing when Redis is down", async () => {
    redis.get.mockRejectedValue(new Error("down"));
    expect(await scanBatchesUsed(TENANT)).toBe(0);
  });

  it("reads current usage without reserving", async () => {
    redis.get.mockResolvedValue("6");
    expect(await scanBatchesUsed(TENANT)).toBe(6);
    expect(redis.incr).not.toHaveBeenCalled();
  });
});

// ═══ The metered Places lookup ══════════════════════════════════════════════

describe("lookupPlace", () => {
  it("spends nothing and calls nothing when the batch has it off", async () => {
    const result = await lookupPlace({ tenantId: TENANT, domain: "acme.com", enabled: false });
    expect(result).toEqual({ place: null, costUsd: 0, reason: "disabled" });
    expect(places.searchPlaces).not.toHaveBeenCalled();
    expect(metering.recordCall).not.toHaveBeenCalled();
  });

  it("checks the cap BEFORE the request is built", async () => {
    metering.spentThisMonth.mockResolvedValue(150);
    metering.monthlyCapUsd.mockResolvedValue(150);

    const result = await lookupPlace({ tenantId: TENANT, domain: "acme.com", enabled: true });

    expect(result.reason).toBe("cap_reached");
    expect(result.costUsd).toBe(0);
    expect(places.searchPlaces).not.toHaveBeenCalled();
    expect(metering.recordCall).not.toHaveBeenCalled();
  });

  it("writes a SeoApiCall row under local_seo at the text-search rate", async () => {
    places.searchPlaces.mockResolvedValue([
      { placeId: "p1", name: "Acme Dental", rating: 4.3, reviewCount: 112 },
    ]);

    const result = await lookupPlace({ tenantId: TENANT, domain: "acme-dental.com", enabled: true });

    expect(places.searchPlaces).toHaveBeenCalledWith("acme dental");
    expect(metering.recordCall).toHaveBeenCalledWith({
      tenantId: TENANT,
      feature: "local_seo",
      path: "places.googleapis.com/v1/places:searchText",
      costUsd: PLACES_TEXTSEARCH_USD,
      ok: true,
      // Plan-funded here — this call passed the monthly cap check. A
      // credit-funded call skips that check and records `true`, which is what
      // keeps it out of spentThisMonth() without hiding the real upstream cost.
      creditFunded: false,
    });
    expect(result.place).toEqual({ name: "Acme Dental", rating: 4.3, reviewCount: 112 });
    expect(result.costUsd).toBe(PLACES_TEXTSEARCH_USD);
  });

  it("BILLS A FAILED CALL, because a request still left the building", async () => {
    places.searchPlaces.mockRejectedValue(new Error("network"));

    const result = await lookupPlace({ tenantId: TENANT, domain: "acme.com", enabled: true });

    expect(metering.recordCall).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, costUsd: PLACES_TEXTSEARCH_USD }),
    );
    expect(result.costUsd).toBe(PLACES_TEXTSEARCH_USD);
    expect(result.place).toBeNull();
    expect(result.reason).toBe("upstream_failed");
  });

  it("returns no listing — not an error — when nothing matches", async () => {
    places.searchPlaces.mockResolvedValue([]);
    const result = await lookupPlace({ tenantId: TENANT, domain: "some-saas.com", enabled: true });
    expect(result.place).toBeNull();
    expect(result.reason).toBe("no_match");
  });

  it("takes the top match only, never guesses among five", async () => {
    places.searchPlaces.mockResolvedValue([
      { placeId: "p1", name: "First", rating: 4.0, reviewCount: 10 },
      { placeId: "p2", name: "Second", rating: 1.0, reviewCount: 500 },
    ]);
    const result = await lookupPlace({ tenantId: TENANT, domain: "acme.com", enabled: true });
    expect(result.place?.name).toBe("First");
  });

  it("nulls a missing rating rather than coercing it to zero", async () => {
    places.searchPlaces.mockResolvedValue([{ placeId: "p1", name: "New Place" }]);
    const result = await lookupPlace({ tenantId: TENANT, domain: "acme.com", enabled: true });
    // A zero rating would render as "0★" — a false claim about a business that
    // simply has no reviews yet.
    expect(result.place).toEqual({ name: "New Place", rating: null, reviewCount: null });
  });

  it("spends nothing when Places is not configured", async () => {
    places.placesConfigured.mockReturnValue(false);
    const result = await lookupPlace({ tenantId: TENANT, domain: "acme.com", enabled: true });
    expect(result).toEqual({ place: null, costUsd: 0, reason: "not_configured" });
    expect(metering.recordCall).not.toHaveBeenCalled();
  });

  it("spends nothing on a domain with no usable brand stem", async () => {
    const result = await lookupPlace({ tenantId: TENANT, domain: ".com", enabled: true });
    expect(result.costUsd).toBe(0);
    expect(places.searchPlaces).not.toHaveBeenCalled();
  });
});
