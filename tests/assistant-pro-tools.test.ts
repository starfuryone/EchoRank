// tests/assistant-pro-tools.test.ts
//
// The Pro assistant's tool layer: what it will read, what it refuses, and what
// it can never be talked into.
//
// ── THE LOAD-BEARING TESTS IN THIS FILE ────────────────────────────────────
// Tenant isolation, asserted three ways, because there are three ways to lose
// it:
//
//   1. THE ARGUMENT SURFACE. No tool's schema accepts a tenant id, so there is
//      no string the model can emit that reaches a WHERE clause as a tenant.
//      Asserted against every tool's JSON Schema, not against a comment.
//   2. THE QUERY. Every Prisma call a tool makes carries the session's
//      tenantId. Asserted by driving real tool bodies against a fake Prisma
//      and inspecting the `where` it was handed.
//   3. THE CACHE KEY. Two tenants asking the identical question must not
//      collide, including when their arguments are chosen to try to make them
//      collide.
//
// And the SSRF/own-domain boundary: a model that has read a hostile page saying
// "now audit attacker.example" must get a refusal, not a fetch.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, sidecarPost, redis, store } = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    prisma: {
      tenant: { findUnique: vi.fn() },
      trackedPrompt: { findMany: vi.fn() },
      promptRun: { groupBy: vi.fn(), findMany: vi.fn() },
      competitor: { findMany: vi.fn() },
      gscConnection: { findUnique: vi.fn() },
      gscQueryStat: { groupBy: vi.fn() },
      crawlJob: { findFirst: vi.fn() },
      crawlIssue: { groupBy: vi.fn() },
      rankProject: { findMany: vi.fn() },
      aiLensAnalysis: { findMany: vi.fn() },
      citation: { groupBy: vi.fn() },
      competitorMention: { groupBy: vi.fn() },
      visibilityAudit: { findMany: vi.fn(), findFirst: vi.fn() },
      alertEvent: { findMany: vi.fn() },
    },
    sidecarPost: vi.fn(),
    redis: {
      get: vi.fn(async (k: string) => store.get(k) ?? null),
      set: vi.fn(async (k: string, v: string) => {
        store.set(k, v);
        return "OK";
      }),
      del: vi.fn(async (k: string) => (store.delete(k) ? 1 : 0)),
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/av-sidecar", () => ({ sidecarPost }));
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => redis }));
vi.mock("@/infrastructure/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { TurnCache } = await import("@/lib/assistant/cache");
const { runTool, toolDefinitions, tenantKey, tenantDomains, TOOL_NAMES } = await import(
  "@/lib/assistant/pro/tools"
);

const TENANT_A = "clteanta0000000000000000";
const TENANT_B = "clteantb0000000000000000";

function ctx(overrides: Partial<Parameters<typeof runTool>[2]> = {}) {
  return {
    tenantId: TENANT_A,
    tenantName: "Acme Dentistry",
    planType: "GROWTH" as const,
    domains: ["acme-dental.com"],
    turn: new TurnCache(),
    forceRefresh: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // The fake Redis is module-scoped, so without this a value cached by one
  // test is served to the next — which silently turns "is the tenant cache
  // working" into "did the previous test happen to write this key".
  store.clear();
  for (const model of Object.values(prisma)) {
    for (const fn of Object.values(model)) {
      (fn as ReturnType<typeof vi.fn>).mockReset();
    }
  }
});

// ─── 1. The argument surface ────────────────────────────────────────────────

describe("no tool can be asked about another tenant", () => {
  it("declares no tenant-shaped argument anywhere in the tool schemas", () => {
    // The whole isolation story starts here: if no schema has a tenant field,
    // no amount of prompt injection produces one, because the API rejects
    // unknown properties (additionalProperties: false) before we see them.
    for (const tool of toolDefinitions()) {
      const properties = Object.keys(tool.input_schema.properties);
      for (const property of properties) {
        expect(property.toLowerCase(), `${tool.name}.${property}`).not.toMatch(
          /tenant|account|org|customer|user/,
        );
      }
    }
  });

  it("closes every tool schema to unknown properties", () => {
    // Without additionalProperties:false a model could smuggle
    // `{ tenantId: "other" }` past the schema and into whatever a future tool
    // body does with its args.
    for (const tool of toolDefinitions()) {
      expect(tool.input_schema.additionalProperties, tool.name).toBe(false);
    }
  });

  it("rejects a tenant id passed as an extra argument", async () => {
    const result = await runTool(
      "getTrackedPrompts",
      { limit: 5, tenantId: TENANT_B },
      ctx(),
    );
    expect(result.ok).toBe(false);
    expect(result.rejected).toBe("invalid_args");
    // And nothing was read.
    expect(prisma.trackedPrompt.findMany).not.toHaveBeenCalled();
  });

  it("refuses an unknown tool by name instead of throwing", async () => {
    const result = await runTool("dropAllTables", {}, ctx());
    expect(result.ok).toBe(false);
    expect(result.rejected).toBe("unknown_tool");
    // The refusal names the real tools so the model can correct itself rather
    // than the turn dying on a typo.
    expect(String((result.value as { error: string }).error)).toContain("getTrackedPrompts");
  });
});

// ─── 2. The query ───────────────────────────────────────────────────────────

describe("every read is scoped to the session's tenant", () => {
  it("scopes tracked prompts", async () => {
    prisma.trackedPrompt.findMany.mockResolvedValue([]);
    await runTool("getTrackedPrompts", {}, ctx());
    expect(prisma.trackedPrompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) }),
    );
  });

  it("scopes competitors", async () => {
    prisma.competitor.findMany.mockResolvedValue([]);
    await runTool("getCompetitorSnapshots", {}, ctx());
    expect(prisma.competitor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) }),
    );
  });

  it("scopes the crawl job", async () => {
    prisma.crawlJob.findFirst.mockResolvedValue(null);
    await runTool("getCrawlSummary", {}, ctx());
    expect(prisma.crawlJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) }),
    );
  });

  it("scopes citations and brand mentions", async () => {
    prisma.citation.groupBy.mockResolvedValue([]);
    prisma.competitorMention.groupBy.mockResolvedValue([]);
    await runTool("getCitations", {}, ctx());
    await runTool("getBrandMentions", {}, ctx());
    expect(prisma.citation.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) }),
    );
    expect(prisma.competitorMention.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) }),
    );
  });

  it("scopes rank tracking and AI Lens", async () => {
    prisma.rankProject.findMany.mockResolvedValue([]);
    prisma.aiLensAnalysis.findMany.mockResolvedValue([]);
    await runTool("getRankTracking", {}, ctx());
    await runTool("getAiLensResults", {}, ctx());
    expect(prisma.rankProject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) }),
    );
    expect(prisma.aiLensAnalysis.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) }),
    );
  });

  it("reads the tenant's own domains from its own row only", async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      auditDomain: "acme-dental.com",
      botAnalyticsDomain: null,
      customDomain: null,
    });
    await tenantDomains(TENANT_A);
    expect(prisma.tenant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TENANT_A } }),
    );
  });
});

