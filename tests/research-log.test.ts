// Research Log — the advisory record of what a workspace has already paid to
// research.
//
// The properties that matter, and why each is asserted rather than assumed:
//
//   1. recordResearch NEVER THROWS. It runs on the success path of analyses
//      the customer has already been charged for, so a log failure must not
//      turn a completed, billed lookup into a 500. It is also what lets this
//      ship ahead of its own migration — see the store's header.
//   2. IT IS WRITTEN ON DELIVERED SUCCESS, NOT AT SUBMIT. For the standard
//      queue those are minutes apart, and a task posted at 10:00 can expire
//      without ever returning. Logging research nobody received is worse than
//      no log.
//   3. NO ENGLISH IS STORED. The row carries a feature key and numbers; every
//      surface renders its own sentence. A prose column would ship English to
//      the French dashboard forever.
//   4. READS ARE TENANT-SCOPED.

import { beforeEach, describe, expect, it, vi } from "vitest";

// Typed loosely on purpose: these stand in for Prisma delegates whose real
// signatures are enormous, and the assertions below inspect the CALL, not the
// return type.
type Stub = ReturnType<typeof vi.fn<(...args: never[]) => Promise<unknown>>>;
const researchLog: { create: Stub; findMany: Stub; findFirst: Stub } = {
  create: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
};
const serpCheck: { update: Stub } = { update: vi.fn() };

vi.mock("@/lib/prisma", () => ({ prisma: { researchLog, serpCheck } }));

const store = await import("@/lib/research-log/store");
const { serpCheckOwner } = await import("@/lib/serp/task-owner");
const {
  RESEARCH_FEATURES,
  RESEARCH_FEATURE_HREFS,
  RESEARCH_REUSE_WINDOW_DAYS,
  isResearchFeature,
} = await import("@/lib/research-log/types");
const { RESEARCH_LOG_COPY } = await import("@/lib/i18n/dashboard");

const LOCALES = ["en", "fr", "de-CH"] as const;

beforeEach(() => {
  vi.clearAllMocks();
  researchLog.create.mockResolvedValue({ id: "log_1" });
  researchLog.findMany.mockResolvedValue([]);
  researchLog.findFirst.mockResolvedValue(null);
});

// ─── 1. The write never breaks the thing it records ──────────────────────────

describe("recordResearch is advisory and cannot break a paid analysis", () => {
  it("swallows a missing table and returns null", async () => {
    // Exactly what production looks like between this deploy and the psql
    // apply: the code is live, the table is not.
    researchLog.create.mockRejectedValue(
      new Error('relation "research_log" does not exist'),
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const id = await store.recordResearch({
      tenantId: "t1",
      feature: "backlinks",
      target: "example.com",
      costUsd: 0.368,
    });

    expect(id).toBeNull();
    // Swallowed, but not silenced: a log that has been failing for a month is
    // otherwise indistinguishable from a workspace that ran nothing.
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns the new row id on success", async () => {
    const id = await store.recordResearch({
      tenantId: "t1",
      feature: "domain_overview",
      target: "example.com",
      metrics: { keywords: 120 },
      costUsd: 0.02,
      sourceRef: "se_1",
    });
    expect(id).toBe("log_1");
    expect(researchLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "t1",
          feature: "domain_overview",
          target: "example.com",
          sourceRef: "se_1",
          costUsd: 0.02,
        }),
      }),
    );
  });

  it("stores counts, never a sentence", async () => {
    await store.recordResearch({
      tenantId: "t1",
      feature: "serp_check",
      target: "reputation software",
      metrics: { results: 100, serpFeatures: 4, locationCode: 2124 },
    });
    const data = ((researchLog.create.mock.calls[0] as unknown[])[0] as { data: Record<string, unknown> }).data;
    // The row must not carry a prose column at all. If one is ever added, this
    // fails and the i18n consequence gets argued for rather than shipped.
    expect(data).not.toHaveProperty("summary");
    expect(data.metrics).toEqual({ results: 100, serpFeatures: 4, locationCode: 2124 });
  });

  it("bounds an absurd target rather than writing it whole", async () => {
    await store.recordResearch({
      tenantId: "t1",
      feature: "backlinks",
      target: `https://example.com/${"a".repeat(5000)}`,
    });
    const data = ((researchLog.create.mock.calls[0] as unknown[])[0] as { data: { target: string } }).data;
    expect(data.target.length).toBe(2000);
  });
});

// ─── 2. Written on delivered success ─────────────────────────────────────────

