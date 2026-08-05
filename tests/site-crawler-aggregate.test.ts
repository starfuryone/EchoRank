// Site-wide aggregation: the chain walker, the issue rules, idempotency, and
// the shape of the summary.
//
// Postgres and Redis are stubbed with an in-memory store that behaves enough
// like them to run the real aggregation code. The property that matters most —
// running aggregation twice produces the same issue rows — is asserted end to
// end rather than argued for.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_CHAIN_WALK } from "@/lib/site-crawler/constants";

// ─── Stubs ──────────────────────────────────────────────────────────────────

interface PageRow {
  id: string;
  url: string;
  statusCode: number | null;
  contentType: string | null;
  title: string | null;
  metaDescription: string | null;
  contentHash: string | null;
  depth: number;
  inlinkCount: number | null;
  redirectTarget: string | null;
}

const db = {
  pages: [] as PageRow[],
  issues: [] as { id: string; crawlPageId: string; type: string; severity: string; detail: string | null }[],
};
let issueSeq = 0;

/** Matches the subset of Prisma filters aggregate.ts actually uses. */
function pageMatches(row: PageRow, where: Record<string, unknown>): boolean {
  for (const [key, cond] of Object.entries(where)) {
    if (key === "crawlJobId") continue;
    if (key === "statusCode") {
      const c = cond as { gte?: number; lt?: number };
      if (row.statusCode === null) return false;
      if (c.gte !== undefined && row.statusCode < c.gte) return false;
      if (c.lt !== undefined && row.statusCode >= c.lt) return false;
      continue;
    }
    if (key === "contentType") {
      const c = cond as { startsWith?: string };
      if (c.startsWith && !(row.contentType ?? "").startsWith(c.startsWith)) return false;
      continue;
    }
    if (key === "redirectTarget") {
      if ((cond as { not?: null }).not === null && row.redirectTarget === null) return false;
      continue;
    }
    if (key === "depth") {
      if (typeof cond === "number" && row.depth !== cond) return false;
      const c = cond as { gt?: number };
      if (typeof cond === "object" && c.gt !== undefined && !(row.depth > c.gt)) return false;
      continue;
    }
    if (key === "inlinkCount") {
      if (cond === null && row.inlinkCount !== null) return false;
      if (typeof cond === "number" && row.inlinkCount !== cond) return false;
      continue;
    }
    if (key === "url") {
      const c = cond as { in?: string[] };
      if (c.in && !c.in.includes(row.url)) return false;
      if (typeof cond === "string" && row.url !== cond) return false;
      continue;
    }
  }
  return true;
}

