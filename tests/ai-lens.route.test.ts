// AI Lens routes — auth, tenant isolation, the own-domain rule per plan, the
// 24 h cache, the monthly cap, and the guarantee that nothing that failed to
// render is charged for.
//
// Prisma, the session guard, Redis and the sidecar HTTP boundary are stubbed;
// everything else (zod, URL normalization, registrable-domain matching, cache
// window, cap arithmetic, DTO shaping, error mapping) is the real code path. No
// browser is ever launched and no socket is ever opened.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaidPlanRequiredError } from "@/lib/paid-plan";
import type { PlanType } from "@/generated/prisma";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const aiLensAnalysis = {
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
};
const tenant = { findUnique: vi.fn() };
const visibilityAudit = { findMany: vi.fn() };
const visibilityMonitor = { findMany: vi.fn() };
vi.mock("@/lib/prisma", () => ({
  prisma: { aiLensAnalysis, tenant, visibilityAudit, visibilityMonitor },
}));

const sidecarPost = vi.fn();
vi.mock("@/lib/av-sidecar", () => ({ sidecarPost: (...a: unknown[]) => sidecarPost(...a) }));

const rateLimit = vi.fn(async (..._a: unknown[]) => ({ success: true, remaining: 2 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a) }));

const redisStore = new Map<string, number>();
const redis = {
  incr: vi.fn(async (key: string) => {
    const next = (redisStore.get(key) ?? 0) + 1;
    redisStore.set(key, next);
    return next;
  }),
  decr: vi.fn(async (key: string) => {
    const next = (redisStore.get(key) ?? 0) - 1;
    redisStore.set(key, next);
    return next;
  }),
  expire: vi.fn(async () => 1),
  get: vi.fn(async (key: string) => {
    const v = redisStore.get(key);
    return v === undefined ? null : String(v);
  }),
  set: vi.fn(async () => "OK"),
};
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => redis }));

// ─── Imports under test (after the mocks) ───────────────────────────────────

const { POST: analyze } = await import("@/app/api/seo/v1/ai-lens/analyze/route");
const { GET: history } = await import("@/app/api/seo/v1/ai-lens/history/route");
const { GET: getOne } = await import("@/app/api/seo/v1/ai-lens/[id]/route");
const { normalizeLensUrl, registrableDomain, InvalidUrlError } = await import(
  "@/lib/ai-lens/url"
);
const { aiLensVerdict, AI_LENS_ANALYSES_PER_MONTH } = await import("@/lib/ai-lens/options");

// ─── Helpers ────────────────────────────────────────────────────────────────

const TENANT = "tenant_a";
const OTHER_TENANT = "tenant_b";

function membership(plan: PlanType = "GROWTH", tenantId = TENANT) {
  return { tenantId, tenant: { planType: plan } };
}

function post(url: unknown) {
  return new Request("http://localhost/api/seo/v1/ai-lens/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

/** A sidecar response for a page with a real gap. */
function sidecarResult(overrides: Record<string, unknown> = {}) {
  return {
    status: 200,
    data: {
      url: "https://echorank360.com/",
      gap_percent: 32.4,
      raw_word_count: 400,
      rendered_word_count: 600,
      missing_word_count: 200,
      raw_block_count: 10,
      rendered_block_count: 18,
      missing_block_count: 8,
      missing_blocks: [
        { text_excerpt: "Customer stories", approx_location: "Stories", word_count: 120 },
      ],
      missing_blocks_truncated: 0,
      raw_markdown: "# a",
      rendered_markdown: "# a\n\nmore",
      meta: {
        raw_status: 200,
        rendered_status: 200,
        raw_ms: 180,
        rendered_ms: 16100,
        final_url: "https://echorank360.com/",
        redirects: [],
        user_agent: "GPTBot/1.1",
        raw_flags: { meta_robots: [], x_robots_tag: "", noindex: false },
        rendered_flags: { meta_robots: [], x_robots_tag: "", noindex: false },
      },
      ...overrides,
    },
  };
}

function storedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "lens_1",
    tenantId: TENANT,
    url: "https://echorank360.com/",
    gapPercent: 32.4,
    rawWordCount: 400,
    renderedWordCount: 600,
    missingBlocks: [
      { text_excerpt: "Customer stories", approx_location: "Stories", word_count: 120 },
    ],
    meta: {
      raw_status: 200,
      rendered_status: 200,
      missing_block_count: 8,
      missing_word_count: 200,
      redirects: [],
    },
    createdAt: new Date("2026-07-29T12:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  redisStore.clear();
  requirePaidPlan.mockResolvedValue(membership());
  rateLimit.mockResolvedValue({ success: true, remaining: 2 });
  aiLensAnalysis.findFirst.mockResolvedValue(null);
  aiLensAnalysis.findMany.mockResolvedValue([]);
  aiLensAnalysis.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
    storedRow({ ...data, id: "lens_new", createdAt: new Date() }),
  );
  // Tenant owns echorank360.com via a previous audit.
  tenant.findUnique.mockResolvedValue({ auditDomain: "echorank360.com" });
  visibilityAudit.findMany.mockResolvedValue([{ url: "https://echorank360.com/" }]);
  visibilityMonitor.findMany.mockResolvedValue([]);
  sidecarPost.mockResolvedValue(sidecarResult());
});

