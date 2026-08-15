// tests/revenue-store.test.ts
//
// The database-facing half of the AI Revenue dashboard: which mode a month
// operates in, that a rollup never mixes two, that measured is preferred over
// proxy on read, that the model toggle drives the read, and that every query is
// tenant-scoped.
//
// Prisma is stubbed; everything else is the real code path. Same approach as
// tests/opportunity-scanner-store.test.ts, and for the same reason: this box's
// .env is not readable by the test account and there is no test database, so
// what can be verified without one is verified thoroughly.
//
// TENANT ISOLATION IS ASSERTED ON EVERY READ. RevenueRollup's natural key
// starts with tenantId and there is no findUnique-by-id in the module, but
// "there is currently no such query" is a property that decays — these tests
// are what notice when one appears.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const { aiVisit, sovSnapshot, brandProfile, tenant, revenueRollup, aiConversion, prismaBag } =
  vi.hoisted(() => {
    const aiConversion = { findMany: vi.fn() };
    const prismaBag: Record<string, unknown> = {};
    return {
      aiVisit: { findMany: vi.fn() },
      sovSnapshot: { findFirst: vi.fn(), findMany: vi.fn() },
      brandProfile: { findFirst: vi.fn() },
      tenant: { findFirst: vi.fn(), findMany: vi.fn() },
      revenueRollup: { upsert: vi.fn(), findMany: vi.fn() },
      aiConversion,
      prismaBag,
    };
  });

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(prismaBag as Record<string, unknown>, {
    get(_target, key: string) {
      switch (key) {
        case "aiVisit":
          return aiVisit;
        case "sovSnapshot":
          return sovSnapshot;
        case "brandProfile":
          return brandProfile;
        case "tenant":
          return tenant;
        case "revenueRollup":
          return revenueRollup;
        // Attribution P2's table. Present only when a test installs it, so the
        // "measured mode does not exist yet" path is the default here exactly
        // as it is in production.
        case "aiConversion":
          return prismaBag.aiConversion;
        default:
          return undefined;
      }
    },
    has(_t, key: string) {
      return key !== "aiConversion" || prismaBag.aiConversion !== undefined;
    },
  }),
}));

import {
  loadAssumptions,
  loadShares,
  loadTouches,
  monthKey,
  monthRange,
  previousMonth,
  readRollup,
  writeRollups,
} from "@/lib/revenue/store";
import { loadRevenuePageData } from "@/lib/revenue/page-data";

const TENANT = "tenant_a";
const OTHER = "tenant_b";
const MONTH = "2026-08";

const visitRow = (visitorId: string, source: string, day: string) => ({
  visitorId,
  source,
  firstSeen: new Date(`2026-08-${day}T10:00:00Z`),
  lastSeen: new Date(`2026-08-${day}T10:00:00Z`),
});

function resetAll() {
  vi.clearAllMocks();
  delete prismaBag.aiConversion;

  tenant.findFirst.mockResolvedValue({ convRate: 0.3, avgSaleValue: 450 });
  tenant.findMany.mockResolvedValue([{ id: TENANT }]);
  aiVisit.findMany.mockResolvedValue([
    visitRow("v1", "chatgpt", "02"),
    visitRow("v2", "perplexity", "04"),
  ]);
  brandProfile.findFirst.mockResolvedValue({ id: "bp1", name: "Asturia" });
  sovSnapshot.findFirst.mockResolvedValue({ date: new Date("2026-08-28T00:00:00Z") });
  sovSnapshot.findMany.mockResolvedValue([
    { engine: "CHATGPT", brand: "Asturia", mentionWeighted: 2 },
    { engine: "CHATGPT", brand: "Rival Co", mentionWeighted: 6 },
    { engine: "CLAUDE", brand: "Asturia", mentionWeighted: 4 },
    { engine: "CLAUDE", brand: "Rival Co", mentionWeighted: 4 },
  ]);
  revenueRollup.upsert.mockResolvedValue({});
  revenueRollup.findMany.mockResolvedValue([]);
}

beforeEach(resetAll);

// ─── Month keys ─────────────────────────────────────────────────────────────