const prismaMock = {
  crawlPage: {
    findMany: vi.fn(
      async (args: {
        where: Record<string, unknown>;
        take?: number;
        cursor?: { id: string };
        skip?: number;
        orderBy?: Record<string, string> | Record<string, string>[];
      }) => {
        let rows = db.pages.filter((p) => pageMatches(p, args.where));

        // Honour orderBy so keyset paging and "deepest pages" behave like the
        // real thing; without it the summary would be asserted against a sort
        // the database never performs.
        const order = Array.isArray(args.orderBy) ? args.orderBy : args.orderBy ? [args.orderBy] : [];
        rows = [...rows].sort((a, b) => {
          for (const clause of order) {
            const [field, dir] = Object.entries(clause)[0]!;
            const av = a[field as keyof PageRow];
            const bv = b[field as keyof PageRow];
            if (av === bv) continue;
            const cmp = (av ?? 0) < (bv ?? 0) ? -1 : 1;
            return dir === "desc" ? -cmp : cmp;
          }
          return a.id.localeCompare(b.id);
        });

        if (args.cursor) {
          const i = rows.findIndex((r) => r.id === args.cursor!.id);
          rows = rows.slice(i + 1);
        }
        return args.take ? rows.slice(0, args.take) : rows;
      },
    ),
    updateMany: vi.fn(async (args: { where: Record<string, unknown>; data: { inlinkCount: number } }) => {
      let n = 0;
      for (const row of db.pages) {
        if (!pageMatches(row, args.where)) continue;
        row.inlinkCount = args.data.inlinkCount;
        n++;
      }
      return { count: n };
    }),
    count: vi.fn(async (args: { where: Record<string, unknown> }) =>
      db.pages.filter((p) => pageMatches(p, args.where)).length,
    ),
    aggregate: vi.fn(async () => {
      const values = db.pages.map((p) => p.inlinkCount ?? 0);
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return { _avg: { inlinkCount: avg } };
    }),
    groupBy: vi.fn(async (args: { by: string[] }) => {
      const field = args.by[0] as "statusCode" | "depth";
      const counts = new Map<unknown, number>();
      for (const row of db.pages) counts.set(row[field], (counts.get(row[field]) ?? 0) + 1);
      return [...counts].map(([value, n]) => ({ [field]: value, _count: { _all: n } }));
    }),
  },
  crawlIssue: {
    deleteMany: vi.fn(async (args: { where: { type?: { in: string[] } } }) => {
      const types = args.where.type?.in ?? [];
      const before = db.issues.length;
      db.issues = db.issues.filter((i) => !types.includes(i.type));
      return { count: before - db.issues.length };
    }),
    createMany: vi.fn(async (args: { data: { crawlPageId: string; type: string; severity: string; detail: string | null }[] }) => {
      for (const row of args.data) db.issues.push({ id: `i${issueSeq++}`, ...row });
      return { count: args.data.length };
    }),
    findMany: vi.fn(async (args: { where: { type?: string } }) =>
      db.issues.filter((i) => (args.where.type ? i.type === args.where.type : true)),
    ),
    count: vi.fn(async () => db.issues.length),
    groupBy: vi.fn(async (args: { by: string[] }) => {
      const field = args.by[0] as "severity" | "type";
      const counts = new Map<string, number>();
      for (const i of db.issues) counts.set(i[field], (counts.get(i[field]) ?? 0) + 1);
      return [...counts].map(([value, n]) => ({ [field]: value, _count: { _all: n } }));
    }),
  },
  // Duplicate groups are raw SQL; emulate the GROUP BY … HAVING count(*) > 1.
  $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
    const sql = strings.join(" ");
    const field = sql.includes("GROUP BY title")
      ? "title"
      : sql.includes('GROUP BY "metaDescription"')
        ? "metaDescription"
        : "contentHash";

    const groups = new Map<string, string[]>();
    for (const row of db.pages) {
      const ok =
        row.statusCode !== null &&
        row.statusCode >= 200 &&
        row.statusCode < 300 &&
        (row.contentType ?? "").startsWith("text/html");
      const value = row[field as keyof PageRow] as string | null;
      if (!ok || !value) continue;
      groups.set(value, [...(groups.get(value) ?? []), row.id]);
    }
    return [...groups.values()].filter((ids) => ids.length > 1).map((ids) => ({ ids }));
  }),
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const inlinkHash = new Map<string, number>();
const redisMock = {
  hscan: vi.fn(async (_key: string, cursor: string) => {
    if (cursor !== "0") return ["0", []];
    const flat: string[] = [];
    for (const [url, count] of inlinkHash) flat.push(url, String(count));
    return ["0", flat];
  }),
};

const { aggregateCrawl, walkChain } = await import("@/lib/site-crawler/aggregate");

const SITEMAP = { found: false, urls: [], filesFetched: 0, truncated: false };

function page(over: Partial<PageRow> & { id: string; url: string }): PageRow {
  return {
    statusCode: 200,
    contentType: "text/html; charset=utf-8",
    title: null,
    metaDescription: null,
    contentHash: null,
    depth: 1,
    inlinkCount: null,
    redirectTarget: null,
    ...over,
  };
}

function run(args: Partial<Parameters<typeof aggregateCrawl>[0]> = {}) {
  return aggregateCrawl({
    jobId: "job_1",
    redis: redisMock as never,
    sitemap: SITEMAP,
    sitemapSeeded: new Set<string>(),
    ...args,
  });
}

