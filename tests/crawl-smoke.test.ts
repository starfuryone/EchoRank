// scripts/crawl-smoke.ts → src/lib/site-crawler/smoke.ts, against a stubbed
// queue and database. The real startCrawl, checkCrawlConfig, plan caps and
// StartCrawlBodySchema run; prisma, Redis, the BullMQ registry, the rate
// limiter and the paid-plan lookup are fakes, and HTTP is a fetch stub that
// answers the crawl API routes. What is asserted: the config reaches the
// enqueued crawl as the handler would build it, the estimate is printed
// before the enqueue, the checks pass on a healthy crawl and FAIL (exit 1)
// on the drifts they exist for, and no credential is ever printed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  jsValues: [] as Row[],
  inspectionRows: 0,
  aiValues: [] as Row[],
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
    count: vi.fn(async () => 1),
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
  // Phase 4g: outbound link rows; URL Inspection rows.
  crawlLink: { count: vi.fn(async ({ where }: { where: { status?: unknown } }) => (where.status ? 3 : 4)) },
  crawlPageMetric: {
    count: vi.fn(async () => db.inspectionRows),
    groupBy: vi.fn(async () => db.coverage),
    findMany: vi.fn(async () => [
      { source: "psi", data: { mobile: { performance: 71 }, desktop: { performance: 88 } }, page: { statusCode: 200 } },
      { source: "backlinks", data: { backlinks: 4, referringDomains: 2, rank: 10 }, page: { statusCode: 200 } },
    ]),
  },
  crawlExtraction: {
    findMany: vi.fn(async ({ where }: { where: { kind?: string } }) => (where.kind === "js" ? db.jsValues : db.aiValues)),
    groupBy: vi.fn(async ({ by }: { by: string[] }) =>
      by[0] === "extractorIndex" ? [{ extractorIndex: 0, _count: { _all: 2 } }, { extractorIndex: 1, _count: { _all: 1 } }] : [{ pageId: "p1", _count: { _all: 2 } }],
    ),
  },
  gscConnection: { findUnique: vi.fn(async () => null) },
  tenantAiKey: { findMany: vi.fn(async () => []) },
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
// --via api (Phase 3d-A): a throwaway key, created and revoked by the run.
const SMOKE_KEY = "er_api_0123456789abcdef01234567.00112233445566778899aabbccddeeff0011223344556677";
const createApiKey = vi.fn(async () => ({ key: SMOKE_KEY, id: "key_smoke", prefix: "01234567" }));
const revokeApiKey = vi.fn(async () => true);
vi.mock("@/lib/api-keys", () => ({ createApiKey: (...a: unknown[]) => createApiKey(...(a as [])), revokeApiKey: (...a: unknown[]) => revokeApiKey(...(a as [])) }));
vi.mock("@/lib/dataforseo/metering", () => ({ monthlyCapUsd: vi.fn(async () => 25), spentThisMonth: vi.fn(async () => 1), seoMeteredCall: vi.fn() }));

const { parseArgs, requestBody, runSmoke, csvHeaderCells } = await import("@/lib/site-crawler/smoke");
const { StartCrawlBodySchema } = await import("@/lib/site-crawler/start-body");
const { ISSUE_COLUMNS, LINK_SCORE_COLUMN, metricCsvColumns, pageColumns, withSegmentColumn } = await import("@/lib/site-crawler/csv-columns");

// ── fake web process ─────────────────────────────────────────────────────────
type Answer = { status?: number; json?: unknown; csv?: string; pdf?: boolean; type?: string; html?: string };
let routes: Record<string, Answer>;
const seen: { url: string; init: RequestInit }[] = [];
const fetchStub = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
  const u = new URL(String(url));
  seen.push({ url: u.pathname + u.search, init: init ?? {} });
  const key = `${init?.method ?? "GET"} ${u.pathname.replace(`/api/seo/v1/crawl/${JOB_ID}`, "")}${u.search}`;
  const match = routes[key] ?? routes[key.replace(/\?.*$/, "")];
  if (!match) return new Response(JSON.stringify({ error: `no stub for ${key}` }), { status: 404 });
  if (match.pdf) return new Response(new TextEncoder().encode("%PDF-1.7 fake"), { status: 200, headers: { "content-type": match.type ?? "application/pdf" } });
  if (match.html !== undefined) return new Response(match.html, { status: match.status ?? 200, headers: { "content-type": "text/html" } });
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
    // Phase 4g: a crawl with Link Scores exports the Link Score column.
    "GET /pages?format=csv": { csv: csvLine(withSegmentColumn([...pageColumns(searches), LINK_SCORE_COLUMN, ...metricCsvColumns(["psi", "backlinks"])], segDefs as never, () => []).map((c) => c.header)) },
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