describe("month keys", () => {
  it("keys on the UTC calendar month", () => {
    expect(monthKey(new Date("2026-08-15T23:59:59Z"))).toBe("2026-08");
    expect(monthKey(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01");
  });

  it("spans a month as a half-open UTC range", () => {
    const { start, end } = monthRange("2026-08");
    expect(start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("steps back across a year boundary", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(previousMonth("2026-08")).toBe("2026-07");
  });
});

// ─── The leads ruling ───────────────────────────────────────────────────────

describe("which mode a month operates in", () => {
  it("is proxy when AiConversion does not exist", () => {
    // The state every tenant is in today: attribution P2 has not shipped.
    return loadTouches(TENANT, MONTH).then((result) => {
      expect(result.mode).toBe("proxy");
      expect(result.touches).toHaveLength(2);
    });
  });

  it("counts distinct AI-referred visitors as the proxy, not page views", async () => {
    const { touches } = await loadTouches(TENANT, MONTH);
    // ai_visits already collapses repeat arrivals; `hits` is never read.
    expect(aiVisit.findMany.mock.calls[0][0].select).not.toHaveProperty("hits");
    expect(touches.map((t) => t.visitorId)).toEqual(["v1", "v2"]);
  });

  it("is measured the moment AiConversion appears, with no other edit", async () => {
    prismaBag.aiConversion = aiConversion;
    aiConversion.findMany.mockResolvedValue([
      { visitorId: "c1", source: "chatgpt", convertedAt: new Date("2026-08-11T00:00:00Z") },
    ]);

    const result = await loadTouches(TENANT, MONTH);
    expect(result.mode).toBe("measured");
    expect(result.touches).toHaveLength(1);
    // The proxy query must not even run once measured is available.
    expect(aiVisit.findMany).not.toHaveBeenCalled();
  });

  it("writes a measured row for a tenant that converted nobody", async () => {
    // [] is "measured mode, and nobody converted" — a real state worth a row.
    // Only a MISSING table falls through to proxy.
    prismaBag.aiConversion = aiConversion;
    aiConversion.findMany.mockResolvedValue([]);

    const result = await loadTouches(TENANT, MONTH);
    expect(result.mode).toBe("measured");
    expect(result.touches).toEqual([]);
  });

  it("never consults FunnelLead", async () => {
    // FunnelLead carries no source, no visitorId and no referrer, and is
    // captured on a different domain from the er_vid cookie — there is no join
    // key, so counting funnel captures here would book walk-in traffic as AI
    // revenue. The mock exposes no funnelLead delegate at all: a query for one
    // would throw rather than quietly return undefined.
    await expect(loadTouches(TENANT, MONTH)).resolves.toBeTruthy();
    expect(Object.keys(prismaBag)).not.toContain("funnelLead");
  });
});

// ─── Writing ────────────────────────────────────────────────────────────────

describe("writeRollups", () => {
  it("writes one row per attribution model", async () => {
    const result = await writeRollups(TENANT, MONTH);
    expect(result.written).toBe(4);
    expect(revenueRollup.upsert).toHaveBeenCalledTimes(4);

    const models = revenueRollup.upsert.mock.calls.map((c) => c[0].create.model);
    expect(models.sort()).toEqual(["first", "influenced", "last", "linear"]);
  });

  it("gives every row of one run the same mode", async () => {
    // The structural promise: four models divide ONE touch set, so a run cannot
    // produce a measured `first` row beside a proxy `linear` row.
    const { mode } = await writeRollups(TENANT, MONTH);
    const modes = new Set(revenueRollup.upsert.mock.calls.map((c) => c[0].create.mode));
    expect(modes.size).toBe(1);
    expect([...modes][0]).toBe(mode);
    expect(mode).toBe("proxy");
  });

  it("upserts on the four-part key so a re-run restates rather than doubles", async () => {
    await writeRollups(TENANT, MONTH);
    for (const call of revenueRollup.upsert.mock.calls) {
      expect(call[0].where.tenantId_month_model_mode).toEqual({
        tenantId: TENANT,
        month: MONTH,
        model: call[0].create.model,
        mode: call[0].create.mode,
      });
    }
  });

  it("never updates the mode of an existing row", async () => {
    // A mode flip must land as a NEW row beside its predecessor, not on top of
    // it. That only holds if `update` leaves mode alone.
    await writeRollups(TENANT, MONTH);
    for (const call of revenueRollup.upsert.mock.calls) {
      expect(call[0].update).not.toHaveProperty("mode");
      expect(call[0].update).not.toHaveProperty("month");
      expect(call[0].update).not.toHaveProperty("tenantId");
    }
  });

  it("stores the money the formulas produce", async () => {
    await writeRollups(TENANT, MONTH);
    const last = revenueRollup.upsert.mock.calls.find((c) => c[0].create.model === "last")![0];

    // 2 distinct visitors x 0.30 x 450
    expect(last.create.wonRevenue).toBe(270);
    // Pooled share: Asturia 6 of 16 weight = 0.375, Rival Co 10/16 = 0.625.
    // addressable = 2 / 0.375 = 5.333…, gap = 0.25
    // lost = 0.25 x 5.333… x 0.30 x 450 = 180
    expect(last.create.lostRevenueEst).toBe(180);
  });
});

// ─── Reading: measured preferred, proxy kept ────────────────────────────────

describe("readRollup", () => {
  it("shows measured and reports that proxy survives", async () => {
    revenueRollup.findMany.mockResolvedValue([
      { month: MONTH, model: "last", mode: "proxy", wonRevenue: 100, lostRevenueEst: 10 },
      { month: MONTH, model: "last", mode: "measured", wonRevenue: 250, lostRevenueEst: 25 },
    ]);

    const result = await readRollup(TENANT, MONTH, "last");
    expect(result.shown?.mode).toBe("measured");
    expect(result.shown?.wonRevenue).toBe(250);
    expect(result.alsoHasProxy).toBe(true);
  });

  it("shows proxy when that is all there is, and says so", async () => {
    revenueRollup.findMany.mockResolvedValue([
      { month: MONTH, model: "last", mode: "proxy", wonRevenue: 100, lostRevenueEst: 10 },
    ]);

    const result = await readRollup(TENANT, MONTH, "last");
    expect(result.shown?.mode).toBe("proxy");
    expect(result.alsoHasProxy).toBe(false);
  });

  it("returns nothing for a month never rolled up", async () => {
    const result = await readRollup(TENANT, MONTH, "first");
    expect(result.shown).toBeNull();
    expect(result.alsoHasProxy).toBe(false);
  });
});

// ─── The model toggle ───────────────────────────────────────────────────────

describe("the attribution model toggle", () => {
  it.each(["first", "last", "linear", "influenced"] as const)(
    "reads the %s rows when the query string asks for it",
    async (model) => {
      const data = await loadRevenuePageData(TENANT, { model });
      expect(data.model).toBe(model);
      expect(revenueRollup.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ model }) }),
      );
    },
  );

  it("falls back to last touch rather than throwing on a stale bookmark", async () => {
    // The value comes off a query string; a bad one should show the page.
    const data = await loadRevenuePageData(TENANT, { model: "nonsense" });
    expect(data.model).toBe("last");
  });

  it("falls back to the current month on a malformed month", async () => {
    const data = await loadRevenuePageData(TENANT, { month: "August" });
    expect(data.month).toMatch(/^\d{4}-\d{2}$/);
  });

  it("actually changes the breakdown between models", async () => {
    aiVisit.findMany.mockResolvedValue([
      visitRow("v1", "chatgpt", "02"),
      visitRow("v1", "perplexity", "09"),
    ]);

    const first = await loadRevenuePageData(TENANT, { model: "first" });
    const last = await loadRevenuePageData(TENANT, { model: "last" });

    expect(first.bySource.map((r) => r.source)).toEqual(["chatgpt"]);
    expect(last.bySource.map((r) => r.source)).toEqual(["perplexity"]);
  });
});