const typesOf = (t: string) => db.issues.filter((i) => i.type === t);

beforeEach(() => {
  db.pages = [];
  db.issues = [];
  inlinkHash.clear();
  issueSeq = 0;
  vi.clearAllMocks();
});

// ─── The chain walker ───────────────────────────────────────────────────────

describe("walkChain", () => {
  const map = (pairs: [string, string][]) =>
    new Map(pairs.map(([from, to]) => [from, { target: to }]));

  it("reports a single hop as a chain of one", () => {
    const walk = walkChain("a", map([["a", "b"]]));
    expect(walk.hops).toBe(1);
    expect(walk.looped).toBe(false);
    expect(walk.path).toEqual(["a", "b"]);
  });

  it("follows a multi-page chain", () => {
    const walk = walkChain("a", map([["a", "b"], ["b", "c"], ["c", "d"]]));
    expect(walk.hops).toBe(3);
    expect(walk.path).toEqual(["a", "b", "c", "d"]);
    expect(walk.looped).toBe(false);
  });

  it("detects a two-URL loop", () => {
    const walk = walkChain("a", map([["a", "b"], ["b", "a"]]));
    expect(walk.looped).toBe(true);
  });

  it("detects a self-redirect", () => {
    expect(walkChain("a", map([["a", "a"]])).looped).toBe(true);
  });

  it("detects a longer cycle", () => {
    const walk = walkChain("a", map([["a", "b"], ["b", "c"], ["c", "a"]]));
    expect(walk.looped).toBe(true);
  });

  it("stops at the hop budget instead of walking forever", () => {
    // A very long non-cyclic chain must terminate.
    const pairs: [string, string][] = Array.from({ length: 50 }, (_, i) => [`u${i}`, `u${i + 1}`]);
    const walk = walkChain("u0", map(pairs));
    expect(walk.hops).toBeLessThanOrEqual(MAX_CHAIN_WALK);
    expect(walk.truncated).toBe(true);
  });

  it("returns zero hops for a URL that does not redirect", () => {
    expect(walkChain("a", map([])).hops).toBe(0);
  });
});

// ─── Issue rules ────────────────────────────────────────────────────────────

describe("inlinks", () => {
  it("writes counts from Redis and zero-fills the rest", async () => {
    db.pages = [page({ id: "p1", url: "https://e.com/a" }), page({ id: "p2", url: "https://e.com/b" })];
    inlinkHash.set("https://e.com/a", 3);

    const { summary } = await run();
    expect(db.pages.find((p) => p.id === "p1")!.inlinkCount).toBe(3);
    expect(db.pages.find((p) => p.id === "p2")!.inlinkCount).toBe(0);
    expect(summary.inlinks.max).toBe(3);
    expect(summary.inlinks.zeroCount).toBe(1);
  });

  it("flags NO_INLINKS on linked-from-nowhere pages below the root", async () => {
    db.pages = [
      page({ id: "p1", url: "https://e.com/orphan", depth: 2 }),
      page({ id: "p2", url: "https://e.com/root", depth: 0 }),
    ];
    await run();
    // depth 0 is the entry point; nothing linking to it is normal.
    expect(typesOf("NO_INLINKS").map((i) => i.crawlPageId)).toEqual(["p1"]);
  });

  it("does not flag a page that has inlinks", async () => {
    db.pages = [page({ id: "p1", url: "https://e.com/a", depth: 1 })];
    inlinkHash.set("https://e.com/a", 2);
    await run();
    expect(typesOf("NO_INLINKS")).toHaveLength(0);
  });
});

