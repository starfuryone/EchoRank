// Site Explorer's Keywords and Pages tabs, and the shared cache underneath.
//
// THE PROPERTY THE WHOLE BUILDOUT RESTS ON: paging and filtering NEVER call
// the provider. The analysis fetches a wide set once — a thousand keywords,
// five hundred pages — and every subsequent question is answered from what is
// stored. If that ever stops being true, a customer dragging a slider spends
// their monthly allowance.
//
// The rest is the ordering that makes the tables correct: filter, then sort,
// then page. Any other order looks right and is not.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const siteExplorerAnalysis = { findFirst: vi.fn(), create: vi.fn() };
const seoApiCall = { count: vi.fn(async () => 0), aggregate: vi.fn(async () => ({ _sum: { costUsd: 0 } })) };
const researchLog = { create: vi.fn(async () => ({ id: "log_1" })) };
vi.mock("@/lib/prisma", () => ({
  prisma: { siteExplorerAnalysis, seoApiCall, researchLog },
}));

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const seoMeteredCallResult = vi.fn();
vi.mock("@/lib/dataforseo/metering", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dataforseo/metering")>()),
  seoMeteredCallResult: (...args: unknown[]) => seoMeteredCallResult(...args),
}));

const readCache = vi.fn(async () => null as unknown);
const writeCache = vi.fn(async () => true);
vi.mock("@/lib/spaces-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/spaces-cache")>()),
  readCache: (...args: unknown[]) => readCache(...(args as [])),
  writeCache: (...args: unknown[]) => writeCache(...(args as [])),
}));

const redisStore = new Map<string, number>();
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => ({
    incr: vi.fn(async (key: string) => {
      const next = (redisStore.get(key) ?? 0) + 1;
      redisStore.set(key, next);
      return next;
    }),
    decr: vi.fn(async () => 0),
    expire: vi.fn(async () => 1),
    get: vi.fn(async () => null),
  }),
}));

const { GET } = await import("@/app/api/seo/v1/site-explorer/table/route");
const { runAnalysis, siteExplorerCacheKey } = await import("@/lib/site-explorer/service");
const {
  applyTable,
  filterKeywords,
  filterPages,
  paginate,
  sortRows,
  normalizePageSize,
  PAGE_SIZES,
  DEFAULT_PAGE_SIZE,
  isKeywordSortField,
} = await import("@/lib/site-explorer/pagination");
const { parseDomainPages } = await import("@/lib/site-explorer/parse");
const {
  RANKED_KEYWORDS_LIMIT,
  RELEVANT_PAGES_LIMIT,
  SITE_EXPLORER_CACHE_DAYS,
} = await import("@/lib/site-explorer/options");

const TENANT = "tenant_a";

function keyword(overrides: Partial<Record<string, unknown>> = {}) {
  return { keyword: "widget", position: 5, searchVolume: 1000, etv: 120, url: "https://example.com/a", ...overrides };
}

function pageRow(overrides: Partial<Record<string, unknown>> = {}) {
  return { url: "https://example.com/a", keywordCount: 10, etv: 500, topPositions: 2, ...overrides };
}

function storedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "se_1",
    tenantId: TENANT,
    domain: "example.com",
    locationCode: 2124,
    languageCode: "en",
    status: "completed",
    costUsd: 0.1,
    overview: { etv: 1000, keywordCount: 900, estimatedPaidTrafficCost: 50, distribution: {} },
    rankedKeywords: {
      items: Array.from({ length: 120 }, (_, i) =>
        keyword({ keyword: `kw ${i}`, position: (i % 100) + 1, searchVolume: i * 10, etv: i }),
      ),
      totalCount: 9000,
    },
    competitors: { items: [] },
    backlinks: null,
    pages: {
      items: Array.from({ length: 40 }, (_, i) =>
        pageRow({ url: `https://example.com/p${i}`, keywordCount: i, etv: i * 5 }),
      ),
      totalCount: 800,
    },
    failedSections: [],
    createdAt: new Date("2026-09-05T12:00:00Z"),
    ...overrides,
  };
}

