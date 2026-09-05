// MCP tool surface — the parts that can leak another workspace's data, spend
// money, or hand an agent a shape it will act on.
//
// Three layers, tested separately because they fail separately:
//
//   1. AUTH        — the route's bearer-key path: no key, revoked key,
//                    unpaid plan, rate limit. tests/… has no coverage of this
//                    endpoint otherwise.
//   2. ISOLATION   — every read in src/lib/mcp/reads.ts, called directly with
//                    two tenant ids, asserting the tenant filter reached the
//                    query. This is the assertion that matters most on this
//                    surface: an API key is a long-lived bearer token handed to
//                    a third-party agent.
//   3. SHAPE       — output-schema validation and the text-table renderers,
//                    over literals. No DB, no mocks, no drift.
//
// Prisma and the DataForSEO metered client are stubbed. Everything else — zod
// input parsing, output validation, table rendering, quota arithmetic — is the
// real code path.

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const tenant = { findUnique: vi.fn() };
// `update` is awaited-and-discarded with `.catch()` inside verifyApiKey, so
// the stub must return a real promise or the auth path throws on a VALID key.
const apiKey = {
  findUnique: vi.fn(),
  update: vi.fn(async () => ({})),
  count: vi.fn(async () => 1),
};
const serpCheck = { findFirst: vi.fn() };
const rankProject = { findFirst: vi.fn(), findMany: vi.fn(async () => []) };
const rankKeyword = { count: vi.fn(async () => 0) };
const backlinksAnalysis = { findFirst: vi.fn() };
const siteExplorerAnalysis = { findFirst: vi.fn() };
const keywordOpportunityAnalysis = { findFirst: vi.fn(), count: vi.fn(async () => 0) };
const gscConnection = { findUnique: vi.fn() };
const gscQueryStat = { groupBy: vi.fn(async () => []) };
const crawlJob = { findFirst: vi.fn() };
const crawlIssue = { groupBy: vi.fn(async () => []) };
const seoApiCall = { count: vi.fn(async () => 0), aggregate: vi.fn(async () => ({ _sum: { costUsd: 0 } })) };
const creditLedger = { aggregate: vi.fn(async () => ({ _sum: { delta: 0 } })) };
const keywordOpportunityCredit = { aggregate: vi.fn(async () => ({ _sum: { delta: 0 } })) };
const visibilityAudit = { findFirst: vi.fn() };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant,
    apiKey,
    serpCheck,
    rankProject,
    rankKeyword,
    backlinksAnalysis,
    siteExplorerAnalysis,
    keywordOpportunityAnalysis,
    gscConnection,
    gscQueryStat,
    crawlJob,
    crawlIssue,
    seoApiCall,
    creditLedger,
    keywordOpportunityCredit,
    visibilityAudit,
  },
}));

const hasPaidPlan = vi.fn<(tenantId: string) => Promise<boolean>>(async () => true);
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  hasPaidPlan: (id: string) => hasPaidPlan(id),
}));

const rateLimit = vi.fn<
  (...args: unknown[]) => Promise<{ success: boolean; remaining: number }>
>(async () => ({ success: true, remaining: 59 }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimit(...args),
}));

// Nothing in this suite may reach the provider.
vi.mock("@/lib/dataforseo/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dataforseo/client")>()),
  postTask: vi.fn(async () => {
    throw new Error("postTask must never be called from the MCP test suite");
  }),
}));

const { POST, GET } = await import("@/app/api/public/v1/mcp/route");
const reads = await import("@/lib/mcp/reads");
type McpTenant = import("@/lib/mcp/reads").McpTenant;
const { handleMcpMessage, MCP_TOOLS, MCP_TOOL_NAMES, MCP_WRITE_TOOLS } = await import(
  "@/lib/mcp/handler"
);
const { MCP_OUTPUT_SCHEMAS, missingOutputSchemas, orphanOutputSchemas } = await import(
  "@/lib/mcp/output-schemas"
);
const { MCP_INPUT_SCHEMAS, missingInputSchemas } = await import("@/lib/mcp/schemas");
const render = await import("@/lib/mcp/render");
const { formatMcpCell, formatMcpTable, truncatedCell } = await import("@/lib/mcp/table");

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TENANT_A: McpTenant = { id: "tenant_a", name: "Alpha Co", plan: "GROWTH" };
const TENANT_B: McpTenant = { id: "tenant_b", name: "Beta Co", plan: "AGENCY" };