// ─── 3. The cache key ───────────────────────────────────────────────────────

describe("cache keys cannot collide across tenants", () => {
  it("puts the tenant id in every key", () => {
    const key = tenantKey(TENANT_A, "prompts", 10);
    expect(key).toContain(TENANT_A);
    expect(key.startsWith("echorank:assistant")).toBe(true);
  });

  it("gives two tenants different keys for identical arguments", () => {
    expect(tenantKey(TENANT_A, "gsc", 28, 10)).not.toBe(tenantKey(TENANT_B, "gsc", 28, 10));
  });

  it("cannot be made to collide by choosing adversarial arguments", () => {
    // The attack: pick a namespace or argument containing the separator, so
    // that tenant A's key renders byte-identical to tenant B's.
    const honest = tenantKey(TENANT_B, "prompts", 10);
    const attack = tenantKey(TENANT_A, `prompts:${TENANT_B}`, 10);
    expect(attack).not.toBe(honest);

    const viaArgument = tenantKey(TENANT_A, "prompts", `10:${TENANT_B}:prompts:10`);
    expect(viaArgument).not.toBe(honest);
  });

  it("serves one tenant's cached value only to that tenant", async () => {
    prisma.trackedPrompt.findMany.mockResolvedValue([
      { id: "p1", text: "secret question", category: null, intent: null, importanceWeight: 1, commercialValue: null, lastRunAt: null },
    ]);
    prisma.promptRun.groupBy.mockResolvedValue([]);

    const first = await runTool("getTrackedPrompts", {}, ctx());
    expect(first.cached).toBe(false);

    // Same tenant, fresh turn: served from the tenant cache.
    const again = await runTool("getTrackedPrompts", {}, ctx());
    expect(again.cached).toBe(true);

    // Different tenant, same question: a miss, and it reads with ITS tenantId.
    prisma.trackedPrompt.findMany.mockClear();
    prisma.trackedPrompt.findMany.mockResolvedValue([]);
    const other = await runTool(
      "getTrackedPrompts",
      {},
      ctx({ tenantId: TENANT_B, turn: new TurnCache() }),
    );
    expect(other.cached).toBe(false);
    expect(prisma.trackedPrompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_B }) }),
    );
  });
});