function request(params: Record<string, string>) {
  const url = new URL("https://echorank360.com/api/seo/v1/site-explorer/table");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  redisStore.clear();
  requirePaidPlan.mockResolvedValue({ tenantId: TENANT, tenant: { planType: "GROWTH" } });
  siteExplorerAnalysis.findFirst.mockResolvedValue(storedRow());
  readCache.mockResolvedValue(null);
  seoApiCall.count.mockResolvedValue(0);
});

// ─── 1. Paging is free ───────────────────────────────────────────────────────

describe("paging and filtering never call the provider", () => {
  it("serves a page from the stored analysis with no metered call", async () => {
    const res = await GET(request({ id: "se_1", page: "2", pageSize: "25" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.rows).toHaveLength(25);
    expect(body.page).toBe(2);
    // The property this whole file exists for.
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    expect(seoApiCall.count).not.toHaveBeenCalled();
  });

  it("filters without a provider call, however narrow", async () => {
    const res = await GET(
      request({ id: "se_1", minVolume: "500", minPosition: "1", maxPosition: "10" }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    for (const row of body.rows) {
      expect(row.searchVolume).toBeGreaterThanOrEqual(500);
      expect(row.position).toBeLessThanOrEqual(10);
    }
  });

  it("is tenant-scoped, and 404s another workspace's analysis", async () => {
    siteExplorerAnalysis.findFirst.mockResolvedValue(null);
    const res = await GET(request({ id: "se_owned_by_b" }));
    expect(res.status).toBe(404);
    expect(siteExplorerAnalysis.findFirst).toHaveBeenCalledWith({
      where: { id: "se_owned_by_b", tenantId: TENANT },
    });
  });

  it("reports the provider's own total beside the filtered count", async () => {
    // "50 of 500 fetched, of 9,000 on the domain" — without this the fetched
    // set reads as everything the domain ranks for.
    const body = await (await GET(request({ id: "se_1" }))).json();
    expect(body.total).toBe(120);
    expect(body.fetched).toBe(9000);
  });

  it("serves the Pages tab from the same stored row", async () => {
    const body = await (await GET(request({ id: "se_1", tab: "pages", minKeywords: "20" }))).json();
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    for (const row of body.rows) expect(row.keywordCount).toBeGreaterThanOrEqual(20);
  });
});

// ─── 2. Order of operations ──────────────────────────────────────────────────

describe("filter, then sort, then page", () => {
  const rows = [
    keyword({ keyword: "a", searchVolume: 10, etv: 1 }),
    keyword({ keyword: "b", searchVolume: 900, etv: 90 }),
    keyword({ keyword: "c", searchVolume: 500, etv: 50 }),
    keyword({ keyword: "d", searchVolume: 700, etv: 70 }),
  ];

  it("pages the FILTERED set, not the raw one", async () => {
    // Paging before filtering returns page 1 of the unfiltered rows with the
    // filter applied to that page — a table that empties as you scroll.
    const result = applyTable(rows, {
      filter: (r) => filterKeywords(r, { minVolume: 500 }),
      sortField: "etv",
      sortOrder: "desc",
      page: 1,
      pageSize: 25,
    });
    expect(result.total).toBe(3);
    expect(result.rows.map((r) => r.keyword)).toEqual(["b", "d", "c"]);
  });

  it("clamps a page past the end instead of emptying the table", async () => {
    // How you get here: filtering while on page 9 of 12. An empty table there
    // reads as "your filter matched nothing" when it matched plenty.
    //
    // pageSize 25 rather than an arbitrary number: paginate normalises to the
    // offered set, so a size the UI cannot request is not a case worth
    // asserting.
    const many = Array.from({ length: 30 }, (_, i) => keyword({ keyword: `k${i}` }));
    const result = paginate(many, { page: 99, pageSize: 25 });
    expect(result.totalPages).toBe(2);
    expect(result.page).toBe(2);
    expect(result.rows).toHaveLength(5);
  });

  it("sorts missing values LAST in both directions", async () => {
    // A keyword with no volume is not the lowest-volume keyword — it is an
    // unmeasured one, and heading an ascending sort with it makes "least
    // searched" a list of things nobody measured.
    const withGap = [
      { keyword: "x", searchVolume: 5 },
      { keyword: "y", searchVolume: null as unknown as number },
      { keyword: "z", searchVolume: 50 },
    ];
    expect(sortRows(withGap, "searchVolume", "asc").map((r) => r.keyword)).toEqual([
      "x",
      "z",
      "y",
    ]);
    expect(sortRows(withGap, "searchVolume", "desc").map((r) => r.keyword)).toEqual([
      "z",
      "x",
      "y",
    ]);
  });

  it("filters pages by URL, keyword count and traffic", async () => {
    const pages = [
      pageRow({ url: "https://example.com/blog/a", keywordCount: 5, etv: 10 }),
      pageRow({ url: "https://example.com/pricing", keywordCount: 50, etv: 900 }),
    ];
    expect(filterPages(pages, { query: "BLOG" })).toHaveLength(1);
    expect(filterPages(pages, { minKeywords: 10 })).toHaveLength(1);
    expect(filterPages(pages, { minTraffic: 500 })[0].url).toContain("pricing");
    // No filter is not an empty filter.
    expect(filterPages(pages, {})).toHaveLength(2);
  });

  it("matches accents and case insensitively", async () => {
    const rows = [keyword({ keyword: "café near me" }), keyword({ keyword: "tea" })];
    expect(filterKeywords(rows, { query: "CAFE" })).toHaveLength(1);
  });

  it("bounds the page size to the offered set", async () => {
    for (const size of PAGE_SIZES) expect(normalizePageSize(size)).toBe(size);
    // A caller asking for 100,000 rows gets a table, not the whole set.
    expect(normalizePageSize(100_000)).toBe(DEFAULT_PAGE_SIZE);
    expect(normalizePageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
  });

  it("refuses to sort by a field that is not a column", async () => {
    expect(isKeywordSortField("etv")).toBe(true);
    expect(isKeywordSortField("__proto__")).toBe(false);
    expect(isKeywordSortField("url")).toBe(false);
  });
});

// ─── 3. The wide fetch and the shared cache ─────────────────────────────────

describe("the analysis fetches wide, once", () => {
  beforeEach(() => {
    seoMeteredCallResult.mockImplementation(async (_t: string, path: string) => ({
      data: [{ items: [], total_count: 0, metrics: { organic: {} } }],
      billing: { path: path.split("/"), costUsd: 0.02 },
    }));
    siteExplorerAnalysis.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...storedRow(),
        ...data,
        id: "se_new",
      }),
    );
    // No stored row: the outer beforeEach seeds one, which would be a cache hit
    // and skip the fetch this block is about.
    siteExplorerAnalysis.findFirst.mockResolvedValue(null);
  });

  it("asks for a thousand keywords and five hundred pages", async () => {
    await runAnalysis(TENANT, "GROWTH", {
      domain: "example.com",
      locationCode: 2124,
      languageCode: "en",
    });
    const tasks = Object.fromEntries(
      seoMeteredCallResult.mock.calls.map((c) => [c[1] as string, c[2] as { limit?: number }]),
    );
    // The cost lever. Wide enough that filtering is filtering the site rather
    // than a sample — see options.ts for the trade.
    expect(tasks["v3/dataforseo_labs/google/ranked_keywords/live"].limit).toBe(
      RANKED_KEYWORDS_LIMIT,
    );
    expect(tasks["v3/dataforseo_labs/google/relevant_pages/live"].limit).toBe(
      RELEVANT_PAGES_LIMIT,
    );
  });

  it("checks the shared cache BEFORE the allowance, and a hit spends nothing", async () => {
    seoApiCall.count.mockResolvedValue(999_999);
    readCache.mockResolvedValue({
      overview: { etv: 10, keywordCount: 5, estimatedPaidTrafficCost: 1, distribution: {} },
      rankedKeywords: { items: [], totalCount: 0 },
      competitors: { items: [] },
      backlinks: null,
      pages: { items: [], totalCount: 0 },
      failedSections: [],
    });
    siteExplorerAnalysis.findFirst.mockResolvedValue(null);

    const { cached } = await runAnalysis(TENANT, "GROWTH", {
      domain: "example.com",
      locationCode: 2124,
      languageCode: "en",
    });

    expect(cached).toBe(true);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
    const data = siteExplorerAnalysis.create.mock.calls[0][0].data as { costUsd: number };
    expect(data.costUsd).toBe(0);
  });

  it("puts the MARKET in the cache key — one domain, two answers", () => {
    const ca = siteExplorerCacheKey({ domain: "example.com", locationCode: 2124, languageCode: "en" });
    const us = siteExplorerCacheKey({ domain: "example.com", locationCode: 2840, languageCode: "en" });
    expect(ca).not.toBe(us);
    expect(ca).toMatch(/^cache\/site-explorer\/v1\/2124-en\/[0-9a-f]{64}\/d\d+\.json\.gz$/);
    // No tenant: a domain's organic footprint is a fact about the public web.
    expect(ca).not.toContain(TENANT);
  });

  it("does NOT share a partial analysis", async () => {
    // The next tenant would receive missing sections at cost 0, with no way to
    // tell them from genuinely empty ones.
    seoMeteredCallResult.mockImplementation(async (_t: string, path: string) => {
      if (path.includes("relevant_pages")) throw new Error("upstream 502");
      return {
        data: [{ items: [], total_count: 0, metrics: { organic: {} } }],
        billing: { path: path.split("/"), costUsd: 0.02 },
      };
    });
    siteExplorerAnalysis.findFirst.mockResolvedValue(null);
    await runAnalysis(TENANT, "GROWTH", {
      domain: "example.com",
      locationCode: 2124,
      languageCode: "en",
    });
    expect(writeCache).not.toHaveBeenCalled();
  });

  it("caches for a week", () => {
    expect(SITE_EXPLORER_CACHE_DAYS).toBe(7);
  });
});

// ─── 4. The Pages parser ─────────────────────────────────────────────────────

describe("relevant_pages parsing", () => {
  it("reads the metrics from metrics.organic, a level below the item", () => {
    // A parser written against the item root reads undefined from every field
    // and renders a page list where every number is 0 — which looks like a
    // site with no traffic rather than like a bug.
    const parsed = parseDomainPages([
      {
        total_count: 500,
        items: [
          {
            page_address: "https://example.com/pricing",
            metrics: { organic: { count: 42, etv: 900.4, pos_1: 3 } },
          },
        ],
      },
    ]);
    expect(parsed.items[0]).toEqual({
      url: "https://example.com/pricing",
      keywordCount: 42,
      etv: 900.4,
      topPositions: 3,
    });
    expect(parsed.totalCount).toBe(500);
  });

  it("drops a row with no address rather than rendering a blank link", () => {
    const parsed = parseDomainPages([
      { items: [{ metrics: { organic: { count: 1 } } }, { page_address: "" }] },
    ]);
    expect(parsed.items).toEqual([]);
  });

  it("turns a missing metric into 0, not undefined", () => {
    const parsed = parseDomainPages([{ items: [{ page_address: "https://a.example/" }] }]);
    expect(parsed.items[0]).toMatchObject({ keywordCount: 0, etv: 0, topPositions: 0 });
  });
});