/** A well-formed key of the exact wire shape api-keys.ts parses. */
const GOOD_KEY = `er_api_${"a".repeat(24)}.${"b".repeat(48)}`;

function rpc(body: unknown, key = GOOD_KEY) {
  return new Request("https://echorank360.com/api/public/v1/mcp", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  hasPaidPlan.mockResolvedValue(true);
  rateLimit.mockResolvedValue({ success: true, remaining: 59 });
  seoApiCall.count.mockResolvedValue(0);
  seoApiCall.aggregate.mockResolvedValue({ _sum: { costUsd: 0 } });
  rankKeyword.count.mockResolvedValue(0);
  rankProject.findMany.mockResolvedValue([]);
  keywordOpportunityAnalysis.findFirst.mockResolvedValue(null);
  keywordOpportunityAnalysis.count.mockResolvedValue(0);
  keywordOpportunityCredit.aggregate.mockResolvedValue({ _sum: { delta: 0 } });
  gscQueryStat.groupBy.mockResolvedValue([]);
  crawlIssue.groupBy.mockResolvedValue([]);
});

// ─── 1. Auth ─────────────────────────────────────────────────────────────────

describe("MCP endpoint auth", () => {
  it("rejects a request with no bearer key", async () => {
    const res = await POST(
      new Request("https://echorank360.com/api/public/v1/mcp", {
        method: "POST",
        body: "{}",
      }) as never,
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe("Bearer");
  });

  it("rejects a key that does not exist", async () => {
    apiKey.findUnique.mockResolvedValue(null);
    const res = await POST(rpc({ jsonrpc: "2.0", id: 1, method: "ping" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "invalid_or_revoked_key" });
  });

  it("rejects a REVOKED key even though its hash still matches", async () => {
    // The row is found and the constant-time compare succeeds — revocation is
    // the only thing standing between this key and the workspace's data.
    const { createHash } = await import("crypto");
    const keyHash = createHash("sha256").update("b".repeat(48)).digest("hex");
    apiKey.findUnique.mockResolvedValue({
      id: "key_1",
      tenantId: TENANT_A.id,
      keyHash,
      revokedAt: new Date("2026-01-01"),
    });
    const res = await POST(rpc({ jsonrpc: "2.0", id: 1, method: "ping" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "invalid_or_revoked_key" });
    // And nothing was read on the way out.
    expect(tenant.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a valid key on an unpaid workspace", async () => {
    const { createHash } = await import("crypto");
    apiKey.findUnique.mockResolvedValue({
      id: "key_1",
      tenantId: TENANT_A.id,
      keyHash: createHash("sha256").update("b".repeat(48)).digest("hex"),
      revokedAt: null,
    });
    hasPaidPlan.mockResolvedValue(false);
    const res = await POST(rpc({ jsonrpc: "2.0", id: 1, method: "ping" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "subscription_inactive" });
  });

  it("answers ping for a valid, paid, unrevoked key", async () => {
    const { createHash } = await import("crypto");
    apiKey.findUnique.mockResolvedValue({
      id: "key_1",
      tenantId: TENANT_A.id,
      keyHash: createHash("sha256").update("b".repeat(48)).digest("hex"),
      revokedAt: null,
    });
    const res = await POST(rpc({ jsonrpc: "2.0", id: 1, method: "ping" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ jsonrpc: "2.0", id: 1, result: {} });
  });

  it("is POST-only", async () => {
    expect(GET().status).toBe(405);
  });
});

// ─── 2. Tenant isolation ─────────────────────────────────────────────────────

describe("tenant isolation", () => {
  it("scopes get_serp_check by id AND tenant, never by id alone", async () => {
    serpCheck.findFirst.mockResolvedValue(null);
    await reads.getSerpCheck(TENANT_A, { id: "chk_owned_by_b" });
    expect(serpCheck.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "chk_owned_by_b", tenantId: "tenant_a" }),
      }),
    );
  });

  it("scopes backlinks, domain overview, crawl and KOF reads by tenant", async () => {
    backlinksAnalysis.findFirst.mockResolvedValue(null);
    siteExplorerAnalysis.findFirst.mockResolvedValue(null);
    crawlJob.findFirst.mockResolvedValue(null);
    keywordOpportunityAnalysis.findFirst.mockResolvedValue(null);

    await reads.getBacklinksOverview(TENANT_B, {});
    await reads.getDomainOverview(TENANT_B, {});
    await reads.getCrawlSummary(TENANT_B, { crawlJobId: "crawl_from_a" });
    await reads.listKeywordOpportunities(TENANT_B, {});

    for (const spy of [
      backlinksAnalysis.findFirst,
      siteExplorerAnalysis.findFirst,
      crawlJob.findFirst,
      keywordOpportunityAnalysis.findFirst,
    ]) {
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: "tenant_b" }),
        }),
      );
    }
  });

  it("scopes the Search Console aggregate by tenant and to the page:'' rows", async () => {
    gscConnection.findUnique.mockResolvedValue({
      status: "CONNECTED",
      siteUrl: "sc-domain:alpha.example",
      lastSyncAt: new Date("2026-09-01"),
    });
    await reads.getGscQueries(TENANT_A, { days: 28, limit: 10 });
    expect(gscQueryStat.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant_a", page: "" }),
      }),
    );
  });

  it("refuses to edit a rank project that belongs to another workspace", async () => {
    rankProject.findFirst.mockResolvedValue(null);
    await expect(
      reads.addRankTrackingKeywords(TENANT_A, {
        projectId: "proj_owned_by_b",
        keywords: ["seo"],
      }),
    ).rejects.toThrow(/No rank-tracking project with that id in this workspace/);
    expect(rankProject.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "proj_owned_by_b", tenantId: "tenant_a" },
      }),
    );
  });

  it("loadMcpTenant throws rather than returning a null tenant", async () => {
    tenant.findUnique.mockResolvedValue(null);
    await expect(reads.loadMcpTenant("nope")).rejects.toThrow(/Workspace not found/);
  });
});