// ─── Auth ───────────────────────────────────────────────────────────────────

describe("auth", () => {
  it("analyze returns 403 without an ACTIVE paid plan", async () => {
    requirePaidPlan.mockRejectedValue(new PaidPlanRequiredError("TRIALING"));
    const res = await analyze(post("https://echorank360.com/"));
    expect(res.status).toBe(403);
    expect(sidecarPost).not.toHaveBeenCalled();
  });

  it("analyze returns 401 when there is no session", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated or no tenant access"));
    const res = await analyze(post("https://echorank360.com/"));
    expect(res.status).toBe(401);
  });

  it("history returns 403 without an ACTIVE paid plan", async () => {
    requirePaidPlan.mockRejectedValue(new PaidPlanRequiredError("TRIALING"));
    expect((await history()).status).toBe(403);
  });

  it("never renders before the plan guard has run", async () => {
    requirePaidPlan.mockRejectedValue(new PaidPlanRequiredError("TRIALING"));
    await analyze(post("https://echorank360.com/"));
    expect(redis.incr).not.toHaveBeenCalled();
    expect(sidecarPost).not.toHaveBeenCalled();
  });
});

// ─── Tenant isolation ───────────────────────────────────────────────────────

describe("tenant isolation", () => {
  it("history scopes the query to the caller's tenant", async () => {
    await history();
    expect(aiLensAnalysis.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT } }),
    );
  });

  it("[id] scopes by BOTH id and tenantId, never id alone", async () => {
    aiLensAnalysis.findFirst.mockResolvedValue(storedRow());
    await getOne(new Request("http://localhost/x"), { params: Promise.resolve({ id: "lens_1" }) });
    expect(aiLensAnalysis.findFirst).toHaveBeenCalledWith({
      where: { id: "lens_1", tenantId: TENANT },
    });
  });

  it("[id] 404s another tenant's analysis rather than leaking it", async () => {
    // The scoped where clause returns nothing for a foreign id.
    aiLensAnalysis.findFirst.mockResolvedValue(null);
    const res = await getOne(new Request("http://localhost/x"), {
      params: Promise.resolve({ id: "lens_owned_by_b" }),
    });
    expect(res.status).toBe(404);
  });

  it("the cache lookup is scoped to the caller's tenant", async () => {
    await analyze(post("https://echorank360.com/"));
    expect(aiLensAnalysis.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT }),
      }),
    );
  });

  it("stores the row against the caller's tenant", async () => {
    await analyze(post("https://echorank360.com/"));
    expect(aiLensAnalysis.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: TENANT }) }),
    );
  });

  it("a second tenant's quota key is separate", async () => {
    await analyze(post("https://echorank360.com/"));
    requirePaidPlan.mockResolvedValue(membership("GROWTH", OTHER_TENANT));
    await analyze(post("https://echorank360.com/"));
    const keys = [...redisStore.keys()];
    expect(keys.some((k) => k.includes(TENANT))).toBe(true);
    expect(keys.some((k) => k.includes(OTHER_TENANT))).toBe(true);
    expect(redisStore.get(keys.find((k) => k.includes(TENANT))!)).toBe(1);
  });
});