describe("duplicates", () => {
  it("flags EVERY member of a duplicate-title group, including the first", async () => {
    // Phase 1's write-time check could only see earlier members; this is the
    // bug the recomputation exists to fix.
    db.pages = [
      page({ id: "p1", url: "https://e.com/a", title: "Same" }),
      page({ id: "p2", url: "https://e.com/b", title: "Same" }),
      page({ id: "p3", url: "https://e.com/c", title: "Different" }),
    ];
    const { summary } = await run();

    expect(typesOf("DUPLICATE_TITLE").map((i) => i.crawlPageId).sort()).toEqual(["p1", "p2"]);
    expect(summary.duplicates.title).toBe(1);
  });

  it("flags duplicate meta descriptions", async () => {
    db.pages = [
      page({ id: "p1", url: "https://e.com/a", metaDescription: "Same desc" }),
      page({ id: "p2", url: "https://e.com/b", metaDescription: "Same desc" }),
    ];
    await run();
    expect(typesOf("DUPLICATE_META_DESC")).toHaveLength(2);
  });

  it("flags duplicate content by hash", async () => {
    db.pages = [
      page({ id: "p1", url: "https://e.com/a", contentHash: "h1" }),
      page({ id: "p2", url: "https://e.com/b", contentHash: "h1" }),
      page({ id: "p3", url: "https://e.com/c", contentHash: "h2" }),
    ];
    const { summary } = await run();
    expect(typesOf("DUPLICATE_CONTENT").map((i) => i.crawlPageId).sort()).toEqual(["p1", "p2"]);
    expect(summary.duplicates.content).toBe(1);
  });

  it("ignores non-200 and non-HTML pages", async () => {
    db.pages = [
      page({ id: "p1", url: "https://e.com/a", title: "Same", statusCode: 404 }),
      page({ id: "p2", url: "https://e.com/b", title: "Same", contentType: "application/pdf" }),
    ];
    await run();
    expect(typesOf("DUPLICATE_TITLE")).toHaveLength(0);
  });
});

describe("redirects", () => {
  it("writes REDIRECT_LOOP for a cycle", async () => {
    db.pages = [
      page({ id: "p1", url: "https://e.com/a", redirectTarget: "https://e.com/b" }),
      page({ id: "p2", url: "https://e.com/b", redirectTarget: "https://e.com/a" }),
    ];
    const { summary } = await run();
    expect(typesOf("REDIRECT_LOOP").length).toBeGreaterThan(0);
    expect(summary.redirects.loops).toBeGreaterThan(0);
    expect(typesOf("REDIRECT_LOOP")[0]!.severity).toBe("ERROR");
  });

  it("writes REDIRECT_CHAIN for a multi-page chain", async () => {
    db.pages = [
      page({ id: "p1", url: "https://e.com/a", redirectTarget: "https://e.com/b" }),
      page({ id: "p2", url: "https://e.com/b", redirectTarget: "https://e.com/c" }),
      page({ id: "p3", url: "https://e.com/c" }),
    ];
    const { summary } = await run();
    expect(summary.redirects.chains).toBe(1);
    expect(typesOf("REDIRECT_CHAIN").map((i) => i.crawlPageId)).toEqual(["p1"]);
    expect(typesOf("REDIRECT_CHAIN")[0]!.detail).toContain("→");
  });

  it("leaves a crawl-time chain warning alone rather than doubling it", async () => {
    // The crawl writes REDIRECT_CHAIN from single-fetch hop counts. Aggregation
    // must not add a second one to the same page.
    db.pages = [
      page({ id: "p1", url: "https://e.com/a", redirectTarget: "https://e.com/b" }),
      page({ id: "p2", url: "https://e.com/b", redirectTarget: "https://e.com/c" }),
    ];
    db.issues.push({
      id: "pre",
      crawlPageId: "p1",
      type: "REDIRECT_CHAIN",
      severity: "WARNING",
      detail: "3 redirect hops",
    });

    await run();
    expect(typesOf("REDIRECT_CHAIN").filter((i) => i.crawlPageId === "p1")).toHaveLength(1);
  });

  it("does not flag a single hop", async () => {
    db.pages = [
      page({ id: "p1", url: "https://e.com/a", redirectTarget: "https://e.com/b" }),
      page({ id: "p2", url: "https://e.com/b" }),
    ];
    const { summary } = await run();
    expect(summary.redirects.chains).toBe(0);
  });
});