// ─── 3. Reads ────────────────────────────────────────────────────────────────

describe("reads", () => {
  it("whoami reports allowances from the code that enforces them", async () => {
    seoApiCall.count.mockResolvedValue(7);
    seoApiCall.aggregate.mockResolvedValue({ _sum: { costUsd: 3.25 } });
    rankKeyword.count.mockResolvedValue(42);
    keywordOpportunityAnalysis.count.mockResolvedValue(2);

    const out = await reads.whoami(TENANT_A);
    expect(out.workspace).toEqual({ name: "Alpha Co", plan: "GROWTH" });
    expect(out.seoSearches.used).toBe(7);
    expect(out.trackedKeywords.used).toBe(42);
    expect(out.keywordOpportunity.allowanceUsed).toBe(2);
    expect(out.dataforseoSpend.monthUsd).toBe(3.25);
    expect(out.dataforseoSpend.remainingUsd).toBe(
      Number((out.dataforseoSpend.capUsd - 3.25).toFixed(6)),
    );
    // And it validates against its own schema.
    expect(MCP_OUTPUT_SCHEMAS.whoami.safeParse(out).success).toBe(true);
  });

  it("get_gsc_queries distinguishes not-connected, needs-reauth and no-rows", async () => {
    gscConnection.findUnique.mockResolvedValue(null);
    const notConnected = await reads.getGscQueries(TENANT_A, {});
    expect(notConnected.connected).toBe(false);
    expect(notConnected.note).toMatch(/not connected/i);

    gscConnection.findUnique.mockResolvedValue({
      status: "NEEDS_REAUTH",
      siteUrl: "sc-domain:alpha.example",
      lastSyncAt: new Date("2026-08-01"),
    });
    const reauth = await reads.getGscQueries(TENANT_A, {});
    expect(reauth.connected).toBe(true);
    expect(reauth.needsReauth).toBe(true);

    gscConnection.findUnique.mockResolvedValue({
      status: "CONNECTED",
      siteUrl: "sc-domain:alpha.example",
      lastSyncAt: new Date("2026-09-01"),
    });
    const empty = await reads.getGscQueries(TENANT_A, {});
    // An empty window on a synced property is NOT a broken sync. The note has
    // to explain WHY it is empty and then say so outright — a bare "no rows"
    // is what sends a customer to support.
    expect(empty.note).toMatch(/withholds/i);
    expect(empty.note).toMatch(/does not mean the sync is broken/i);
  });

  it("removing every keyword from a project is refused rather than emptying it", async () => {
    rankProject.findFirst.mockResolvedValue({
      id: "proj_1",
      name: "Alpha",
      domain: "alpha.example",
      locationCode: 2124,
      languageCode: "en",
      device: "desktop",
      frequency: "weekly",
      keywords: [{ keyword: "seo" }],
    });
    await expect(
      reads.removeRankTrackingKeywords(TENANT_A, { projectId: "proj_1", keywords: ["seo"] }),
    ).rejects.toThrow(/no keywords/i);
  });

  it("adding an already-tracked keyword changes nothing and says so", async () => {
    rankProject.findFirst.mockResolvedValue({
      id: "proj_1",
      name: "Alpha",
      domain: "alpha.example",
      locationCode: 2124,
      languageCode: "en",
      device: "desktop",
      frequency: "weekly",
      keywords: [{ keyword: "seo" }],
    });
    const out = await reads.addRankTrackingKeywords(TENANT_A, {
      projectId: "proj_1",
      keywords: ["seo"],
    });
    expect(out.changed).toEqual([]);
    expect(out.ignored).toEqual(["seo"]);
    expect(out.note).toMatch(/already tracked/i);
  });
});