// ─── URL validation ─────────────────────────────────────────────────────────

describe("url handling", () => {
  it("adds https to a bare host", () => {
    expect(normalizeLensUrl("echorank360.com")).toBe("https://echorank360.com/");
  });

  it("drops the fragment but keeps the query", () => {
    expect(normalizeLensUrl("https://x.example/a?b=1#frag")).toBe("https://x.example/a?b=1");
  });

  it("lowercases the host but not the path", () => {
    expect(normalizeLensUrl("https://ECHORANK360.com/Pricing")).toBe(
      "https://echorank360.com/Pricing",
    );
  });

  it.each(["", "   ", "not a url", "https://nodot", "javascript:alert(1)", "ftp://x.example/"])(
    "rejects %j",
    (bad) => {
      expect(() => normalizeLensUrl(bad)).toThrow(InvalidUrlError);
    },
  );

  it("analyze returns 400 for an unparseable URL", async () => {
    const res = await analyze(post("not a url"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_REQUEST");
    expect(sidecarPost).not.toHaveBeenCalled();
  });

  it("analyze returns 400 for a missing body", async () => {
    const res = await analyze(
      new Request("http://localhost/x", { method: "POST", body: "{}" }),
    );
    expect(res.status).toBe(400);
  });

  it.each([
    ["www.echorank360.com", "echorank360.com"],
    ["deep.sub.echorank360.com", "echorank360.com"],
    ["https://shop.example.co.uk/a", "example.co.uk"],
  ])("registrableDomain(%s) === %s", (input, expected) => {
    expect(registrableDomain(input)).toBe(expected);
  });
});

// ─── Own-domain rule per plan ───────────────────────────────────────────────

describe("own-domain enforcement", () => {
  it("allows the tenant's own audited domain on GROWTH", async () => {
    const res = await analyze(post("https://echorank360.com/pricing"));
    expect(res.status).toBe(200);
  });

  it("allows a subdomain of an audited domain", async () => {
    const res = await analyze(post("https://blog.echorank360.com/post"));
    expect(res.status).toBe(200);
  });

  it.each<PlanType>(["AI_VISIBILITY", "STARTER", "GROWTH"])(
    "blocks a foreign domain on %s",
    async (plan) => {
      requirePaidPlan.mockResolvedValue(membership(plan));
      const res = await analyze(post("https://competitor.example/pricing"));
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe("FOREIGN_DOMAIN");
      expect(sidecarPost).not.toHaveBeenCalled();
    },
  );

  it.each<PlanType>(["AGENCY", "ENTERPRISE"])("allows a foreign domain on %s", async (plan) => {
    requirePaidPlan.mockResolvedValue(membership(plan));
    const res = await analyze(post("https://competitor.example/pricing"));
    expect(res.status).toBe(200);
    expect(sidecarPost).toHaveBeenCalled();
  });

  it("does not spend an analysis on a rejected foreign domain", async () => {
    const res = await analyze(post("https://competitor.example/"));
    expect(res.status).toBe(403);
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it("a near-miss suffix is not the tenant's domain", async () => {
    const res = await analyze(post("https://echorank360.com.evil.example/"));
    expect(res.status).toBe(403);
  });

  it("tells a tenant with no audited domain what to do", async () => {
    tenant.findUnique.mockResolvedValue({ auditDomain: null });
    visibilityAudit.findMany.mockResolvedValue([]);
    const res = await analyze(post("https://echorank360.com/"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/audit/i);
  });

  it("accepts a domain known only from a monitor", async () => {
    tenant.findUnique.mockResolvedValue({ auditDomain: null });
    visibilityAudit.findMany.mockResolvedValue([]);
    visibilityMonitor.findMany.mockResolvedValue([{ url: "https://monitored.example/" }]);
    const res = await analyze(post("https://monitored.example/page"));
    expect(res.status).toBe(200);
  });
});

// ─── Cache ──────────────────────────────────────────────────────────────────

describe("24h cache", () => {
  it("returns the stored row without rendering", async () => {
    aiLensAnalysis.findFirst.mockResolvedValue(storedRow());
    const res = await analyze(post("https://echorank360.com/"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(sidecarPost).not.toHaveBeenCalled();
  });

  it("a cache hit does not consume an analysis", async () => {
    aiLensAnalysis.findFirst.mockResolvedValue(storedRow());
    await analyze(post("https://echorank360.com/"));
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it("looks back exactly the cache window", async () => {
    await analyze(post("https://echorank360.com/"));
    const where = aiLensAnalysis.findFirst.mock.calls[0][0].where;
    const gte = where.createdAt.gte as Date;
    const windowMs = Date.now() - gte.getTime();
    expect(windowMs).toBeGreaterThan(23.9 * 60 * 60 * 1000);
    expect(windowMs).toBeLessThan(24.1 * 60 * 60 * 1000);
  });

  it("keys the cache on the normalized url, so a fragment is not a miss", async () => {
    await analyze(post("https://echorank360.com/#pricing"));
    expect(aiLensAnalysis.findFirst.mock.calls[0][0].where.url).toBe("https://echorank360.com/");
  });
});

// ─── Monthly cap ────────────────────────────────────────────────────────────

describe("monthly cap", () => {
  it("counts one per analysis and reports usage", async () => {
    const res = await analyze(post("https://echorank360.com/"));
    const body = await res.json();
    expect(body.usage.used).toBe(1);
    expect(body.usage.limit).toBe(AI_LENS_ANALYSES_PER_MONTH.GROWTH);
  });

  it("429s past the plan limit", async () => {
    const limit = AI_LENS_ANALYSES_PER_MONTH.GROWTH;
    for (let i = 0; i < limit; i++) {
      const res = await analyze(post(`https://echorank360.com/p${i}`));
      expect(res.status).toBe(200);
    }
    const res = await analyze(post("https://echorank360.com/over"));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe("QUOTA_EXCEEDED");
    expect(body.limit).toBe(limit);
  });

  it("a rejected attempt does not permanently consume a slot", async () => {
    const limit = AI_LENS_ANALYSES_PER_MONTH.GROWTH;
    for (let i = 0; i < limit; i++) await analyze(post(`https://echorank360.com/p${i}`));
    const before = [...redisStore.values()][0];
    await analyze(post("https://echorank360.com/over"));
    expect([...redisStore.values()][0]).toBe(before);
  });

  it.each<[PlanType, number]>([
    ["STARTER", 10],
    ["GROWTH", 50],
    ["AGENCY", 200],
  ])("%s allowance is %i", (plan, expected) => {
    expect(AI_LENS_ANALYSES_PER_MONTH[plan]).toBe(expected);
  });

  it("fails closed when Redis is unreachable", async () => {
    redis.incr.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const res = await analyze(post("https://echorank360.com/"));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("QUOTA_UNAVAILABLE");
    expect(sidecarPost).not.toHaveBeenCalled();
  });
});

// ─── Nothing that failed to render is charged for ───────────────────────────

describe("refunds", () => {
  it("releases the slot when the sidecar errors", async () => {
    sidecarPost.mockResolvedValue({ status: 502, data: { error: "Could not render the page" } });
    const res = await analyze(post("https://echorank360.com/"));
    expect(res.status).toBe(502);
    expect(redis.decr).toHaveBeenCalled();
    expect([...redisStore.values()][0]).toBe(0);
  });

  it("maps a busy sidecar to 429 and refunds", async () => {
    sidecarPost.mockResolvedValue({ status: 429, data: { error: "All render slots are busy." } });
    const res = await analyze(post("https://echorank360.com/"));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("RENDER_BUSY");
    expect([...redisStore.values()][0]).toBe(0);
  });

  it("surfaces the sidecar's own message to the user", async () => {
    sidecarPost.mockResolvedValue({
      status: 400,
      data: { error: "That URL redirects to a different domain, which this tool will not follow." },
    });
    const res = await analyze(post("https://echorank360.com/"));
    expect((await res.json()).error).toMatch(/different domain/);
  });

  it("treats a malformed sidecar payload as a failure, not a zero gap", async () => {
    sidecarPost.mockResolvedValue({ status: 200, data: { nonsense: true } });
    const res = await analyze(post("https://echorank360.com/"));
    expect(res.status).toBe(502);
    expect(aiLensAnalysis.create).not.toHaveBeenCalled();
  });

  it("does not render when the per-minute rate limit trips", async () => {
    rateLimit.mockResolvedValue({ success: false, remaining: 0 });
    const res = await analyze(post("https://echorank360.com/"));
    expect(res.status).toBe(429);
    expect(sidecarPost).not.toHaveBeenCalled();
    expect(redis.incr).not.toHaveBeenCalled();
  });
});

// ─── Persistence + DTO ──────────────────────────────────────────────────────

describe("persistence", () => {
  it("does not store the markdown documents", async () => {
    await analyze(post("https://echorank360.com/"));
    const data = aiLensAnalysis.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("rawMarkdown");
    expect(JSON.stringify(data)).not.toContain("rendered_markdown");
  });

  it("stores the gap, both word counts and the missing blocks", async () => {
    await analyze(post("https://echorank360.com/"));
    const data = aiLensAnalysis.create.mock.calls[0][0].data;
    expect(data.gapPercent).toBe(32.4);
    expect(data.rawWordCount).toBe(400);
    expect(data.renderedWordCount).toBe(600);
    expect(data.missingBlocks).toHaveLength(1);
  });

  it("stores the sidecar's missing word count, not a subtraction", async () => {
    // rendered - raw would be 200 here too, so the test pins the SOURCE: a page
    // whose raw fetch carries extra content breaks the subtraction, not this.
    sidecarPost.mockResolvedValue(
      sidecarResult({ raw_word_count: 700, rendered_word_count: 600, missing_word_count: 150 }),
    );
    const res = await analyze(post("https://echorank360.com/"));
    const meta = aiLensAnalysis.create.mock.calls[0][0].data.meta as Record<string, unknown>;
    expect(meta.missing_word_count).toBe(150);
    expect((await res.json()).analysis.missingWordCount).toBe(150);
  });

  it("returns a verdict derived from the gap, not from the sidecar", async () => {
    const res = await analyze(post("https://echorank360.com/"));
    expect((await res.json()).analysis.verdict).toBe("substantial");
  });

  it("converts the Decimal gap to a number for the client", async () => {
    aiLensAnalysis.findFirst.mockResolvedValue(storedRow({ gapPercent: "7.5" }));
    const res = await analyze(post("https://echorank360.com/"));
    const body = await res.json();
    expect(typeof body.analysis.gapPercent).toBe("number");
    expect(body.analysis.gapPercent).toBe(7.5);
    expect(body.analysis.verdict).toBe("partial");
  });
});

// ─── Verdict bands ──────────────────────────────────────────────────────────

describe("verdict bands", () => {
  it.each<[number, string]>([
    [0, "readable"],
    [4.9, "readable"],
    [5, "partial"],
    [24.9, "partial"],
    [25, "substantial"],
    [100, "substantial"],
  ])("%s%% -> %s", (gap, expected) => {
    expect(aiLensVerdict(gap)).toBe(expected);
  });
});

// ─── History shape ──────────────────────────────────────────────────────────

describe("history", () => {
  it("returns summary rows with a verdict and usage", async () => {
    aiLensAnalysis.findMany.mockResolvedValue([
      {
        id: "lens_1",
        url: "https://echorank360.com/",
        gapPercent: "0",
        renderedWordCount: 1585,
        meta: { missing_block_count: 0 },
        createdAt: new Date("2026-07-29T12:00:00Z"),
      },
    ]);
    const body = await (await history()).json();
    expect(body.analyses[0]).toMatchObject({
      id: "lens_1",
      gapPercent: 0,
      verdict: "readable",
      missingBlockCount: 0,
    });
    expect(body.usage.limit).toBe(AI_LENS_ANALYSES_PER_MONTH.GROWTH);
    expect(body.usage.crossDomain).toBe(false);
  });

  it("does not ship missingBlocks on the history list", async () => {
    await history();
    const select = aiLensAnalysis.findMany.mock.calls[0][0].select;
    expect(select.missingBlocks).toBeUndefined();
  });

  it("reports crossDomain true on AGENCY", async () => {
    requirePaidPlan.mockResolvedValue(membership("AGENCY"));
    const body = await (await history()).json();
    expect(body.usage.crossDomain).toBe(true);
  });
});
