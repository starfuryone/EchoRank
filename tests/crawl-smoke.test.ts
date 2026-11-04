// scripts/crawl-smoke.ts → src/lib/site-crawler/smoke.ts, against a stubbed
// queue and database. The real startCrawl, checkCrawlConfig, plan caps and
// StartCrawlBodySchema run; prisma, Redis, the BullMQ registry, the rate
// limiter and the paid-plan lookup are fakes, and HTTP is a fetch stub that
// answers the crawl API routes. What is asserted: the config reaches the
// enqueued crawl as the handler would build it, the estimate is printed
// before the enqueue, the checks pass on a healthy crawl and FAIL (exit 1)
// on the drifts they exist for, and no credential is ever printed.
import { beforeEach, describe, expect, it, vi } from "vitest";

const events: string[] = [];

// ── fake database ────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;
const db = {
  segments: [] as Row[],
  jobStates: [] as Row[],
  createdJob: null as Row | null,
  severity: [] as { severity: string; _count: { _all: number } }[],
  byRule: [] as { ruleId: string | null; _count: { _all: number } }[],
  coverage: [] as { source: string; _count: { _all: number } }[],
  seoCalls: [] as Row[],
  earlier: [] as Row[],
  pages: [] as Row[],
};

const JOB_ID = "job_smoke";
const T0 = new Date("2026-11-04T06:00:00Z");

const prismaFake = {
  tenant: {
    findUnique: vi.fn(async () => ({ id: "t1", name: "Smoke Co", slug: "smoke", planType: "GROWTH" })),
    findMany: vi.fn(async () => [{ slug: "smoke", name: "Smoke Co", planType: "GROWTH" }]),
  },
  tenantMember: {
    findFirst: vi.fn(async () => ({ user: { id: "u1", email: "owner@example.com", name: "Owner" } })),
  },
  crawlSiteDefault: { findUnique: vi.fn(async () => null), upsert: vi.fn() },
  crawlSegment: {
    findMany: vi.fn(async () => db.segments.map((s) => ({ ...s }))),
    create: vi.fn(async ({ data }: { data: Row }) => {
      events.push("segment.create");
      const row = { id: "seg_tmp", ...data };
      db.segments.push(row);
      return { id: row.id };
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      events.push("segment.delete");
      db.segments = db.segments.filter((s) => s.id !== where.id);
    }),
  },
  crawlJob: {
    count: vi.fn(async () => 0),
    create: vi.fn(async ({ data }: { data: Row }) => {
      events.push("crawlJob.create");
      db.createdJob = data;
      return { id: JOB_ID, pagesCrawled: 0, issueCount: 0, stoppedReason: null, startedAt: null, finishedAt: null, createdAt: T0, ...data };
    }),
    findUnique: vi.fn(async () => {
      const next = db.jobStates.length > 1 ? db.jobStates.shift()! : db.jobStates[0]!;
      return { ...next, config: db.createdJob?.config ?? null };
    }),
    findMany: vi.fn(async () => db.earlier),
  },
  crawlIssue: {
    groupBy: vi.fn(async ({ by }: { by: string[] }) => (by[0] === "severity" ? db.severity : db.byRule)),
  },
  crawlPage: {
    findMany: vi.fn(async ({ where, take }: { where: Row; take?: number }) => {
      if ("renderedWordCount" in where) return [{ jsOnly: { content: true }, consoleErrors: 1, renderedWordCount: 40, axeViolations: { "color-contrast": 3 } }];
      if ("searchHits" in where) return [{ searchHits: { "0": 2 } }, { searchHits: { "0": 0 } }];
      return db.pages.slice(0, take ?? db.pages.length);
    }),
    count: vi.fn(async () => 3),
  },
  crawlPageMetric: {
    groupBy: vi.fn(async () => db.coverage),
    findMany: vi.fn(async () => [
      { source: "psi", data: { mobile: { performance: 71 }, desktop: { performance: 88 } }, page: { statusCode: 200 } },
      { source: "backlinks", data: { backlinks: 4, referringDomains: 2, rank: 10 }, page: { statusCode: 200 } },
    ]),
  },
  crawlExtraction: {
    groupBy: vi.fn(async ({ by }: { by: string[] }) =>
      by[0] === "extractorIndex" ? [{ extractorIndex: 0, _count: { _all: 2 } }, { extractorIndex: 1, _count: { _all: 1 } }] : [{ pageId: "p1", _count: { _all: 2 } }],
    ),
  },
  gscConnection: { findUnique: vi.fn(async () => null) },
  seoApiCall: {
    findFirst: vi.fn(async () => ({ costUsd: 0.02 })),
    findMany: vi.fn(async () => db.seoCalls),
    aggregate: vi.fn(async () => ({ _sum: { costUsd: 0 } })),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaFake }));