// ─── 4. Schema coverage and validation ───────────────────────────────────────

describe("schema discipline", () => {
  it("every catalog tool has an input schema and an output schema, and no orphans", () => {
    expect(missingInputSchemas()).toEqual([]);
    expect(missingOutputSchemas()).toEqual([]);
    expect(orphanOutputSchemas()).toEqual([]);
    expect(Object.keys(MCP_INPUT_SCHEMAS).sort()).toEqual([...MCP_TOOL_NAMES].sort());
  });

  it("every tool declares readOnlyHint, and only three may write", () => {
    for (const tool of MCP_TOOLS) {
      expect(typeof tool.annotations?.readOnlyHint).toBe("boolean");
    }
    expect([...MCP_WRITE_TOOLS].sort()).toEqual([
      "add_rank_tracking_keywords",
      "remove_rank_tracking_keywords",
      "start_serp_check",
    ]);
  });

  it("output schemas keep added fields and reject removed ones", () => {
    const payload = {
      found: true,
      crawl: {
        id: "c1",
        rootUrl: "https://alpha.example",
        status: "COMPLETED",
        pagesCrawled: 100,
        issueCount: 3,
        stoppedReason: null,
        finishedAt: "2026-09-01T00:00:00.000Z",
      },
      topIssues: [],
      // A field the schema does not know about must survive, not fail.
      futureField: "kept",
    };
    const ok = MCP_OUTPUT_SCHEMAS.get_crawl_summary.safeParse(payload);
    expect(ok.success).toBe(true);
    expect((ok.data as Record<string, unknown>).futureField).toBe("kept");

    const { found: _removed, ...missing } = payload;
    void _removed;
    expect(MCP_OUTPUT_SCHEMAS.get_crawl_summary.safeParse(missing).success).toBe(false);
  });

  it("a null rank position survives validation as null, never as zero", () => {
    const parsed = MCP_OUTPUT_SCHEMAS.get_rank_tracker.safeParse({
      projects: [],
      project: null,
      keywords: [
        {
          keyword: "reputation management",
          position: null,
          url: null,
          deltaPrevious: null,
          delta30d: null,
          pending: false,
        },
      ],
    });
    expect(parsed.success).toBe(true);
    const keywords = (parsed.data as { keywords: { position: number | null }[] }).keywords;
    expect(keywords[0].position).toBeNull();
  });

  it("input schemas reject an unoffered market and coerce a stringy limit", () => {
    expect(
      MCP_INPUT_SCHEMAS.start_serp_check.safeParse({ keyword: "x", locationCode: 9999 }).success,
    ).toBe(false);
    const coerced = MCP_INPUT_SCHEMAS.get_gsc_queries.safeParse({ limit: "50", days: "7" });
    expect(coerced.success).toBe(true);
    expect(coerced.data).toEqual({ limit: 50, days: 7 });
  });

  it("the keyword list is trimmed, de-duplicated, and cannot end up empty", () => {
    const parsed = MCP_INPUT_SCHEMAS.add_rank_tracking_keywords.safeParse({
      projectId: "p1",
      keywords: ["  seo  ", "seo", "local   seo", ""],
    });
    expect(parsed.success).toBe(true);
    expect((parsed.data as { keywords: string[] }).keywords).toEqual(["seo", "local seo"]);

    expect(
      MCP_INPUT_SCHEMAS.add_rank_tracking_keywords.safeParse({
        projectId: "p1",
        keywords: ["  ", ""],
      }).success,
    ).toBe(false);
  });
});

