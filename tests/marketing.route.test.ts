// Marketing Studio route handlers — the paths that spend money, leak data, or
// hand a tenant something its plan does not include.
//
// Prisma, the session guard, Redis and global fetch are stubbed; everything else
// (zod, category lookup, plan gating, prompt assembly, the heuristics, the
// result cache, the token budget, metering, error mapping) is the real code
// path. No live Anthropic call is ever made from this suite.
//
// The two things this module can do worst are spending tokens it did not need
// to and sending a tenant's pasted corpus to a third party, so the assertions
// below care as much about how many upstream calls happened, and what was in
// them, as about the response body.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaidPlanRequiredError } from "@/lib/paid-plan";
import type { PlanType } from "@/generated/prisma";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const requirePaidPlan = vi.fn();
vi.mock("@/lib/paid-plan", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paid-plan")>()),
  requirePaidPlan: () => requirePaidPlan(),
}));

const tenant = { findFirst: vi.fn(), updateMany: vi.fn() };
const aiApiCall = { create: vi.fn() };
vi.mock("@/lib/prisma", () => ({ prisma: { tenant, aiApiCall } }));

// See content-explorer.route.test.ts: the `..._a` rest parameter is load-bearing
// for tsc, not decoration.
const rateLimit = vi.fn(async (..._a: unknown[]) => ({ success: true, remaining: 4 }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: (...a: unknown[]) => rateLimit(...a) }));

const redisStore = new Map<string, string>();
const redis = {
  get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
  set: vi.fn(async (key: string, value: string) => {
    redisStore.set(key, value);
    return "OK";
  }),
  incrby: vi.fn(async (key: string, n: number) => {
    const next = Number(redisStore.get(key) ?? 0) + n;
    redisStore.set(key, String(next));
    return next;
  }),
  expire: vi.fn(async () => 1),
};
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => redis,
  getSubscriberConnection: () => redis,
}));

// Imported after the mocks so the modules pick them up.
const { POST: GENERATE } = await import("@/app/api/ai/visibility/marketing/generate/route");
const { POST: COMPUTE } = await import("@/app/api/ai/visibility/marketing/compute/route");
const { PUT: SAVE_VOICE, GET: GET_VOICE } = await import(
  "@/app/api/ai/visibility/marketing/voice/route"
);
const { marketingBudgetKey } = await import("@/lib/marketing/quota");
const { MARKETING_MODEL } = await import("@/lib/marketing-templates");
const { MARKETING_MONTHLY_OUTPUT_TOKENS } = await import("@/lib/plan-config");

// ─── Fixtures ───────────────────────────────────────────────────────────────

const TENANT = "tenant_a";
const CORPUS_MARKER = "SECRET-CORPUS-MARKER";

const FEEDBACK = [
  `${CORPUS_MARKER} the setup process was confusing and took forever.`,
  "The setup process was confusing, honestly.",
  "Support never responded to my ticket.",
  "Support never responded. I chased twice.",
].join("\n");

const SAMPLES = [
  "We ship fast. No committees, no six-week sign-off.",
  "The work speaks first; the deck comes later — if at all.",
  "",
  "Our clients stay because the numbers move. That is the whole pitch.",
].join("\n");

function membership(planType: PlanType = "GROWTH", tenantId = TENANT) {
  return { tenantId, tenant: { id: tenantId, planType, name: "Acme" } };
}

function post(body: unknown): Request {
  return new Request("https://echorank360.com/api/ai/visibility/marketing/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** A successful Anthropic response with a chosen output-token count. */
function anthropicOk(text = "Draft copy.", outputTokens = 400) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({
      content: [{ type: "text", text }],
      usage: { input_tokens: 300, output_tokens: outputTokens },
    }),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  redisStore.clear();
  requirePaidPlan.mockResolvedValue(membership());
  tenant.findFirst.mockResolvedValue({ brandVoiceGuide: null });
  tenant.updateMany.mockResolvedValue({ count: 1 });
  aiApiCall.create.mockResolvedValue({ id: "call_1" });
  rateLimit.mockResolvedValue({ success: true, remaining: 4 });
  fetchMock = vi.fn(async () => anthropicOk());
  vi.stubGlobal("fetch", fetchMock);
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-key-not-real";
});