const addJob = vi.fn(async (...args: unknown[]) => {
  void args;
  events.push("addJob");
  return { id: "bull1" };
});
vi.mock("@/infrastructure/queue/registry", () => ({ addJob, closeAllQueues: vi.fn(), getQueue: vi.fn() }));
const fakeRedis = { zcount: vi.fn(async () => 0), rpush: vi.fn(), sadd: vi.fn(), expire: vi.fn(), get: vi.fn(async () => null), set: vi.fn() };
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => fakeRedis, createNewConnection: () => fakeRedis, getSubscriberConnection: () => fakeRedis }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ success: true, remaining: 2 })) }));
vi.mock("@/lib/paid-plan", () => ({ hasPaidPlan: vi.fn(async () => true) }));
vi.mock("@/lib/dataforseo/metering", () => ({ monthlyCapUsd: vi.fn(async () => 25), spentThisMonth: vi.fn(async () => 1), seoMeteredCall: vi.fn() }));

const { parseArgs, requestBody, runSmoke, csvHeaderCells } = await import("@/lib/site-crawler/smoke");
const { StartCrawlBodySchema } = await import("@/lib/site-crawler/start-body");
const { ISSUE_COLUMNS, metricCsvColumns, pageColumns, withSegmentColumn } = await import("@/lib/site-crawler/csv-columns");

// ── fake web process ─────────────────────────────────────────────────────────
type Answer = { status?: number; json?: unknown; csv?: string; pdf?: boolean; type?: string };
let routes: Record<string, Answer>;
const seen: { url: string; init: RequestInit }[] = [];
const fetchStub = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
  const u = new URL(String(url));
  seen.push({ url: u.pathname + u.search, init: init ?? {} });
  const key = `${init?.method ?? "GET"} ${u.pathname.replace(`/api/seo/v1/crawl/${JOB_ID}`, "")}${u.search}`;
  const match = routes[key] ?? routes[key.replace(/\?.*$/, "")];
  if (!match) return new Response(JSON.stringify({ error: `no stub for ${key}` }), { status: 404 });
  if (match.pdf) return new Response(new TextEncoder().encode("%PDF-1.7 fake"), { status: 200, headers: { "content-type": match.type ?? "application/pdf" } });
  if (match.csv !== undefined) return new Response(match.csv, { status: match.status ?? 200, headers: { "content-type": "text/csv" } });
  return new Response(JSON.stringify(match.json), { status: match.status ?? 200, headers: { "content-type": "application/json" } });
});