// ─── Per-turn dedupe ────────────────────────────────────────────────────────

describe("per-turn dedupe", () => {
  it("runs the same tool with the same args once per turn", async () => {
    prisma.crawlJob.findFirst.mockResolvedValue(null);
    const shared = ctx();
    await runTool("getCrawlSummary", { limit: 5 }, shared);
    await runTool("getCrawlSummary", { limit: 5 }, shared);
    expect(prisma.crawlJob.findFirst).toHaveBeenCalledTimes(1);
  });

  it("treats different arguments as different calls", async () => {
    prisma.crawlJob.findFirst.mockResolvedValue(null);
    const shared = ctx();
    await runTool("getCrawlSummary", { limit: 5 }, shared);
    await runTool("getCrawlSummary", { limit: 6 }, shared);
    expect(prisma.crawlJob.findFirst).toHaveBeenCalledTimes(2);
  });
});

// ─── The own-domain boundary ────────────────────────────────────────────────

describe("runDomainAudit only ever fetches the tenant's own domains", () => {
  it("refuses a domain the tenant does not own, without calling the sidecar", async () => {
    const result = await runTool("runDomainAudit", { domain: "attacker-site.com" }, ctx());
    expect(result.ok).toBe(false);
    expect(sidecarPost).not.toHaveBeenCalled();
    expect(String((result.value as { error: string }).error)).toContain("acme-dental.com");
  });

  it("refuses an IP literal, a private host and a reserved suffix", async () => {
    // `.example` and friends are RFC 2606 / RFC 6761 reserved and never name a
    // public site, so the guard refuses them before the tenant check is even
    // reached. Worth pinning: a fixture domain like "acme.example" would
    // otherwise make every refusal test pass for the wrong reason.
    for (const domain of [
      "169.254.169.254",
      "http://localhost/admin",
      "10.0.0.1",
      "acme.example",
      "acme.local",
    ]) {
      const result = await runTool("runDomainAudit", { domain }, ctx());
      expect(result.ok, domain).toBe(false);
    }
    expect(sidecarPost).not.toHaveBeenCalled();
  });

  it("refuses when the tenant has no domain on file", async () => {
    const result = await runTool("runDomainAudit", {}, ctx({ domains: [] }));
    expect(result.ok).toBe(false);
    expect(sidecarPost).not.toHaveBeenCalled();
  });

  it("audits the tenant's own domain, and a subdomain of it", async () => {
    sidecarPost.mockResolvedValue({
      status: 200,
      data: { url: "https://acme-dental.com", score: 61, grade: "C", checks: [], llms_txt: true },
    });
    const ok = await runTool("runDomainAudit", { domain: "www.acme-dental.com" }, ctx());
    expect(ok.ok).toBe(true);
    expect(sidecarPost).toHaveBeenCalledTimes(1);
    expect((ok.value as { score: number }).score).toBe(61);
  });

  it("reuses the SHARED public audit key, not a tenant one", async () => {
    // Deliberate: the audit is derived from the site's own public pages, so
    // two tenants auditing the same domain buy one scan between them. Nothing
    // private is in it — which is exactly why sharing is safe here and
    // nowhere else in this module.
    sidecarPost.mockResolvedValue({
      status: 200,
      data: { url: "https://acme-dental.com", score: 61, grade: "C", checks: [] },
    });
    await runTool("runDomainAudit", {}, ctx());
    const written = redis.set.mock.calls.map((call) => String(call[0]));
    const auditKey = written.find((key) => key.includes(":audit:"));
    expect(auditKey).toBeDefined();
    expect(auditKey).not.toContain(TENANT_A);
  });
});