// ─── 5. Text rendering ───────────────────────────────────────────────────────

describe("table text output", () => {
  it("formats cells the way the table promises", () => {
    expect(formatMcpCell(null)).toBe("—");
    expect(formatMcpCell("")).toBe("—");
    expect(formatMcpCell(3)).toBe("3");
    expect(formatMcpCell(3.14159)).toBe("3.14");
    expect(formatMcpCell(true)).toBe("yes");
    expect(formatMcpCell(Number.NaN)).toBe("—");
    // A newline inside provider text would otherwise split the row in half.
    expect(formatMcpCell("two\nlines")).toBe("two lines");
    expect(truncatedCell(6)("abcdefghij")).toBe("abcde…");
  });

  it("renders a header row and one line per row", () => {
    const text = formatMcpTable(
      [
        { a: 1, b: "x" },
        { a: 2, b: null },
      ],
      [
        { header: "a", value: (r) => r.a },
        { header: "b", value: (r) => r.b },
      ],
    );
    expect(text).toBe("a | b\n1 | x\n2 | —");
  });

  it("whoami text names the workspace and every allowance", () => {
    const text = render.renderWhoami({
      workspace: { name: "Alpha Co", plan: "GROWTH" },
      seoSearches: {
        used: 7,
        limit: 50,
        remaining: 43,
        unlimited: false,
        resetsAt: "2026-10-01T00:00:00.000Z",
      },
      keywordOpportunity: {
        allowanceTotal: 5,
        allowanceUsed: 1,
        allowanceRemaining: 4,
        credits: 2,
      },
      trackedKeywords: { used: 42, limit: 100 },
      dataforseoSpend: { monthUsd: 3.25, capUsd: 25, remainingUsd: 21.75 },
    });
    expect(text).toContain("Workspace: Alpha Co");
    expect(text).toContain("7 of 50 used — 43 left");
    expect(text).toContain("plus 2 prepaid credits");
    expect(text).toContain("Tracked keywords: 42 of 100");
    expect(text).toContain("$3.25 of $25.00 cap — $21.75 left");
  });

  it("an unlimited allowance renders as 'unlimited', not as a dash", () => {
    const text = render.renderWhoami({
      workspace: { name: "Ent Co", plan: "ENTERPRISE" },
      seoSearches: {
        used: 9,
        limit: null,
        remaining: null,
        unlimited: true,
        resetsAt: "2026-10-01T00:00:00.000Z",
      },
      keywordOpportunity: {
        allowanceTotal: null,
        allowanceUsed: 3,
        allowanceRemaining: null,
        credits: 0,
      },
      trackedKeywords: { used: 5, limit: 1000 },
      dataforseoSpend: { monthUsd: 0, capUsd: 25, remainingUsd: 25 },
    });
    expect(text).toContain("9 used (unlimited)");
    expect(text).toContain("3 of unlimited used — unlimited left");
    // No FACT may render as the empty-cell dash: "unlimited" is a value, and
    // showing it as "—" would read as "we do not know".
    expect(text).not.toMatch(/: —$/m);
  });

  it("rank-tracker text shows an unranked keyword as a dash, never as 0", () => {
    const text = render.renderRankTracker({
      projects: [],
      project: {
        id: "p1",
        name: "Alpha",
        domain: "alpha.example",
        locationCode: 2124,
        languageCode: "en",
        device: "desktop",
        frequency: "weekly",
        active: true,
        overCap: false,
        keywordCount: 2,
        lastRunAt: "2026-09-01T00:00:00.000Z",
        pendingCount: 0,
        averagePosition: 7.5,
      },
      keywords: [
        {
          keyword: "ranked",
          position: 3,
          url: "https://alpha.example/a",
          deltaPrevious: 2,
          delta30d: null,
          pending: false,
        },
        {
          keyword: "unranked",
          position: null,
          url: null,
          deltaPrevious: null,
          delta30d: null,
          pending: false,
        },
      ],
    });
    expect(text).toContain("keyword | pos | vs prev | vs 30d | pending | url");
    expect(text).toContain("ranked | 3 | 2 | — | no | https://alpha.example/a");
    expect(text).toContain("unranked | — | — | — | no | —");
  });

  it("an empty project list renders the note instead of a bare header", () => {
    const text = render.renderRankTracker({
      projects: [],
      project: null,
      keywords: [],
      note: "No rank-tracking projects on this workspace.",
    });
    expect(text).toBe(
      "Rank-tracking projects\nNo rank-tracking projects on this workspace.",
    );
  });

  it("caps rows in text and says how many stayed in structuredContent", () => {
    const many = Array.from({ length: render.__rendering.TEXT_ROW_CAP + 5 }, (_, i) => ({
      query: `q${i}`,
      clicks: i,
      impressions: i * 10,
      ctr: 1.5,
      avgPosition: 4.2,
    }));
    const text = render.renderGscQueries({
      connected: true,
      needsReauth: false,
      property: "sc-domain:alpha.example",
      windowDays: 28,
      lastSyncAt: "2026-09-01T00:00:00.000Z",
      queries: many,
    });
    expect(text).toContain("… 5 more rows in structuredContent.");
    expect(text).not.toContain(`q${render.__rendering.TEXT_ROW_CAP + 1}`);
  });

  it("the three externally-shaped tools fall back to pretty JSON", () => {
    // These carry nested reports from the sidecar and the shared visibility
    // summary, not row sets. A table would flatten their structure away, so
    // the fallback is the intended rendering rather than a gap.
    for (const name of ["suggest_keywords", "get_latest_audit", "get_visibility_summary"]) {
      expect(render.renderToolText(name, { nested: { a: 1 } })).toBe(
        JSON.stringify({ nested: { a: 1 } }, null, 2),
      );
    }
    // Renderers run over ALREADY-VALIDATED payloads and are entitled to assume
    // their shape, so they cannot be probed with a sentinel. What must hold is
    // that no OTHER tool silently shares the fallback — a tool that lost its
    // renderer would go back to dumping JSON without anything failing.
    const fallbackTools = MCP_TOOL_NAMES.filter(
      (name) => !render.hasDedicatedRenderer(name),
    );
    expect(fallbackTools.sort()).toEqual([
      "get_latest_audit",
      "get_visibility_summary",
      "suggest_keywords",
    ]);
  });
});

