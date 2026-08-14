// tests/citation-finder-store.test.ts
//
// The database-facing half of Citation Finder: tenant isolation on every query,
// the watermark that makes the rollup idempotent, the preset filter's WHERE
// clause, and the derived cells the read model computes.
//
// Prisma and the logger are stubbed; everything else — the scoping, the
// merging, the sort-key mapping, the JSON coercion — is the real code path.
// Same approach as tests/sov-rollup.test.ts, and for the same reason: this
// box's .env is not readable by the test account and there is no test database,
// so what can be verified without one is verified thoroughly.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const { brandProfile, citation, source, transaction, loggerFns } = vi.hoisted(() => {
  const source = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  };
  const citation = { findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() };
  return {
    brandProfile: { findMany: vi.fn() },
    citation,
    source,
    // The real $transaction hands the callback a client; the stub hands it the
    // same mocks, so a query issued inside the transaction is asserted exactly
    // like one issued outside it.
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ source, citation }),
    ),
    loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: { brandProfile, citation, source, $transaction: transaction },
}));

vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));

import {
  asCountMap,
  countUnrolledCitations,
  listCitationBrandProfiles,
  loadUnrolledCitations,
  rollUpBatch,
  rollUpBrandProfile,
  ROLLUP_BATCH,
} from "@/lib/citations/store";
import { loadCitationPageData, CITATION_PAGE_SIZE } from "@/lib/citations/read";

const TENANT = "tenant_a";
const OTHER_TENANT = "tenant_b";
const BRAND = "brand_1";

const PROFILE = { brandProfileId: BRAND, tenantId: TENANT, brandName: "Us" };

beforeEach(() => {
  vi.clearAllMocks();
  brandProfile.findMany.mockResolvedValue([]);
  citation.findMany.mockResolvedValue([]);
  citation.updateMany.mockResolvedValue({ count: 0 });
  citation.count.mockResolvedValue(0);
  source.findUnique.mockResolvedValue(null);
  source.findFirst.mockResolvedValue(null);
  source.findMany.mockResolvedValue([]);
  source.upsert.mockResolvedValue({ id: "src_1" });
  source.count.mockResolvedValue(0);
});

/** Every `where` a mock was called with, flattened. */
function wheres(mock: { mock: { calls: unknown[][] } }): Record<string, unknown>[] {
  return mock.mock.calls.map(
    (call) => (call[0] as { where?: Record<string, unknown> })?.where ?? {},
  );
}

// ─── Tenant isolation ───────────────────────────────────────────────────────