// ─── Phase 4e: --js, --ai, --login ──────────────────────────────────────────

describe("crawl smoke: 4e flags", () => {
  const E4 = ["--tenant", "smoke", "--url", "https://echorank360.com", "--render", "thin", "--js", "dataLayer", "--ai", "suggest title", "--ai-pages", "2", "--login", "--timeout", "1"];
  const sealedLogin = {
    loginUrl: "https://echorank360.com/login", usernameSelector: "#u", passwordSelector: "#p", submitSelector: "#go",
    successCheck: { kind: "urlPrefix", value: "https://echorank360.com/account" },
    username: { enc: "v1:a:b:c" }, password: { enc: "v1:d:e:f" },
  };
  beforeEach(() => {
    healthy();
    vi.clearAllMocks();
    prismaFake.crawlSiteDefault.findUnique.mockResolvedValue({ verifiedAt: T0, config: null, jsSnippets: null, login: sealedLogin } as never);
    const ai = { status: "done", targets: 2, completed: 2, failed: 0, tokens: 1800 };
    const loggedIn = (status: string, m: Record<string, unknown> = {}) => job(status, m, { summary: { totals: { ERROR: 1, WARNING: 2, NOTICE: 3 }, metrics: m, login: { status: "ok" } } });
    db.jobStates = [loggedIn("RUNNING"), loggedIn("COMPLETED", { ai: { status: "running" } }), loggedIn("COMPLETED", { ai })];
    db.jsValues = [{ pageId: "p1", values: ['[{"event":"gtm.js"}]'] }, { pageId: "p2", values: ["error: boom"] }];
    db.aiValues = [{ pageId: "p1", values: ["Title: A"] }, { pageId: "p2", values: ["Title: B"] }];
    let reads = 0;
    // Read by the quota (start card) and the smoke's "before"; then after the run.
    fakeRedis.get.mockImplementation(async () => (reads++ < 2 ? "1000" : "2800") as never);
    prismaFake.crawlPage.count.mockResolvedValue(2);
  });
  afterEach(() => {
    prismaFake.crawlSiteDefault.findUnique.mockResolvedValue(null as never);
    fakeRedis.get.mockReset();
    fakeRedis.get.mockImplementation(async () => null);
    prismaFake.crawlPage.count.mockResolvedValue(3);
  });

  it("parses the flags; --js needs --render; --ai takes labels or ids", () => {
    expect(parseArgs(E4, {})).toMatchObject({ js: "dataLayer", ai: ["title"], aiPages: 2, login: true });
    expect(parseArgs(["--ai", "Grammar check,intent"], {}).ai).toEqual(["grammar", "intent"]);
    expect(() => parseArgs(["--js", "dataLayer"], {})).toThrow(/--render/);
    expect(() => parseArgs(["--render", "all", "--js", "custom"], {})).toThrow(/--js takes/);
    expect(() => parseArgs(["--ai", "poem"], {})).toThrow(/unknown prompt/);
    expect(() => parseArgs(["--ai", "title,intent,summary,grammar"], {})).toThrow(/at most 3/);
  });

  it("asks for the snippet, the prompts and the saved login in a body the handler accepts", () => {
    const body = requestBody(parseArgs(E4, {})) as { config: Record<string, unknown> };
    expect(StartCrawlBodySchema.safeParse(body).success).toBe(true);
    expect(body.config).toMatchObject({
      js: [{ name: "dataLayer", preset: "dataLayer", selector: null, code: null }],
      ai: { provider: "claude", prompts: [{ preset: "title", text: null }], top: { pages: 2, segment: null } },
      useLogin: true,
    });
  });

  it("PASSes snippet values, AI answers with the meter under the estimate × 1.5, and authenticated pages", async () => {
    const { result, out } = await run(E4);
    const config = db.createdJob!.config as Record<string, unknown>;
    expect(config.login).toEqual(sealedLogin);
    expect(verdictOf(result.lines, "js snippet values present")).toBe("PASS");
    expect(verdictOf(result.lines, "ai values present")).toBe("PASS");
    expect(result.lines.find((l) => l.name.startsWith("ai token meter"))).toMatchObject({ verdict: "PASS", value: "meter moved 1800 · estimate 2400 · limit 3600" });
    expect(verdictOf(result.lines, "authenticated pages crawled")).toBe("PASS");
    expect(out.join("\n")).not.toMatch(/v1:a:b:c|v1:d:e:f/);
  });

  it("FAILs when the meter moved past 1.5× the estimate, or the login failed", async () => {
    let reads = 0;
    fakeRedis.get.mockImplementation(async () => (reads++ < 2 ? "0" : "9000") as never);
    const failed = (status: string) => job(status, {}, { summary: { totals: { ERROR: 1, WARNING: 2, NOTICE: 3 }, metrics: { ai: { status: "done" } }, login: { status: "failed", reason: "success_check_failed" } } });
    db.jobStates = [failed("COMPLETED")];
    const { result } = await run(E4);
    expect(verdictOf(result.lines, "ai token meter")).toBe("FAIL");
    expect(result.lines.find((l) => l.name.startsWith("authenticated pages"))).toMatchObject({ verdict: "FAIL", value: "login failed (success_check_failed)" });
    expect(result.exitCode).toBe(1);
  });
});