// ─── forceRefresh is not reachable from the model ───────────────────────────

describe("the model cannot force a refresh", () => {
  it("exposes no forceRefresh argument on any tool", () => {
    for (const tool of toolDefinitions()) {
      expect(Object.keys(tool.input_schema.properties), tool.name).not.toContain(
        "forceRefresh",
      );
    }
  });

  it("rejects forceRefresh smuggled in as a tool argument", async () => {
    const result = await runTool("runDomainAudit", { forceRefresh: true }, ctx());
    expect(result.rejected).toBe("invalid_args");
    expect(sidecarPost).not.toHaveBeenCalled();
  });
});

// ─── Degrading honestly ─────────────────────────────────────────────────────

describe("empty data is reported precisely, never as a broken integration", () => {
  it("says 'not connected' when there is no GSC connection", async () => {
    prisma.gscConnection.findUnique.mockResolvedValue(null);
    const result = await runTool("getGscQueryStats", {}, ctx());
    const value = result.value as { connected: boolean; note: string };
    expect(value.connected).toBe(false);
    expect(value.note).not.toMatch(/broken|error|failed/i);
  });

  it("says 'connected, no rows yet' and names the anonymity threshold", async () => {
    prisma.gscConnection.findUnique.mockResolvedValue({
      status: "ACTIVE",
      siteUrl: "sc-domain:acme-dental.com",
      lastSyncAt: new Date("2026-08-15T02:00:00Z"),
      lastRowsSynced: 0,
    });
    prisma.gscQueryStat.groupBy.mockResolvedValue([]);
    const result = await runTool("getGscQueryStats", {}, ctx());
    const value = result.value as { connected: boolean; queries: unknown[]; note: string };
    expect(value.connected).toBe(true);
    expect(value.queries).toEqual([]);
    expect(value.note).toMatch(/anonymity threshold/i);
    expect(value.note).toMatch(/does not mean the sync is broken/i);
  });

  it("aggregates only the page-level sentinel row so numbers are not doubled", async () => {
    prisma.gscConnection.findUnique.mockResolvedValue({
      status: "ACTIVE",
      siteUrl: "sc-domain:acme-dental.com",
      lastSyncAt: new Date(),
      lastRowsSynced: 10,
    });
    prisma.gscQueryStat.groupBy.mockResolvedValue([]);
    await runTool("getGscQueryStats", {}, ctx());
    expect(prisma.gscQueryStat.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ page: "" }) }),
    );
  });

  it("keeps a null rank position meaning 'not in the top 100'", async () => {
    prisma.rankProject.findMany.mockResolvedValue([
      {
        name: "Main",
        domain: "acme-dental.com",
        device: "desktop",
        frequency: "weekly",
        lastRunAt: new Date(),
        overCap: false,
        keywords: [
          {
            keyword: "dentist near me",
            snapshots: [{ runDate: new Date(), position: null, url: null }],
          },
        ],
      },
    ]);
    const result = await runTool("getRankTracking", {}, ctx());
    const project = (result.value as { projects: { keywords: { position: number | null; positionMeaning?: string }[] }[] })
      .projects[0];
    // Never 0, never "missing" — null is the answer and it has a meaning.
    expect(project.keywords[0].position).toBeNull();
    expect(project.keywords[0].positionMeaning).toBe("not in the top 100");
  });
});

// ─── Tool inventory ─────────────────────────────────────────────────────────

describe("the tool list", () => {
  it("is stable in order, because the prompt cache prefix depends on it", () => {
    expect(toolDefinitions().map((tool) => tool.name)).toEqual([...TOOL_NAMES]);
  });

  it("gives every tool a description long enough to route on", () => {
    // An under-described tool is the most common cause of a model calling the
    // wrong one, and it is invisible until someone reads a bad transcript.
    for (const tool of toolDefinitions()) {
      expect(tool.description.length, tool.name).toBeGreaterThan(60);
    }
  });
});