// ─── 6. Protocol wiring through the real handler ─────────────────────────────

describe("handler wiring", () => {
  it("packages a tool result with both a text block and structuredContent", async () => {
    const caps = {
      async getCrawlSummary() {
        return {
          found: true,
          crawl: {
            id: "c1",
            rootUrl: "https://alpha.example",
            status: "COMPLETED",
            pagesCrawled: 120,
            issueCount: 4,
            stoppedReason: null,
            finishedAt: "2026-09-01T00:00:00.000Z",
          },
          topIssues: [{ type: "missing_title", severity: "high", pages: 3 }],
        };
      },
    } as never;

    const res = await handleMcpMessage(
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_crawl_summary" } },
      caps,
    );
    const body = res.body as {
      result: {
        content: { type: string; text: string }[];
        structuredContent: { crawl: { pagesCrawled: number } };
        isError?: boolean;
      };
    };
    expect(body.result.isError).toBeUndefined();
    expect(body.result.content[0].text).toContain("issue | severity | pages");
    expect(body.result.content[0].text).toContain("missing_title | high | 3");
    expect(body.result.structuredContent.crawl.pagesCrawled).toBe(120);
  });

  it("surfaces a quota denial as a tool error carrying the service's own message", async () => {
    const caps = {
      async startSerpCheck() {
        throw new Error("Monthly SERP check limit reached (25 on the GROWTH plan).");
      },
    } as never;
    const res = await handleMcpMessage(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "start_serp_check", arguments: { keyword: "reputation software" } },
      },
      caps,
    );
    const body = res.body as { result: { isError?: boolean; content: { text: string }[] } };
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("Monthly SERP check limit reached");
  });
});