// ─── Phase 4g: --semantic, --inspect, external links, Link Score ────────────

describe("crawl smoke: 4g flags", () => {
  const G4 = ["--tenant", "smoke", "--url", "https://echorank360.com", "--semantic", "3", "--inspect", "2", "--timeout", "1"];
  beforeEach(() => {
    healthy();
    vi.clearAllMocks();
    db.inspectionRows = 2;
    const done = { semantic: { status: "done", targets: 3, completed: 3, embedded: 3 }, gsc_inspection: { status: "done", targets: 2, completed: 2 } };
    db.jobStates = [job("COMPLETED", done, { summary: { totals: { ERROR: 1, WARNING: 2, NOTICE: 3 }, metrics: done, external: { urls: 4, checked: 3, capped: false } } })];
  });

  it("parses the flags into the opt-ins the handler accepts", () => {
    expect(parseArgs(G4, {})).toMatchObject({ semantic: 3, inspect: 2 });
    const body = requestBody(parseArgs(G4, {})) as { config: Record<string, unknown> };
    expect(StartCrawlBodySchema.safeParse(body).success).toBe(true);
    expect(body.config).toMatchObject({ semantic: { pages: 3, segment: null }, inspection: { pages: 2, segment: null } });
    expect(() => parseArgs(["--inspect", "0"], {})).toThrow(/positive integer/);
  });

  it("PASSes external rows, linkScore populated, semantic rules evaluated and inspection rows <= N", async () => {
    // The handler refuses inspection without a covering GSC property: give it one for this run.
    prismaFake.gscConnection.findUnique.mockResolvedValue({ tenantId: "t1", status: "ACTIVE", siteUrl: "sc-domain:echorank360.com" } as never);
    prismaFake.tenantAiKey.findMany.mockResolvedValue([{ provider: "openai", createdAt: T0, lastUsedAt: null }] as never);
    const { result } = await run(G4);
    for (const name of ["external rows present", "linkScore populated", "semantic rules evaluated", "inspection rows"]) expect(verdictOf(result.lines, name), name).toBe("PASS");
    expect(result.lines.find((l) => l.name.startsWith("external rows"))!.value).toBe("4 rows · 4 distinct URLs · 3 rows with a status");
    prismaFake.gscConnection.findUnique.mockResolvedValue(null as never);
    prismaFake.tenantAiKey.findMany.mockResolvedValue([] as never);
  });

  it("FAILs inspection rows over N", async () => {
    prismaFake.gscConnection.findUnique.mockResolvedValue({ tenantId: "t1", status: "ACTIVE", siteUrl: "sc-domain:echorank360.com" } as never);
    prismaFake.tenantAiKey.findMany.mockResolvedValue([{ provider: "openai", createdAt: T0, lastUsedAt: null }] as never);
    db.inspectionRows = 5;
    const { result } = await run(G4);
    expect(verdictOf(result.lines, "inspection rows")).toBe("FAIL");
    prismaFake.gscConnection.findUnique.mockResolvedValue(null as never);
    prismaFake.tenantAiKey.findMany.mockResolvedValue([] as never);
  });
});