// ─── Tenant isolation ───────────────────────────────────────────────────────

describe("tenant isolation", () => {
  it("scopes the visit read to the caller's tenant", async () => {
    await loadTouches(TENANT, MONTH);
    expect(aiVisit.findMany.mock.calls[0][0].where.tenantId).toBe(TENANT);
  });

  it("scopes the assumptions read, and uses findFirst rather than findUnique", async () => {
    await loadAssumptions(TENANT);
    expect(tenant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TENANT } }),
    );
  });

  it("scopes both share-of-voice reads to the tenant, not just the prompt set", async () => {
    // promptSetId alone would be a correct, indexed query that reads another
    // tenant's snapshots if the id ever came from a query string.
    await loadShares(TENANT, MONTH);
    expect(brandProfile.findFirst.mock.calls[0][0].where.tenantId).toBe(TENANT);
    expect(sovSnapshot.findFirst.mock.calls[0][0].where.tenantId).toBe(TENANT);
    expect(sovSnapshot.findMany.mock.calls[0][0].where.tenantId).toBe(TENANT);
  });

  it("scopes the rollup read and write", async () => {
    await readRollup(TENANT, MONTH, "last");
    expect(revenueRollup.findMany.mock.calls[0][0].where.tenantId).toBe(TENANT);

    await writeRollups(TENANT, MONTH);
    for (const call of revenueRollup.upsert.mock.calls) {
      expect(call[0].where.tenantId_month_model_mode.tenantId).toBe(TENANT);
      expect(call[0].create.tenantId).toBe(TENANT);
    }
  });

  it("puts the caller's tenant id on every query the page makes", async () => {
    await loadRevenuePageData(OTHER, {});

    const everyWhere = [
      ...aiVisit.findMany.mock.calls,
      ...sovSnapshot.findFirst.mock.calls,
      ...sovSnapshot.findMany.mock.calls,
      ...brandProfile.findFirst.mock.calls,
      ...revenueRollup.findMany.mock.calls,
    ].map((c) => (c[0] as { where: Record<string, unknown> }).where);

    expect(everyWhere.length).toBeGreaterThan(0);
    for (const where of everyWhere) {
      expect(where.tenantId).toBe(OTHER);
    }
    // The assumptions read is keyed on `id`, which IS the tenant id.
    expect(tenant.findFirst.mock.calls[0][0].where).toEqual({ id: OTHER });
  });
});