describe("tenant isolation", () => {
  it("scopes the brand-profile sweep when a tenant is named, and not when it is not", async () => {
    await listCitationBrandProfiles(TENANT);
    expect(wheres(brandProfile.findMany)[0]).toMatchObject({ tenantId: TENANT });

    brandProfile.findMany.mockClear();
    await listCitationBrandProfiles();
    // The nightly sweep visits every tenant; an undefined filter here is the
    // intended behaviour, not a missing scope.
    expect(wheres(brandProfile.findMany)[0]).not.toHaveProperty("tenantId");
  });

  it("only ever sweeps brand profiles with tracking on", async () => {
    await listCitationBrandProfiles(TENANT);
    expect(wheres(brandProfile.findMany)[0]).toMatchObject({ trackingActive: true });
  });

  it("scopes the unrolled-citation read on BOTH the citation and its run", async () => {
    await loadUnrolledCitations(BRAND, TENANT);
    const where = wheres(citation.findMany)[0];

    expect(where).toMatchObject({ tenantId: TENANT, sourceId: null });
    // Defence in depth: a brandProfileId is a cuid an attacker could hold from
    // another tenant, so the join is scoped too.
    expect(where.promptRun).toMatchObject({
      tenantId: TENANT,
      status: "OK",
      prompt: { brandProfileId: BRAND },
    });
  });

  it("scopes the citation stamp, so a stray id cannot reach across tenants", async () => {
    citation.findMany.mockResolvedValue([citationRow("c1", "g2.com")]);
    const batch = await loadUnrolledCitations(BRAND, TENANT);
    await rollUpBatch(PROFILE, batch);

    expect(wheres(citation.updateMany)[0]).toMatchObject({ tenantId: TENANT });
  });

  it("scopes the source upsert to the brand profile that owns it", async () => {
    citation.findMany.mockResolvedValue([citationRow("c1", "g2.com")]);
    const batch = await loadUnrolledCitations(BRAND, TENANT);
    await rollUpBatch(PROFILE, batch);

    const call = source.upsert.mock.calls[0][0] as {
      where: { brandProfileId_domain: { brandProfileId: string; domain: string } };
      create: { tenantId: string; brandProfileId: string };
    };
    expect(call.where.brandProfileId_domain).toEqual({
      brandProfileId: BRAND,
      domain: "g2.com",
    });
    expect(call.create).toMatchObject({ tenantId: TENANT, brandProfileId: BRAND });
  });

  it("scopes every read the page makes to the caller's tenant", async () => {
    brandProfile.findMany.mockResolvedValue([{ id: BRAND, name: "Us" }]);
    await loadCitationPageData(TENANT, {});

    expect(wheres(brandProfile.findMany)[0]).toMatchObject({ tenantId: TENANT });
    for (const where of [...wheres(source.findMany), ...wheres(source.count)]) {
      expect(where).toMatchObject({ tenantId: TENANT });
    }
    expect(wheres(source.findMany)[0]).not.toMatchObject({ tenantId: OTHER_TENANT });
  });

  it("falls back to the tenant's own first brand when the query names a foreign id", async () => {
    // A stale bookmark must render the page, not 500 and not leak. The tenant
    // scope on the profile query is what makes the fallback safe.
    brandProfile.findMany.mockResolvedValue([{ id: BRAND, name: "Us" }]);
    const data = await loadCitationPageData(TENANT, { brandProfileId: "brand_from_tenant_b" });

    expect(data.selectedBrandProfileId).toBe(BRAND);
    expect(wheres(source.findMany)[0]).toMatchObject({ brandProfileId: BRAND });
  });

  it("scopes the unclaimed-citation count when a tenant is named", async () => {
    await countUnrolledCitations(TENANT);
    expect(wheres(citation.count)[0]).toMatchObject({ sourceId: null, tenantId: TENANT });
  });
});

// ─── The watermark ──────────────────────────────────────────────────────────