describe("crawl smoke: --via api (Phase 3d-A)", () => {
  const PUBLIC = `/api/public/v1/crawl`;
  const apiRoutes = (start: Answer = { status: 202, json: { crawlId: JOB_ID, status: "queued", queuePosition: 1 } }) => {
    routes[`POST ${PUBLIC}`] = start;
    routes[`GET ${PUBLIC}/${JOB_ID}`] = { json: { crawlId: JOB_ID, status: "completed", progress: { pagesCrawled: 3 }, health: 88 } };
    routes[`GET ${PUBLIC}/${JOB_ID}/issues?limit=5`] = { json: { issues: [{ ruleId: "h1.missing" }], nextCursor: null } };
    routes[`GET ${PUBLIC}/${JOB_ID}/pages?limit=5`] = { json: { pages: [{ id: "p1" }], nextCursor: null } };
    routes[`GET ${PUBLIC}/${JOB_ID}/export?view=issues`] = { csv: csvLine(["URL", "Status code"]) };
  };
  beforeEach(() => {
    healthy();
    vi.clearAllMocks();
  });

  it("parses --via", () => {
    expect(parseArgs(["--via", "api"], {}).via).toBe("api");
    expect(parseArgs([], {}).via).toBe("direct");
    expect(() => parseArgs(["--via", "cli"], {})).toThrow("--via takes api or direct");
  });

  it("starts through POST /api/public/v1/crawl with a throwaway key, checks the read endpoints, revokes the key, never prints it", async () => {
    apiRoutes();
    // The start answers 202 the first time and 200 (the idempotent replay) after.
    let starts = 0;
    const startStub = routes[`POST ${PUBLIC}`]!;
    routes[`POST ${PUBLIC}`] = new Proxy(startStub, { get: (t, k) => (k === "status" ? (starts++ === 0 ? 202 : 200) : (t as Record<string | symbol, unknown>)[k]) }) as Answer;
    const { result, out } = await run([...FULL, "--via", "api"]);
    expect(createApiKey).toHaveBeenCalledWith("t1", "crawl:smoke (temporary)", ["public"]);
    expect(revokeApiKey).toHaveBeenCalledWith("t1", "key_smoke");
    // Started by the API, not directly.
    expect(addJob).not.toHaveBeenCalled();
    for (const name of ["api start", "api idempotency", "api status", "api issues", "api pages", "api CSV issues"]) expect(verdictOf(result.lines, name), name).toBe("PASS");
    const posts = seen.filter((x) => x.url === PUBLIC);
    expect(posts).toHaveLength(2);
    const h = posts[0]!.init.headers as Record<string, string>;
    expect(h.authorization).toBe(`Bearer ${SMOKE_KEY}`);
    expect(h["idempotency-key"]).toMatch(/^crawl-smoke-/);
    expect((posts[1]!.init.headers as Record<string, string>)["idempotency-key"]).toBe(h["idempotency-key"]);
    // The key goes to the public API only, and is never printed.
    for (const x of seen) if (!x.url.startsWith(PUBLIC)) expect(JSON.stringify(x.init)).not.toContain(SMOKE_KEY);
    expect(out.join("\n")).not.toContain(SMOKE_KEY);
    expect(out.join("\n")).not.toContain(SMOKE_KEY.split(".")[1]);
    expect(out).toContain("[smoke] temporary API key revoked");
  });

  it("a refused start FAILs, exits 1, and still revokes the key", async () => {
    apiRoutes({ status: 403, json: { error: "subscription_inactive" } });
    const { result, out } = await run([...FULL, "--via", "api"]);
    expect(verdictOf(result.lines, "api start")).toBe("FAIL");
    expect(result.exitCode).toBe(1);
    expect(revokeApiKey).toHaveBeenCalledTimes(1);
    expect(out.join("\n")).not.toContain(SMOKE_KEY);
  });
});