// ─── Share pooling ──────────────────────────────────────────────────────────

describe("loadShares", () => {
  it("pools engines by weight and returns fractions, not points", async () => {
    const shares = await loadShares(TENANT, MONTH);
    // Asturia 2+4=6 of 16 total weight.
    expect(shares.ownShare).toBeCloseTo(0.375, 10);
    expect(shares.topRivalShare).toBeCloseTo(0.625, 10);
    expect(shares.topRivalBrand).toBe("Rival Co");
  });

  it("splits per engine as well as pooled", async () => {
    const shares = await loadShares(TENANT, MONTH);
    const chatgpt = shares.byEngine.find((e) => e.engine === "CHATGPT")!;
    const claude = shares.byEngine.find((e) => e.engine === "CLAUDE")!;
    expect(chatgpt.ownShare).toBeCloseTo(0.25, 10);
    expect(claude.ownShare).toBeCloseTo(0.5, 10);
  });

  it("returns a zero share, not a crash, for a month with no snapshot", async () => {
    sovSnapshot.findFirst.mockResolvedValue(null);
    const shares = await loadShares(TENANT, MONTH);
    expect(shares.ownShare).toBe(0);
    expect(shares.asOf).toBeNull();
    expect(shares.brandName).toBe("Asturia");
  });

  it("returns empty for a tenant with no brand profile", async () => {
    brandProfile.findFirst.mockResolvedValue(null);
    const shares = await loadShares(TENANT, MONTH);
    expect(shares.ownShare).toBe(0);
    expect(shares.byEngine).toEqual([]);
  });
});

// ─── The page's stored-vs-live split ────────────────────────────────────────

describe("stored headline vs live breakdown", () => {
  it("prefers the stored row and says where it came from", async () => {
    revenueRollup.findMany.mockResolvedValue([
      { month: MONTH, model: "last", mode: "proxy", wonRevenue: 999, lostRevenueEst: 111 },
    ]);
    const data = await loadRevenuePageData(TENANT, { month: MONTH, model: "last" });

    expect(data.fromRollup).toBe(true);
    expect(data.wonRevenue).toBe(999);
    // 999 is not what today's assumptions produce, so the page must say so
    // rather than silently showing a number nobody can reproduce.
    expect(data.stale).toBe(true);
  });

  it("computes live when nothing has been rolled up yet", async () => {
    const data = await loadRevenuePageData(TENANT, { month: MONTH, model: "last" });
    expect(data.fromRollup).toBe(false);
    expect(data.stale).toBe(false);
    expect(data.wonRevenue).toBe(270);
  });

  it("labels a stored row with the mode it was computed under", async () => {
    // Not with today's mode — that would caption an August proxy figure
    // "measured" the day P2 ships.
    revenueRollup.findMany.mockResolvedValue([
      { month: MONTH, model: "last", mode: "proxy", wonRevenue: 270, lostRevenueEst: 180 },
    ]);
    prismaBag.aiConversion = aiConversion;
    aiConversion.findMany.mockResolvedValue([]);

    const data = await loadRevenuePageData(TENANT, { month: MONTH, model: "last" });
    expect(data.mode).toBe("proxy");
  });
});