describe("the sourceId watermark", () => {
  it("only ever reads citations no rollup has claimed", async () => {
    await loadUnrolledCitations(BRAND, TENANT);
    expect(wheres(citation.findMany)[0]).toMatchObject({ sourceId: null });
  });

  it("stamps exactly the citations it counted, with the source it upserted", async () => {
    citation.findMany.mockResolvedValue([
      citationRow("c1", "g2.com"),
      citationRow("c2", "g2.com"),
      citationRow("c3", "sec.gov"),
    ]);
    source.upsert
      .mockResolvedValueOnce({ id: "src_g2" })
      .mockResolvedValueOnce({ id: "src_gov" });

    const batch = await loadUnrolledCitations(BRAND, TENANT);
    await rollUpBatch(PROFILE, batch);

    const calls = citation.updateMany.mock.calls.map(
      (call) => call[0] as { where: { id: { in: string[] } }; data: { sourceId: string } },
    );
    expect(calls[0].where.id.in).toEqual(["c1", "c2"]);
    expect(calls[0].data.sourceId).toBe("src_g2");
    expect(calls[1].where.id.in).toEqual(["c3"]);
    expect(calls[1].data.sourceId).toBe("src_gov");
  });

  it("upserts and stamps inside ONE transaction", async () => {
    // The whole idempotency argument: if the stamp does not commit, neither
    // does the count it came from.
    citation.findMany.mockResolvedValue([citationRow("c1", "g2.com")]);
    const batch = await loadUnrolledCitations(BRAND, TENANT);
    await rollUpBatch(PROFILE, batch);

    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it("does nothing at all for an empty batch", async () => {
    const result = await rollUpBatch(PROFILE, []);

    expect(result).toEqual({ citations: 0, domains: 0 });
    expect(transaction).not.toHaveBeenCalled();
    expect(source.upsert).not.toHaveBeenCalled();
  });
});

// ─── Upsert accumulation, through the store ─────────────────────────────────

describe("upsert accumulation", () => {
  it("adds a fresh batch onto the stored row rather than replacing it", async () => {
    source.findUnique.mockResolvedValue({
      id: "src_g2",
      citationCount: 10,
      enginesSeen: { CLAUDE: 10 },
      brandCitations: 0,
      competitorCitations: 10,
      citesCompetitors: { Rival: 10 },
      brandsSupported: ["Rival"],
      firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
      lastSeenAt: new Date("2026-07-01T00:00:00.000Z"),
    });
    citation.findMany.mockResolvedValue([
      citationRow("c1", "g2.com", { engine: "GEMINI", competitors: ["Rival"] }),
    ]);

    const batch = await loadUnrolledCitations(BRAND, TENANT);
    await rollUpBatch(PROFILE, batch);

    const update = (source.upsert.mock.calls[0][0] as { update: Record<string, unknown> }).update;
    expect(update.citationCount).toBe(11);
    expect(update.enginesSeen).toEqual({ CLAUDE: 10, GEMINI: 1 });
    expect(update.distinctEngines).toBe(2);
    expect(update.citesCompetitors).toEqual({ Rival: 11 });
    expect(update.competitorCitations).toBe(11);
  });

  it("writes the fresh row as-is when the domain is new", async () => {
    citation.findMany.mockResolvedValue([
      citationRow("c1", "g2.com", { brandMentioned: true }),
    ]);

    const batch = await loadUnrolledCitations(BRAND, TENANT);
    await rollUpBatch(PROFILE, batch);

    const create = (source.upsert.mock.calls[0][0] as { create: Record<string, unknown> }).create;
    expect(create).toMatchObject({
      domain: "g2.com",
      kind: "REVIEW_SITE",
      citationCount: 1,
      brandCitations: 1,
      competitorCitations: 0,
    });
  });

  it("prefers the analysis's brandMentioned and falls back to the run's", async () => {
    citation.findMany.mockResolvedValue([
      citationRow("c1", "g2.com", { brandMentioned: false, analysisBrandMentioned: true }),
    ]);
    const batch = await loadUnrolledCitations(BRAND, TENANT);
    expect(batch[0].brandMentioned).toBe(true);

    citation.findMany.mockResolvedValue([
      citationRow("c2", "g2.com", { brandMentioned: true, analysisBrandMentioned: undefined }),
    ]);
    const fallback = await loadUnrolledCitations(BRAND, TENANT);
    expect(fallback[0].brandMentioned).toBe(true);
  });

  it("drops competitor mentions the classifier ruled out", async () => {
    citation.findMany.mockResolvedValue([
      {
        ...citationRow("c1", "g2.com"),
        promptRun: {
          engine: "CLAUDE",
          brandMentioned: false,
          analysis: { brandMentioned: false },
          competitorMentions: [
            { name: "Rival", classification: "RIVAL" },
            { name: "ChatGPT", classification: "PLATFORM" },
            { name: "software", classification: "GENERIC" },
            // Null is "not yet judged" and is included, matching SoV.
            { name: "Legacy", classification: null },
          ],
        },
      },
    ]);

    const batch = await loadUnrolledCitations(BRAND, TENANT);
    expect(batch[0].competitors).toEqual(["Rival", "Legacy"]);
  });

  it("stops looping once a short batch says the queue is drained", async () => {
    citation.findMany.mockResolvedValue([citationRow("c1", "g2.com")]);
    await rollUpBrandProfile(PROFILE);

    expect(citation.findMany).toHaveBeenCalledTimes(1);
  });

  it("warns rather than grinding when the nightly batch cap is hit", async () => {
    citation.findMany.mockResolvedValue(
      Array.from({ length: ROLLUP_BATCH }, (_, i) => citationRow(`c${i}`, "g2.com")),
    );
    await rollUpBrandProfile(PROFILE, 2);

    expect(citation.findMany).toHaveBeenCalledTimes(2);
    expect(loggerFns.warn).toHaveBeenCalled();
  });
});

// ─── The preset filter ──────────────────────────────────────────────────────

describe("the preset filter query", () => {
  beforeEach(() => {
    brandProfile.findMany.mockResolvedValue([{ id: BRAND, name: "Us" }]);
  });

  it("asks for zero brand citations AND at least one competitor citation", async () => {
    await loadCitationPageData(TENANT, { preset: "opportunity" });

    expect(wheres(source.findMany)[0]).toMatchObject({
      tenantId: TENANT,
      brandProfileId: BRAND,
      brandCitations: 0,
      competitorCitations: { gt: 0 },
    });
  });

  it("adds no such clause when the preset is off", async () => {
    await loadCitationPageData(TENANT, {});
    const where = wheres(source.findMany)[0];

    expect(where).not.toHaveProperty("brandCitations");
    expect(where).not.toHaveProperty("competitorCitations");
  });

  it("counts the preset separately, so the chip can say how many it WOULD show", async () => {
    source.count.mockResolvedValueOnce(120).mockResolvedValueOnce(7);
    const data = await loadCitationPageData(TENANT, {});

    expect(data.total).toBe(120);
    expect(data.opportunityCount).toBe(7);
    // The second count carries the preset even though the page does not.
    expect(wheres(source.count)[1]).toMatchObject({
      brandCitations: 0,
      competitorCitations: { gt: 0 },
    });
  });

  it("treats an unknown preset as off rather than erroring", async () => {
    const data = await loadCitationPageData(TENANT, { preset: "../../etc/passwd" });

    expect(data.preset).toBe("all");
    expect(wheres(source.findMany)[0]).not.toHaveProperty("brandCitations");
  });

  it("combines the preset with a kind filter", async () => {
    await loadCitationPageData(TENANT, { preset: "opportunity", kind: "REVIEW_SITE" });

    expect(wheres(source.findMany)[0]).toMatchObject({
      brandCitations: 0,
      competitorCitations: { gt: 0 },
      kind: "REVIEW_SITE",
    });
  });

  it("ignores a kind that is not a real CitationKind", async () => {
    const data = await loadCitationPageData(TENANT, { kind: "NOT_A_KIND" });

    expect(data.kind).toBeNull();
    expect(wheres(source.findMany)[0]).not.toHaveProperty("kind");
  });
});

// ─── Sorting and derived cells ──────────────────────────────────────────────

describe("the read model", () => {
  beforeEach(() => {
    brandProfile.findMany.mockResolvedValue([{ id: BRAND, name: "Us" }]);
  });

  it.each([
    ["domain", "domain"],
    ["kind", "kind"],
    ["engines", "distinctEngines"],
    ["seen", "citationCount"],
    ["citesYou", "brandCitations"],
    ["rivals", "competitorCitations"],
    ["lastSeen", "lastSeenAt"],
  ])("sorts %s on the %s column, in the database", async (key, column) => {
    await loadCitationPageData(TENANT, { sort: key, dir: "asc" });

    const orderBy = (source.findMany.mock.calls[0][0] as { orderBy: Record<string, string>[] })
      .orderBy;
    expect(orderBy[0]).toEqual({ [column]: "asc" });
    // Ties broken by domain, or pagination could hide a row between pages.
    expect(orderBy[1]).toEqual({ domain: "asc" });
  });

  it("falls back to the citation count for an unknown sort key", async () => {
    const data = await loadCitationPageData(TENANT, { sort: "; DROP TABLE sources" });

    expect(data.sort).toBe("seen");
    const orderBy = (source.findMany.mock.calls[0][0] as { orderBy: Record<string, string>[] })
      .orderBy;
    expect(orderBy[0]).toEqual({ citationCount: "desc" });
  });

  it("derives citesYou from brandCitations rather than reading a stored flag", async () => {
    source.findFirst.mockResolvedValue({ id: "src_1" });
    source.findMany.mockResolvedValue([
      sourceRow({ domain: "g2.com", brandCitations: 3 }),
      sourceRow({ domain: "sec.gov", brandCitations: 0 }),
    ]);

    const data = await loadCitationPageData(TENANT, {});

    expect(data.rows[0].citesYou).toBe(true);
    expect(data.rows[1].citesYou).toBe(false);
  });

  it("orders the rival cell biggest first and caps it", async () => {
    source.findFirst.mockResolvedValue({ id: "src_1" });
    source.findMany.mockResolvedValue([
      sourceRow({
        citesCompetitors: { Small: 1, Biggest: 50, Middle: 9, Tiny: 1, Also: 4 },
      }),
    ]);

    const data = await loadCitationPageData(TENANT, {});

    expect(data.rows[0].topRivals).toEqual([
      { brand: "Biggest", count: 50 },
      { brand: "Middle", count: 9 },
      { brand: "Also", count: 4 },
    ]);
  });

  it("orders the engine cell busiest first", async () => {
    source.findFirst.mockResolvedValue({ id: "src_1" });
    source.findMany.mockResolvedValue([
      sourceRow({ enginesSeen: { GEMINI: 2, CLAUDE: 9, PERPLEXITY: 5 } }),
    ]);

    const data = await loadCitationPageData(TENANT, {});

    expect(data.rows[0].engines).toEqual(["CLAUDE", "PERPLEXITY", "GEMINI"]);
  });

  it("pages from 1, and refuses a junk page number", async () => {
    await loadCitationPageData(TENANT, { page: 3 });
    expect((source.findMany.mock.calls[0][0] as { skip: number }).skip).toBe(
      2 * CITATION_PAGE_SIZE,
    );

    source.findMany.mockClear();
    await loadCitationPageData(TENANT, { page: -7 });
    expect((source.findMany.mock.calls[0][0] as { skip: number }).skip).toBe(0);
  });

  it("reports no data for a tenant with brand profiles but no sources yet", async () => {
    source.findFirst.mockResolvedValue(null);
    const data = await loadCitationPageData(TENANT, {});

    expect(data.hasData).toBe(false);
  });

  it("reports no data for a tenant with no brand profile at all", async () => {
    brandProfile.findMany.mockResolvedValue([]);
    const data = await loadCitationPageData(TENANT, {});

    expect(data.hasData).toBe(false);
    expect(source.findMany).not.toHaveBeenCalled();
  });
});

// ─── JSON coercion ──────────────────────────────────────────────────────────

describe("asCountMap", () => {
  // The column is Json: it can legally hold anything, and a row written by hand
  // must degrade rather than crash the night's rollup.
  it.each([
    [null, {}],
    [undefined, {}],
    ["a string", {}],
    [42, {}],
    [["an", "array"], {}],
    [{ CLAUDE: 3 }, { CLAUDE: 3 }],
    [{ CLAUDE: 3, BAD: "x", ALSO_BAD: null }, { CLAUDE: 3 }],
    [{ CLAUDE: Number.NaN }, {}],
    [{}, {}],
  ])("%s → %s", (input, expected) => {
    expect(asCountMap(input)).toEqual(expected);
  });
});

// ─── Fixtures ───────────────────────────────────────────────────────────────

function citationRow(
  id: string,
  domain: string,
  over: {
    engine?: string;
    brandMentioned?: boolean;
    analysisBrandMentioned?: boolean;
    competitors?: string[];
  } = {},
) {
  return {
    id,
    domain,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    promptRun: {
      engine: over.engine ?? "CLAUDE",
      brandMentioned: over.brandMentioned ?? false,
      analysis:
        over.analysisBrandMentioned === undefined
          ? null
          : { brandMentioned: over.analysisBrandMentioned },
      competitorMentions: (over.competitors ?? []).map((name) => ({
        name,
        classification: "RIVAL",
      })),
    },
  };
}

function sourceRow(over: Record<string, unknown> = {}) {
  return {
    id: "src_1",
    domain: "g2.com",
    kind: "REVIEW_SITE",
    enginesSeen: { CLAUDE: 1 },
    citationCount: 1,
    brandCitations: 0,
    competitorCitations: 0,
    citesCompetitors: {},
    lastSeenAt: new Date("2026-08-01T00:00:00.000Z"),
    ...over,
  };
}