const csvLine = (headers: string[]) => "﻿" + headers.map((h) => (/[",]/.test(h) ? `"${h.replace(/"/g, '""')}"` : h)).join(",") + "\r\nrow,1\r\n";

const FULL = ["--tenant", "smoke", "--url", "https://echorank360.com", "--render", "thin", "--psi", "2", "--backlinks", "2", "--extract", "og", "--search", "gtag(", "--segment", "/learn/*", "--timeout", "1"];

function job(status: string, metrics: Record<string, unknown> = {}, extra: Row = {}): Row {
  return {
    id: JOB_ID, rootUrl: "https://echorank360.com/", status, pagesCrawled: 3, issueCount: 6, stoppedReason: null,
    renderMode: "thin", renderCap: 500, pagesRendered: 3,
    summary: { totals: { ERROR: 1, WARNING: 2, NOTICE: 3 }, metrics },
    startedAt: new Date(T0.getTime() + 2_000), finishedAt: new Date(T0.getTime() + 95_000), createdAt: T0, ...extra,
  };
}

function healthy() {
  events.length = 0;
  seen.length = 0;
  db.segments = [];
  db.createdJob = null;
  const done = { psi: { status: "done", targets: 2, completed: 4, failed: 0 }, backlinks: { status: "done", targets: 2, completed: 2, failed: 0 } };
  db.jobStates = [job("RUNNING"), job("COMPLETED", { backlinks: { status: "running" } }), job("COMPLETED", done)];
  db.severity = [{ severity: "ERROR", _count: { _all: 1 } }, { severity: "WARNING", _count: { _all: 2 } }, { severity: "NOTICE", _count: { _all: 3 } }];
  db.byRule = [
    { ruleId: "page_titles.over_60", _count: { _all: 2 } },
    { ruleId: "javascript.content_only_rendered", _count: { _all: 1 } },
    { ruleId: "accessibility.color_contrast", _count: { _all: 1 } },
    { ruleId: "performance.unused_javascript", _count: { _all: 1 } },
    { ruleId: "extraction.empty", _count: { _all: 1 } },
  ];
  db.coverage = [{ source: "psi", _count: { _all: 2 } }, { source: "backlinks", _count: { _all: 2 } }];
  db.seoCalls = [{ costUsd: 0.02, ok: true }, { costUsd: 0.02, ok: true }];
  db.earlier = [{ id: "job_prev", rootUrl: "https://echorank360.com/" }];
  db.pages = [{ id: "p1", url: "https://echorank360.com/" }, { id: "p2", url: "https://echorank360.com/learn/a" }, { id: "p3", url: "https://echorank360.com/b" }];
  const segDefs = [{ name: "smoke /learn/*", rule: { kind: "urlPattern", pattern: "/learn/*" } }];
  const searches = ["gtag("];
  routes = {
    "GET /pages?pageSize=1": { json: { total: 3, pages: [{ metrics: {} }] } },
    "GET /pages?pageSize=1&sort=psi.mobile.performance&dir=desc": { json: { total: 3, pages: [{ metrics: { psi: { mobile: {} } } }] } },
    "GET /pages?pageSize=1&sort=backlinks.referringDomains&dir=desc": { json: { total: 3, pages: [{ metrics: { backlinks: { backlinks: 4 } } }] } },
    "GET /pages?pageSize=1&segment=0": { json: { total: 1, pages: [{}] } },
    "GET /pages?format=csv": { csv: csvLine(withSegmentColumn([...pageColumns(searches), ...metricCsvColumns(["psi", "backlinks"])], segDefs as never, () => []).map((c) => c.header)) },
    "GET /export?view=issues": { csv: csvLine(withSegmentColumn(ISSUE_COLUMNS, segDefs as never, () => []).map((c) => c.header)) },
    "GET /graph?kind=links": { json: { kind: "links", nodes: [{ id: "p1" }, { id: "p2" }], edges: [{ source: "p1", target: "p2" }] } },
    "POST /compare": { json: { id: "cmp1", result: { counts: { added: 1, removed: 0, changed: 2, issuesNew: 1, issuesResolved: 0 } } } },
    "POST /report": { pdf: true },
  };
}

async function run(argv: string[], env: Record<string, string> = { AUTH_SECRET: "test-secret-0123456789abcdef0123456789" }) {
  const out: string[] = [];
  let clock = 0;
  const result = await runSmoke(parseArgs(argv, {}), {
    fetch: fetchStub as unknown as typeof fetch,
    sleep: async (ms) => void (clock += ms),
    now: () => clock,
    out: (l) => {
      out.push(l);
      if (l.includes("backlink estimate")) events.push("estimate");
    },
    env,
    pollMs: 5_000,
  });
  return { result, out };
}

const verdictOf = (lines: { verdict: string; name: string }[], prefix: string) => lines.find((l) => l.name.startsWith(prefix))?.verdict;

describe("crawl smoke: arguments", () => {
  it("parses the documented invocation and expands og", () => {
    const a = parseArgs(FULL, {});
    expect(a).toMatchObject({ tenant: "smoke", render: "thin", psi: 2, backlinks: 2, search: "gtag(", segment: "/learn/*", timeoutMin: 1, baseUrl: "http://127.0.0.1:4400" });
    expect(a.extract).toEqual(["ogTitle", "ogDescription", "ogImage"]);
  });
  it("refuses unknown flags, bad numbers and render none", () => {
    expect(() => parseArgs(["--psi", "0"], {})).toThrow(/positive integer/);
    expect(() => parseArgs(["--render", "none"], {})).toThrow(/thin or all/);
    expect(() => parseArgs(["--nope"], {})).toThrow(/unknown argument/);
    expect(() => parseArgs(["--extract", "og,nope"], {})).toThrow(/unknown preset/);
  });
  it("builds a body the handler's own schema accepts, config only when needed", () => {
    expect(StartCrawlBodySchema.safeParse(requestBody(parseArgs(FULL, {}))).success).toBe(true);
    expect(requestBody(parseArgs(["--tenant", "s", "--url", "https://x.com"], {}))).toEqual({ url: "https://x.com", renderMode: "none" });
  });
  it("reads a CSV header row with a BOM and quoted cells", () => {
    expect(csvHeaderCells('﻿URL,"A, b","say ""hi"""')).toEqual(["URL", "A, b", 'say "hi"']);
  });
});

describe("crawl smoke: a run", () => {
  beforeEach(() => {
    healthy();
    vi.clearAllMocks();
  });

  it("enqueues the handler's config on site-crawl, prints the estimate first, and passes a healthy crawl", async () => {
    const { result, out } = await run(FULL);
    expect(addJob).toHaveBeenCalledTimes(1);
    expect(addJob).toHaveBeenCalledWith("site-crawl", "crawl", { crawlJobId: JOB_ID, tenantId: "t1" });
    expect(events.indexOf("estimate")).toBeLessThan(events.indexOf("addJob"));
    // The temporary segment exists for the start and is gone straight after it.
    expect(events.indexOf("segment.create")).toBeLessThan(events.indexOf("crawlJob.create"));
    expect(events.indexOf("segment.delete")).toBeGreaterThan(events.indexOf("crawlJob.create"));
    expect(db.segments).toEqual([]);

    const config = db.createdJob!.config as Record<string, unknown>;
    expect(db.createdJob!.renderMode).toBe("thin");
    expect(config.addData).toEqual({ psi: { pages: 2, segment: null }, backlinks: { pages: 2, segment: null } });
    expect((config.extractors as { name: string }[]).map((e) => e.name)).toEqual(["og:title", "og:description", "og:image"]);
    expect(config.searches).toEqual([{ name: "gtag(", pattern: "gtag(", isRegex: false }]);
    expect(config.segments).toEqual([{ name: "smoke /learn/*", rule: { kind: "urlPattern", pattern: "/learn/*" } }]);
    expect(out.find((l) => l.includes("backlink estimate"))).toContain("$0.0400 (2 × $0.0200");

    const failed = result.lines.filter((l) => l.verdict === "FAIL");
    expect(failed).toEqual([]);
    expect(result.exitCode).toBe(0);
    for (const name of ["job completed", "pages crawled", "duration", "header totals", "issues by family", "rendered pages", "accessibility.*", "metrics: psi", "metrics: backlinks", "SeoApiCall", "pages API", "CSV pages", "CSV issues", "extraction values", "search counts", "segment totals", "structure graph", "compare", "PDF report"]) {
      expect(verdictOf(result.lines, name), name).toBe("PASS");
    }
    expect(verdictOf(result.lines, "metrics: gsc")).toBe("SKIP");
    expect(verdictOf(result.lines, "metrics: ga4")).toBe("SKIP");
    expect(out.at(-1)).toMatch(/^SMOKE OK/);
  });

  it("sends the session only to the web process and never prints a credential", async () => {
    const { out } = await run(FULL);
    expect(seen.length).toBeGreaterThan(5);
    for (const r of seen) expect(String((r.init.headers as Record<string, string>).cookie)).toMatch(/authjs\.session-token=.+; .*echorank_active_tenant=t1/);
    const posts = seen.filter((r) => r.init.method === "POST");
    for (const r of posts) expect((r.init.headers as Record<string, string>).origin).toBe("http://127.0.0.1:4400");
    const printed = out.join("\n");
    expect(printed).not.toMatch(/session-token|test-secret|eyJ|owner@example\.com/);
  });

  it("FAILs and exits 1 on drift: header totals, spend over 1.5× the estimate, a silent gated family, a non-PDF report", async () => {
    db.severity = [{ severity: "ERROR", _count: { _all: 2 } }];
    db.seoCalls = [{ costUsd: 0.05, ok: true }, { costUsd: 0.05, ok: true }];
    db.byRule = db.byRule.filter((r) => !r.ruleId!.startsWith("performance."));
    routes["POST /report"] = { pdf: true, type: "text/html" };
    const { result, out } = await run(FULL);
    expect(result.exitCode).toBe(1);
    expect(verdictOf(result.lines, "header totals")).toBe("FAIL");
    expect(verdictOf(result.lines, "SeoApiCall")).toBe("FAIL");
    expect(result.lines.find((l) => l.name === "issues by family")).toMatchObject({ verdict: "FAIL", value: expect.stringContaining("NO RULES despite facts: performance") });
    expect(verdictOf(result.lines, "PDF report")).toBe("FAIL");
    expect(out.at(-1)).toMatch(/^SMOKE FAILED/);
  });

  it("FAILs a CSV whose header drifted from the route's columns", async () => {
    routes["GET /export?view=issues"] = { csv: csvLine(["Severity", "Type", "URL"]) };
    const { result } = await run(FULL);
    expect(result.lines.find((l) => l.name === "CSV issues")).toMatchObject({ verdict: "FAIL", value: expect.stringContaining("header differs") });
  });

  it("accepts backlinks stopped at the USD cap, reported as such", async () => {
    db.jobStates = [job("COMPLETED", { psi: { status: "done" }, backlinks: { status: "stopped", stoppedReason: "usd_cap" } })];
    db.coverage = [{ source: "psi", _count: { _all: 2 } }, { source: "backlinks", _count: { _all: 1 } }];
    const { result } = await run(FULL);
    expect(result.lines.find((l) => l.name.startsWith("metrics: backlinks"))).toMatchObject({ verdict: "PASS", value: expect.stringContaining("USD cap after 1 of 2") });
  });

  it("times out on a crawl that never finishes: FAIL, exit 1, nothing else checked", async () => {
    db.jobStates = [job("RUNNING")];
    const { result } = await run(FULL);
    expect(result.exitCode).toBe(1);
    expect(result.lines).toEqual([{ verdict: "FAIL", name: "job completed", value: expect.stringContaining("timeout") }]);
  });

  it("SKIPs compare with no earlier crawl of the host, and the opt-in checks without their flags", async () => {
    db.earlier = [{ id: "other", rootUrl: "https://elsewhere.com/" }];
    db.jobStates = [job("COMPLETED", {}, { renderMode: "none", pagesRendered: 0 })];
    db.coverage = [];
    db.seoCalls = [];
    const { result } = await run(["--tenant", "smoke", "--url", "https://echorank360.com", "--timeout", "1"]);
    expect(addJob).toHaveBeenCalledTimes(1);
    expect(db.createdJob!.config).toBeUndefined();
    for (const name of ["rendered pages", "metrics: psi", "metrics: backlinks", "extraction values", "search counts", "segment totals", "compare"]) {
      expect(verdictOf(result.lines, name), name).toBe("SKIP");
    }
  });

  it("refuses before enqueueing when the handler would: over the plan's PSI cap", async () => {
    const { result } = await run(["--tenant", "smoke", "--url", "https://echorank360.com", "--psi", "999"]);
    expect(addJob).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(1);
    expect(result.lines[0]).toMatchObject({ verdict: "FAIL", name: "start" });
  });

  it("FAILs the API checks without AUTH_SECRET instead of calling them unauthenticated", async () => {
    const { result } = await run(FULL, {});
    expect(fetchStub).not.toHaveBeenCalled();
    expect(result.lines.find((l) => l.name === "PDF report")).toMatchObject({ verdict: "FAIL", value: expect.stringContaining("AUTH_SECRET") });
  });
});