describe("orphans", () => {
  it("flags a sitemap-seeded page nothing links to", async () => {
    db.pages = [page({ id: "p1", url: "https://e.com/lonely", depth: 0 })];
    await run({ sitemapSeeded: new Set(["https://e.com/lonely"]) });
    expect(typesOf("ORPHAN_PAGE").map((i) => i.crawlPageId)).toEqual(["p1"]);
  });

  it("does not flag a sitemap page that is linked to", async () => {
    db.pages = [page({ id: "p1", url: "https://e.com/linked", depth: 0 })];
    inlinkHash.set("https://e.com/linked", 4);
    await run({ sitemapSeeded: new Set(["https://e.com/linked"]) });
    expect(typesOf("ORPHAN_PAGE")).toHaveLength(0);
  });

  it("counts sitemap URLs that were never crawled", async () => {
    db.pages = [page({ id: "p1", url: "https://e.com/a", depth: 0 })];
    const { summary } = await run({
      sitemap: {
        found: true,
        urls: ["https://e.com/a", "https://e.com/never", "https://e.com/also-never"],
        filesFetched: 1,
        truncated: false,
      },
    });
    expect(summary.sitemap.notCrawled).toBe(2);
    expect(summary.sitemap.notCrawledSample).toContain("https://e.com/never");
  });
});

// ─── Idempotency + summary ──────────────────────────────────────────────────

describe("idempotency", () => {
  it("produces identical issues when run twice", async () => {
    db.pages = [
      page({ id: "p1", url: "https://e.com/a", title: "Same", contentHash: "h", depth: 1 }),
      page({ id: "p2", url: "https://e.com/b", title: "Same", contentHash: "h", depth: 1 }),
      page({ id: "p3", url: "https://e.com/c", redirectTarget: "https://e.com/d", depth: 1 }),
      page({ id: "p4", url: "https://e.com/d", redirectTarget: "https://e.com/e", depth: 1 }),
    ];

    const first = await run();
    const afterFirst = db.issues.map((i) => `${i.crawlPageId}:${i.type}`).sort();

    const second = await run();
    const afterSecond = db.issues.map((i) => `${i.crawlPageId}:${i.type}`).sort();

    expect(afterSecond).toEqual(afterFirst);
    expect(second.issueCount).toBe(first.issueCount);
  });
});

describe("summary", () => {
  it("carries every section the Overview renders", async () => {
    db.pages = [
      page({ id: "p1", url: "https://e.com/a", depth: 0, statusCode: 200 }),
      page({ id: "p2", url: "https://e.com/b", depth: 3, statusCode: 404 }),
    ];
    const { summary } = await run();

    expect(summary.statusCodes["200"]).toBe(1);
    expect(summary.statusCodes["404"]).toBe(1);
    expect(summary.depths["0"]).toBe(1);
    expect(summary.depths["3"]).toBe(1);
    expect(summary).toHaveProperty("issuesBySeverity");
    expect(summary).toHaveProperty("issuesByType");
    expect(summary).toHaveProperty("duplicates");
    expect(summary).toHaveProperty("redirects");
    expect(summary).toHaveProperty("sitemap");
    expect(summary).toHaveProperty("inlinks");
    expect(summary.aggregationMs).toBeGreaterThanOrEqual(0);
  });

  it("lists the deepest pages, deepest first", async () => {
    db.pages = [
      page({ id: "p1", url: "https://e.com/shallow", depth: 1 }),
      page({ id: "p2", url: "https://e.com/deep", depth: 7 }),
    ];
    const { summary } = await run();
    expect(summary.deepestPages[0]).toEqual({ url: "https://e.com/deep", depth: 7 });
  });

  it("stays small — counts and capped samples, never full lists", async () => {
    db.pages = Array.from({ length: 300 }, (_, i) =>
      page({ id: `p${i}`, url: `https://e.com/p${i}`, depth: i % 5 }),
    );
    const { summary } = await run();
    // The whole point of the column: a big crawl must not write a big summary.
    expect(JSON.stringify(summary).length).toBeLessThan(100_000);
    expect(summary.deepestPages.length).toBeLessThanOrEqual(10);
  });
});