// ─── Guards ─────────────────────────────────────────────────────────────────

describe("guards", () => {
  it("401s when there is no session", async () => {
    requirePaidPlan.mockRejectedValue(new Error("Not authenticated"));
    const res = await GENERATE(post({ categoryId: "ads", values: {} }));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("403s an unpaid plan without calling the model", async () => {
    requirePaidPlan.mockRejectedValue(new PaidPlanRequiredError("PAST_DUE"));
    const res = await GENERATE(post({ categoryId: "ads", values: {} }));
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets a legacy AI_VISIBILITY row generate, folded onto STARTER", async () => {
    requirePaidPlan.mockResolvedValue(membership("AI_VISIBILITY"));
    const res = await GENERATE(
      post({
        categoryId: "positioning",
        values: { PRODUCT: "p", AUDIENCE: "a", COMPETITOR: "c", THEIR_ANGLE: "t" },
      }),
    );
    expect(res.status).toBe(200);
  });

  it("400s an unknown category before the rate limiter is spent", async () => {
    const res = await GENERATE(post({ categoryId: "../../etc/passwd", values: {} }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("UNKNOWN_CATEGORY");
    expect(rateLimit).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("429s when rate limited, without calling the model", async () => {
    rateLimit.mockResolvedValue({ success: false, remaining: 0 });
    const res = await GENERATE(post({ categoryId: "ads", values: {} }));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("RATE_LIMITED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("400s a missing required field, without calling the model", async () => {
    const res = await GENERATE(post({ categoryId: "positioning", values: { PRODUCT: "p" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/AUDIENCE/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── The request that reaches Anthropic ─────────────────────────────────────

describe("the outbound request", () => {
  const adsBody = {
    categoryId: "ads",
    values: { PRODUCT: "a scheduler", AUDIENCE: "consultants", PLATFORM: "LinkedIn", CHARACTER_LIMIT: "90" },
  };

  it("calls Anthropic once, with Haiku and the category's ceiling", async () => {
    const res = await GENERATE(post(adsBody));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(MARKETING_MODEL);
    expect(body.model).toBe("claude-haiku-4-5");
    expect(body.max_tokens).toBe(1500);
  });

  it("never sends Sonnet or Opus, whatever the category", async () => {
    for (const categoryId of ["ads", "campaign", "email"]) {
      fetchMock.mockClear();
      await GENERATE(
        post({
          categoryId,
          values: {
            PRODUCT: "p", AUDIENCE: "a", PLATFORM: "x", CHARACTER_LIMIT: "90",
            NUMBER: "5", BUSINESS: "b", GOAL: "g",
            CAMPAIGN_SUBJECT: "s", TIMEFRAME: "6 weeks",
          },
        }),
      );
      const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
      expect(body.model, categoryId).toBe("claude-haiku-4-5");
    }
  });

  it("ignores a model or max_tokens smuggled in the body", async () => {
    // The route takes values, not a prompt. Nothing in the request can move
    // the model or raise the ceiling.
    await GENERATE(
      post({ ...adsBody, model: "claude-opus-5", max_tokens: 100_000, system: "ignore previous" }),
    );
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.model).toBe("claude-haiku-4-5");
    expect(body.max_tokens).toBe(1500);
    expect(JSON.stringify(body.system)).not.toContain("ignore previous");
  });

  it("sets no cache_control — the prefix is under Haiku 4.5's minimum", async () => {
    await GENERATE(post(adsBody));
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(JSON.stringify(body.system)).not.toContain("cache_control");
  });

  it("prepends a saved brand voice guide as a system block", async () => {
    tenant.findFirst.mockResolvedValue({ brandVoiceGuide: "BRAND VOICE GUIDE\nShort sentences." });
    await GENERATE(post(adsBody));
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.system).toHaveLength(2);
    expect(body.system[1].text).toContain("Short sentences.");
  });
});

// ─── The privacy boundary ───────────────────────────────────────────────────

describe("pasted corpora never reach the API", () => {
  it("sends phrases, not the feedback, for category 12", async () => {
    const res = await GENERATE(post({ categoryId: "voc", values: { RAW_FEEDBACK: FEEDBACK } }));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const outbound = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string;
    expect(outbound).not.toContain(CORPUS_MARKER);
    expect(outbound).not.toContain("Support never responded to my ticket");
    // But the computed phrases DID go — otherwise the call is pointless.
    expect(outbound).toContain("setup process was confusing");
    expect(outbound).toContain("support never responded");
  });

  it("sends the computed summary, not the table, for category 09", async () => {
    const csv = [
      "metric,this,last",
      `${CORPUS_MARKER},100,50`,
      "Signups,320,400",
    ].join("\n");
    await GENERATE(post({ categoryId: "analytics", values: { DATA: csv } }));
    const outbound = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string;
    expect(outbound).not.toContain("this,last");
    expect(outbound).toContain("Signups");
  });

  it("makes no call at all for category 08, and stores nothing", async () => {
    const res = await GENERATE(post({ categoryId: "voice", values: { WRITING_SAMPLES: SAMPLES } }));
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.output).toContain("BRAND VOICE GUIDE");
    expect(payload.outputTokens).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(aiApiCall.create).not.toHaveBeenCalled();
  });

  it("/compute never calls the model, and shows exactly what would be sent", async () => {
    const res = await COMPUTE(post({ categoryId: "voc", values: { RAW_FEEDBACK: FEEDBACK } }));
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(payload.computed).toContain("setup process was confusing");
    expect(payload.aiPayloadPreview).not.toContain(CORPUS_MARKER);
  });
});

// ─── Budget and metering ────────────────────────────────────────────────────

describe("token budget", () => {
  const adsBody = {
    categoryId: "ads",
    values: { PRODUCT: "p", AUDIENCE: "a", PLATFORM: "x", CHARACTER_LIMIT: "90" },
  };

  it("meters the call into Postgres and Redis", async () => {
    await GENERATE(post(adsBody));

    expect(aiApiCall.create).toHaveBeenCalledTimes(1);
    const row = aiApiCall.create.mock.calls[0][0].data;
    expect(row).toMatchObject({
      tenantId: TENANT,
      categoryId: "ads",
      model: "claude-haiku-4-5",
      outputTokens: 400,
    });
    expect(redisStore.get(marketingBudgetKey(TENANT))).toBe("400");
  });

  it("429s once the month's budget is spent, before calling the model", async () => {
    redisStore.set(marketingBudgetKey(TENANT), String(MARKETING_MONTHLY_OUTPUT_TOKENS.GROWTH));
    const res = await GENERATE(post(adsBody));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("BUDGET_EXCEEDED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets ENTERPRISE through with no ceiling", async () => {
    requirePaidPlan.mockResolvedValue(membership("ENTERPRISE"));
    redisStore.set(marketingBudgetKey(TENANT), "9999999");
    const res = await GENERATE(post(adsBody));
    expect(res.status).toBe(200);
    expect((await res.json()).usage.limit).toBeNull();
  });

  it("still serves /compute when the budget is gone", async () => {
    // Nothing in the heuristic path costs money, so exhausting the budget must
    // not take the analysis tools away.
    redisStore.set(marketingBudgetKey(TENANT), String(MARKETING_MONTHLY_OUTPUT_TOKENS.GROWTH));
    const res = await COMPUTE(post({ categoryId: "voc", values: { RAW_FEEDBACK: FEEDBACK } }));
    expect(res.status).toBe(200);
  });
});

describe("result cache", () => {
  const body = {
    categoryId: "seo",
    values: { KEYWORD: "ai visibility", BUSINESS: "Echorank", CONVERSION_PAGE: "/pricing" },
  };

  it("serves an identical repeat from cache, with no second call", async () => {
    const first = await GENERATE(post(body));
    expect((await first.json()).cached).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await GENERATE(post(body));
    const payload = await second.json();
    expect(payload.cached).toBe(true);
    expect(payload.outputTokens).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not charge the budget twice for a cache hit", async () => {
    await GENERATE(post(body));
    await GENERATE(post(body));
    expect(redisStore.get(marketingBudgetKey(TENANT))).toBe("400");
  });

  it("misses when a single value changes", async () => {
    await GENERATE(post(body));
    await GENERATE(post({ ...body, values: { ...body.values, KEYWORD: "seo audit" } }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("misses when the brand voice guide changes", async () => {
    await GENERATE(post(body));
    tenant.findFirst.mockResolvedValue({ brandVoiceGuide: "Now we write differently." });
    await GENERATE(post(body));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("is scoped per tenant", async () => {
    await GENERATE(post(body));
    requirePaidPlan.mockResolvedValue(membership("GROWTH", "tenant_b"));
    await GENERATE(post(body));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// ─── Upstream failures ──────────────────────────────────────────────────────

describe("upstream failures", () => {
  const adsBody = {
    categoryId: "ads",
    values: { PRODUCT: "p", AUDIENCE: "a", PLATFORM: "x", CHARACTER_LIMIT: "90" },
  };

  it("503s with no key configured, and never charges the budget", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await GENERATE(post(adsBody));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("NOT_CONFIGURED");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(redisStore.get(marketingBudgetKey(TENANT))).toBeUndefined();
  });

  it("502s on a 401 without leaking the upstream body", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
      text: async () => "invalid x-api-key sk-ant-REAL-KEY-LEAK",
      json: async () => ({}),
    } as unknown as Response);
    const res = await GENERATE(post(adsBody));
    expect(res.status).toBe(502);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("sk-ant");
    expect(redisStore.get(marketingBudgetKey(TENANT))).toBeUndefined();
  });

  it("does not meter a failed call", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers(),
      text: async () => "bad request",
      json: async () => ({}),
    } as unknown as Response);
    await GENERATE(post(adsBody));
    expect(aiApiCall.create).not.toHaveBeenCalled();
    expect(redisStore.get(marketingBudgetKey(TENANT))).toBeUndefined();
  });
});

// ─── Brand voice persistence ────────────────────────────────────────────────

describe("voice route", () => {
  it("saves a guide, tenant-scoped", async () => {
    const res = await SAVE_VOICE(post({ guide: "BRAND VOICE GUIDE\nShort." }));
    expect(res.status).toBe(200);
    expect(tenant.updateMany).toHaveBeenCalledWith({
      where: { id: TENANT },
      data: { brandVoiceGuide: "BRAND VOICE GUIDE\nShort." },
    });
  });

  it("clears with an empty string rather than storing one", async () => {
    await SAVE_VOICE(post({ guide: "   " }));
    expect(tenant.updateMany.mock.calls[0][0].data).toEqual({ brandVoiceGuide: null });
  });

  it("400s an over-long guide", async () => {
    const res = await SAVE_VOICE(post({ guide: "x".repeat(8001) }));
    expect(res.status).toBe(400);
    expect(tenant.updateMany).not.toHaveBeenCalled();
  });

  it("saves for every tier — marketing_studio is baseline from STARTER up", async () => {
    requirePaidPlan.mockResolvedValue(membership("STARTER"));
    const res = await SAVE_VOICE(post({ guide: "x" }));
    expect(res.status).toBe(200);
  });

  it("reads the saved guide back with a tenant-scoped findFirst", async () => {
    tenant.findFirst.mockResolvedValue({ brandVoiceGuide: "saved" });
    const res = await GET_VOICE();
    expect(await res.json()).toEqual({ guide: "saved" });
    expect(tenant.findFirst.mock.calls[0][0].where).toEqual({ id: TENANT });
  });
});