describe("crawl smoke: --free (the free public crawler)", () => {
  const FREE = "/api/free/v1/site-crawler";
  const TOKEN = "tokABCDEFGHIJKLMNOPQRSTU";
  const freeRow = (over: Record<string, unknown> = {}) => ({
    crawlJob: { id: JOB_ID, urlCap: 100, renderMode: "none", mode: "spider", config: null, tenant: { slug: "free-crawler", source: "free" }, ...over },
  });
  const freeRoutes = (start: Answer = { status: 202, json: { token: TOKEN, reused: false } }) => {
    routes = {};
    routes[`POST ${FREE}`] = start;
    let polls = 0;
    routes[`GET ${FREE}/${TOKEN}`] = new Proxy({} as Answer, {
      get: (_t, k) => (k === "json" ? (polls++ === 0 ? { status: "queued", pagesCrawled: 0, queuePosition: 2 } : { status: "completed", pagesCrawled: 100 }) : undefined),
    });
    routes[`GET /en/free-tools/site-crawler/r/${TOKEN}`] = {
      html: '<meta name="robots" content="noindex, nofollow"/><div data-testid="free-result-summary"></div><div data-testid="free-full-list" data-locked="true"></div>',
    };
    routes[`GET ${FREE}/${TOKEN}/export`] = { status: 403, json: { error: "locked" } };
  };
  beforeEach(() => {
    healthy();
    vi.clearAllMocks();
    (prismaFake as Record<string, unknown>).freeCrawl = { findUnique: vi.fn(async () => freeRow()) };
    prismaFake.crawlJob.findUnique.mockImplementation(async () => ({ pagesCrawled: 100, startedAt: new Date(T0.getTime()), finishedAt: new Date(T0.getTime() + 4 * 60_000), stoppedReason: "url_cap" }) as never);
  });

  it("parses --free (no --tenant needed)", () => {
    expect(parseArgs(["--free", "--url", "https://example.org"], {})).toMatchObject({ free: true, tenant: null, url: "https://example.org" });
    expect(parseArgs([], {}).free).toBe(false);
  });

  it("starts through the public route with the Turnstile test token and a cf-connecting-ip, then checks shape, progress, result page and the locked CSV", async () => {
    freeRoutes();
    const { result, out } = await run(["--free", "--url", "https://example.org"]);
    const start = seen.find((x) => x.url === FREE)!;
    expect(JSON.parse(String(start.init.body))).toMatchObject({ url: "https://example.org", turnstileToken: "XXXX.DUMMY.TOKEN" });
    expect((start.init.headers as Record<string, string>)["cf-connecting-ip"]).toBe("127.0.0.1");
    for (const name of ["free start", "free crawl shape", "free crawl completed", "free crawl within 10 min", "free result page", "free CSV locked"]) {
      expect(verdictOf(result.lines, name), name).toBe("PASS");
    }
    expect(result.exitCode).toBe(0);
    // The result token is shortened in the output, never printed whole.
    expect(out.join("\n")).not.toContain(TOKEN);
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it("fails clearly when the server rejects the test token, and when the crawl is not the free shape", async () => {
    freeRoutes({ status: 403, json: { error: "turnstile" } });
    let r = await run(["--free", "--url", "https://example.org"]);
    expect(r.result.lines.find((l) => l.name === "free start")!.value).toContain("CRAWL_SMOKE_TURNSTILE_TOKEN");
    expect(r.result.exitCode).toBe(1);

    freeRoutes();
    (prismaFake as Record<string, unknown>).freeCrawl = { findUnique: vi.fn(async () => freeRow({ renderMode: "all", tenant: { slug: "acme", source: "customer" } })) };
    r = await run(["--free", "--url", "https://example.org"]);
    expect(verdictOf(r.result.lines, "free crawl shape")).toBe("FAIL");
  });
});