describe("write points", () => {
  it("the SERP checker logs when the QUEUE DELIVERS, not when the task is posted", async () => {
    serpCheck.update.mockResolvedValue({
      id: "chk_1",
      tenantId: "t1",
      keyword: "reputation software",
      costUsd: 0.006,
      locationCode: 2124,
    });

    await serpCheckOwner.complete("chk_1", [
      { items: [{ type: "organic", rank_group: 1, url: "https://a.example", domain: "a.example" }] },
    ]);

    expect(researchLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "t1",
          feature: "serp_check",
          target: "reputation software",
          sourceRef: "chk_1",
        }),
      }),
    );
  });

  it("a FAILED SERP task logs nothing — research nobody received is not research", async () => {
    serpCheck.update.mockResolvedValue({});
    await serpCheckOwner.fail("chk_2", "provider timeout");
    expect(researchLog.create).not.toHaveBeenCalled();
  });
});

// ─── 3. Reads ────────────────────────────────────────────────────────────────

describe("reads", () => {
  const row = (createdAt: Date) => ({
    id: "log_1",
    feature: "backlinks",
    target: "example.com",
    metrics: { referringDomains: 1200 },
    costUsd: 0.368,
    sourceRef: "bl_1",
    createdAt,
  });

  it("is tenant-scoped and newest-first", async () => {
    await store.readResearchLog("tenant_a", { limit: 5 });
    expect(researchLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant_a" }),
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    );
  });

  it("marks an entry inside the reuse window reusable, and one outside it not", async () => {
    const now = new Date("2026-09-05T12:00:00Z");
    const fresh = new Date(now.getTime() - 3 * 24 * 3600_000);
    const stale = new Date(now.getTime() - (RESEARCH_REUSE_WINDOW_DAYS + 1) * 24 * 3600_000);
    researchLog.findMany.mockResolvedValue([row(fresh), { ...row(stale), id: "log_2" }]);

    const entries = await store.readResearchLog("t1", { now });
    expect(entries[0].reusable).toBe(true);
    expect(entries[0].ageHours).toBeCloseTo(72, 0);
    expect(entries[1].reusable).toBe(false);
    // Decimal never crosses raw.
    expect(typeof entries[0].costUsd).toBe("number");
    expect(typeof entries[0].createdAt).toBe("string");
  });

  it("the reuse probe bounds by the window and the exact target", async () => {
    const now = new Date("2026-09-05T12:00:00Z");
    await store.findRecentResearch("t1", "backlinks", "  example.com  ", now);
    const where = (researchLog.findFirst.mock.calls[0] as unknown[])[0] as {
      where: {
        tenantId: string;
        feature: string;
        target: string;
        createdAt: { gte: Date };
      };
    };
    expect(where.where).toMatchObject({
      tenantId: "t1",
      feature: "backlinks",
      target: "example.com",
    });
    expect(now.getTime() - where.where.createdAt.gte.getTime()).toBe(
      RESEARCH_REUSE_WINDOW_DAYS * 24 * 3600_000,
    );
  });

  it("a read against a missing table returns [] rather than blanking the hub", async () => {
    researchLog.findMany.mockRejectedValue(new Error('relation "research_log" does not exist'));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await store.readResearchLog("t1")).toEqual([]);
    spy.mockRestore();
  });
});

// ─── 4. The vocabulary is closed, and fully translated ───────────────────────

describe("feature vocabulary", () => {
  it("every feature has a label in all three catalogs and a page to open", () => {
    for (const feature of RESEARCH_FEATURES) {
      expect(RESEARCH_FEATURE_HREFS[feature]).toMatch(/^\/visibility\/tools\//);
      for (const locale of LOCALES) {
        expect(RESEARCH_LOG_COPY[locale].features[feature]?.length).toBeGreaterThan(0);
      }
    }
  });

  it("every catalog has the panel strings and both age forms", () => {
    for (const locale of LOCALES) {
      const t = RESEARCH_LOG_COPY[locale];
      expect(t.panelTitle.length).toBeGreaterThan(0);
      expect(t.panelHint.length).toBeGreaterThan(0);
      expect(t.reusable.length).toBeGreaterThan(0);
      expect(t.ageJustNow.length).toBeGreaterThan(0);
      // Singular and plural are separate strings in every locale, because
      // "1 days ago" is the bug this catches.
      expect(t.ageDays(1)).not.toBe(t.ageDays(2));
      expect(t.ageHours(3)).toContain("3");
    }
  });

  it("de-CH uses ss, never sz", () => {
    const t = RESEARCH_LOG_COPY["de-CH"];
    const all = [t.panelTitle, t.panelHint, t.reusable, t.ageDays(2), ...Object.values(t.features)];
    for (const line of all) expect(line).not.toContain("ß");
  });

  it("rejects a feature key outside the closed set", () => {
    expect(isResearchFeature("backlinks")).toBe(true);
    expect(isResearchFeature("something_new")).toBe(false);
  });
});
