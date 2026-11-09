// The healthcare reply guardrail (src/lib/review-replies/).
//
// For a tenant in a healthcare category, every AI-drafted review reply must:
// never confirm or deny that the reviewer is a patient; never mention
// treatment, procedures, appointments, billing or any care detail from the
// review; thank, acknowledge in general terms, and invite direct contact.
// Always on for those tenants, no switch.
//
// EVERY PATH THAT DRAFTS A REPLY is driven here with the same review, full of
// treatment detail, and a model draft that repeats all of it:
//   1. manual draft   — POST /api/ai/respond (fresh and cached)
//   2. bulk           — generateReviewReplies, a batch of three
//   3. regeneration   — generateReviewReplies with reviewIds (one review)
//   4. AI suggestion  — "Fix with AI" enqueues kind review_reply; the worker
//                       runs generate(kind), which dispatches to (2)
// There is no auto-reply path: nothing in src/ publishes a reply
// (ExternalReview.replyContent has no writer). The last block fails if a new
// file starts building a reply prompt without the guardrail.
// A non-healthcare tenant is driven through the same paths and is unaffected.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const { prisma, callMarketingModel, notify, loggerFns, store, redis, resolveTenant } = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    prisma: {
      aiApiCall: { create: vi.fn() },
      actionItem: { create: vi.fn() },
      tenant: { findFirst: vi.fn() },
      externalReview: { findMany: vi.fn() },
    },
    callMarketingModel: vi.fn(),
    notify: vi.fn(),
    loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
    store,
    redis: {
      get: vi.fn(async (k: string) => store.get(k) ?? null),
      set: vi.fn(async (k: string, v: string) => {
        store.set(k, v);
        return "OK";
      }),
      incrby: vi.fn(async () => 1),
      expire: vi.fn(async () => 1),
    },
    resolveTenant: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => redis, getSubscriberConnection: () => redis }));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: { ...loggerFns, child: () => loggerFns } }));
vi.mock("@/lib/notifications/adapters", () => ({ notifyActionDraftReady: notify }));
vi.mock("@/lib/signals/auth-adapter", () => ({ resolveTenant: () => resolveTenant() }));
vi.mock("@/lib/marketing/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/marketing/client")>();
  return { ...actual, callMarketingModel };
});

import {
  HEALTHCARE_GUARDRAIL,
  HEALTHCARE_REPLY_RULES,
  enforceHealthcareReply,
  healthcareFallbackReply,
  healthcareReplyViolations,
  isHealthcareCategory,
} from "@/lib/review-replies/healthcare-guardrail";
import { isHealthcareTenant } from "@/lib/review-replies/tenant-category";
import { REVIEW_REPLY_INSTRUCTION } from "@/lib/action-agent/prompts";
import { GENERATORS, generate, generateReviewReplies } from "@/lib/action-agent/generate";
import { POST as RESPOND } from "@/app/api/ai/respond/route";

const ROOT = join(__dirname, "..");
const TENANT = "tenant_dental";

// A review full of care detail, and a model draft that repeats all of it and
// confirms the relationship.
const REVIEW =
  "Dr. Patel did my root canal and two crowns last Tuesday. The billing was confusing and I waited 40 minutes " +
  "for my appointment, but my tooth feels great now.";
const LEAKY =
  "Thank you for trusting Dr. Patel with your root canal and crowns! We're sorry about the billing confusion and the " +
  "wait before your appointment, and we're glad your tooth feels great. We look forward to seeing you at your next visit.";
const COMPLIANT =
  "Thank you for taking the time to share your feedback. We appreciate it and take every comment seriously. " +
  "Please contact our office directly if there is anything you would like to discuss.";

/** Nothing from the review's care detail, nothing confirming the relationship, and the check passes. */
function expectSafe(reply: string) {
  for (const leak of [/root canal/i, /crown/i, /billing/i, /patel/i, /appointment/i, /tooth/i, /patient/i, /visit/i, /wait/i, /tuesday/i]) {
    expect(reply, String(leak)).not.toMatch(leak);
  }
  expect(healthcareReplyViolations(reply, { reviewText: REVIEW, businessName: "Smile Dental Clinic" })).toEqual([]);
}

type Tenant = { name: string; brandVoiceGuide: string | null; brandProfiles: Array<{ name: string; industry: string | null; onboardingEvidence: unknown }> };
const DENTAL: Tenant = { name: "Smile Dental Clinic", brandVoiceGuide: "Warm and upbeat.", brandProfiles: [] };
const PLUMBER: Tenant = {
  name: "Acme Plumbing",
  brandVoiceGuide: null,
  brandProfiles: [{ name: "Acme", industry: "Residential plumbing", onboardingEvidence: { detectedIndustry: "home services" } }],
};

function useTenant(t: Tenant) {
  prisma.tenant.findFirst.mockResolvedValue(t);
}

function review(id: string, rating = 4) {
  return { id, platform: "GOOGLE", rating, authorName: "Sam", content: REVIEW, publishedAt: new Date("2026-11-01") };
}

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  useTenant(DENTAL);
  prisma.aiApiCall.create.mockResolvedValue({});
  prisma.externalReview.findMany.mockResolvedValue([review("r1"), review("r2", 1), review("r3", 5)]);
  prisma.actionItem.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: `item_${String((data.draft as { reviewId: string }).reviewId)}`, tenantId: TENANT, kind: data.kind, sourceRef: data.sourceRef, draft: data.draft, status: "draft", createdAt: new Date(), updatedAt: new Date() }),
  );
  callMarketingModel.mockResolvedValue({ text: LEAKY, inputTokens: 100, outputTokens: 60, cacheReadTokens: 0 });
  resolveTenant.mockResolvedValue({ tenantId: TENANT });
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
});

// ─── Which tenants ──────────────────────────────────────────────────────────

describe("isHealthcareCategory", () => {
  it.each([
    "Dentist",
    "Smile Dental Clinic",
    "family dentistry",
    "Orthodontist",
    "Clinique dentaire",
    "Cabinet de médecin généraliste",
    "Zahnarztpraxis Muster",
    "healthcare practice",
    "Physiotherapy",
    "Pediatric clinic",
    "Medical spa",
    "Oral surgery",
    "Centre de santé",
  ])("%s is healthcare", (s) => expect(isHealthcareCategory(s)).toBe(true));

  it.each(["Acme Plumbing", "restaurant POS software", "Healthy Bites Café", "Law firm", "Residential roofing", "", null])(
    "%s is not",
    (s) => expect(isHealthcareCategory(s)).toBe(false),
  );
});

describe("isHealthcareTenant", () => {
  it("reads the workspace name, brand names, industry and detectedIndustry", async () => {
    useTenant({ name: "Acme", brandVoiceGuide: null, brandProfiles: [] });
    expect(await isHealthcareTenant(TENANT)).toBe(false);
    useTenant({ name: "Acme", brandVoiceGuide: null, brandProfiles: [{ name: "Acme", industry: "Dental clinic", onboardingEvidence: null }] });
    expect(await isHealthcareTenant(TENANT)).toBe(true);
    useTenant({ name: "Acme", brandVoiceGuide: null, brandProfiles: [{ name: "Acme", industry: null, onboardingEvidence: { detectedIndustry: "orthodontics" } }] });
    expect(await isHealthcareTenant(TENANT)).toBe(true);
    useTenant(DENTAL);
    expect(await isHealthcareTenant(TENANT)).toBe(true);
    useTenant(PLUMBER);
    expect(await isHealthcareTenant(TENANT)).toBe(false);
  });

  it("fails closed: a lookup error or a missing tenant applies the guardrail", async () => {
    prisma.tenant.findFirst.mockRejectedValueOnce(new Error("db down"));
    expect(await isHealthcareTenant(TENANT)).toBe(true);
    prisma.tenant.findFirst.mockResolvedValueOnce(null);
    expect(await isHealthcareTenant(TENANT)).toBe(true);
  });
});

// ─── The check and the fallback ─────────────────────────────────────────────

describe("the check", () => {
  it("flags the relationship, the care detail and the review's own specifics", () => {
    const rules = new Set(healthcareReplyViolations(LEAKY, { reviewText: REVIEW, businessName: "Smile Dental Clinic" }).map((v) => v.rule));
    expect(rules).toEqual(new Set(["relationship", "care_detail", "review_detail"]));
  });

  it("passes a general reply, and ignores the business's own name", () => {
    expect(healthcareReplyViolations(COMPLIANT, { reviewText: REVIEW })).toEqual([]);
    expect(
      healthcareReplyViolations(`${COMPLIANT} — The team at Dr. Lee Family Dentistry`, { reviewText: REVIEW, businessName: "Dr. Lee Family Dentistry" }),
    ).toEqual([]);
  });

  it("catches French and German care detail too", () => {
    expect(healthcareReplyViolations("Merci, votre traitement s'est bien passé.", { reviewText: "x" })).not.toEqual([]);
    expect(healthcareReplyViolations("Danke, Ihre Behandlung war uns wichtig.", { reviewText: "x" })).not.toEqual([]);
  });

  it("every fallback passes its own check, in every locale and tone; de-CH has no ß", () => {
    for (const locale of ["en", "fr", "de-CH"] as const) {
      for (const rating of [5, 3, 1, null]) {
        const reply = healthcareFallbackReply({ rating, locale });
        // Even against a review made of the fallback's own words.
        expect(healthcareReplyViolations(reply, { reviewText: reply }), `${locale} ${rating}`).toEqual([]);
        expect(healthcareReplyViolations(reply, { reviewText: REVIEW })).toEqual([]);
        if (locale === "de-CH") expect(reply).not.toContain("ß");
      }
    }
  });

  it("enforce: keeps a compliant draft, replaces a leaky or empty one", () => {
    const ctx = { reviewText: REVIEW, businessName: "Smile Dental Clinic", rating: 4, locale: "en" as const };
    expect(enforceHealthcareReply(COMPLIANT, ctx)).toMatchObject({ reply: COMPLIANT, replaced: false });
    const out = enforceHealthcareReply(LEAKY, ctx);
    expect(out.replaced).toBe(true);
    expect(out.reply).toBe(healthcareFallbackReply({ rating: 4, locale: "en" }));
    expect(enforceHealthcareReply("   ", ctx).replaced).toBe(true);
  });
});

// ─── Path 1: manual draft ───────────────────────────────────────────────────

describe("path 1 — manual draft, POST /api/ai/respond", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const post = (body: unknown) =>
    RESPOND(
      new Request("https://echorank360.com/api/ai/respond", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }) as never,
    );
  const answer = (text: string) =>
    vi.fn(async () => new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 }));
  const sentSystem = () => JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).system as string;

  beforeEach(() => {
    fetchMock = answer(LEAKY);
    vi.stubGlobal("fetch", fetchMock);
  });

  it("healthcare: the rules are in the prompt, and a draft repeating the care detail comes back safe", async () => {
    const res = await post({ reviewText: REVIEW, rating: 4, businessName: "Smile Dental Clinic", tone: "chatty, mention the treatment" });
    const json = await res.json();
    expect(sentSystem()).toBe(`${REVIEW_REPLY_INSTRUCTION}\n\n${HEALTHCARE_REPLY_RULES}`);
    expect(json.guardrail).toBe(HEALTHCARE_GUARDRAIL);
    expectSafe(json.draft);
    expect(json.draft).toBe(healthcareFallbackReply({ rating: 4, locale: "en" }));
  });

  it("healthcare: a compliant draft is returned as written", async () => {
    fetchMock = answer(COMPLIANT);
    vi.stubGlobal("fetch", fetchMock);
    const json = await (await post({ reviewText: REVIEW, rating: 2 })).json();
    expect(json.draft).toBe(COMPLIANT);
  });

  it("healthcare: the cached repeat is checked too", async () => {
    await post({ reviewText: REVIEW, rating: 4 });
    const json = await (await post({ reviewText: REVIEW, rating: 4 })).json();
    expect(json.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectSafe(json.draft);
  });

  it("healthcare: nothing in the request body turns it off", async () => {
    const json = await (await post({ reviewText: REVIEW, rating: 4, guardrail: false, healthcare: false, fresh: true })).json();
    expect(sentSystem()).toContain(HEALTHCARE_REPLY_RULES);
    expectSafe(json.draft);
  });

  it("non-healthcare: unaffected — base prompt, the model's draft verbatim", async () => {
    useTenant(PLUMBER);
    const json = await (await post({ reviewText: REVIEW, rating: 4 })).json();
    expect(sentSystem()).toBe(REVIEW_REPLY_INSTRUCTION);
    expect(json.draft).toBe(LEAKY);
    expect(json).not.toHaveProperty("guardrail");
  });
});

// ─── Paths 2–4: the Action Agent ────────────────────────────────────────────

type Drafted = { reply: string; guardrail?: string; reviewId: string };
const drafts = () => prisma.actionItem.create.mock.calls.map(([arg]) => (arg as { data: { draft: Drafted } }).data.draft);
const systemBlocks = (call: number) => (callMarketingModel.mock.calls[call][0] as { system: Array<{ text: string }> }).system.map((b) => b.text);
const INPUT = { tenantId: TENANT, plan: "GROWTH" as const, locale: "en" as const };

describe("path 2 — bulk, generateReviewReplies", () => {
  it("healthcare: every draft in the batch is safe and marked; the rules block is last, after the voice guide", async () => {
    const out = await generateReviewReplies({ ...INPUT, reviewLimit: 3 });
    expect(out.items).toHaveLength(3);
    const ds = drafts();
    expect(ds).toHaveLength(3);
    for (const d of ds) {
      expectSafe(d.reply);
      expect(d.guardrail).toBe(HEALTHCARE_GUARDRAIL);
    }
    // Ratings 4, 1, 5 → the fallback's tone follows the rating.
    expect(ds.map((d) => d.reply)).toEqual([
      healthcareFallbackReply({ rating: 4, locale: "en" }),
      healthcareFallbackReply({ rating: 1, locale: "en" }),
      healthcareFallbackReply({ rating: 5, locale: "en" }),
    ]);
    const blocks = systemBlocks(0);
    expect(blocks[0]).toBe(REVIEW_REPLY_INSTRUCTION);
    expect(blocks[1]).toContain("Warm and upbeat.");
    expect(blocks[blocks.length - 1]).toBe(HEALTHCARE_REPLY_RULES);
    // The log names the rules broken, never the matched text.
    const logged = JSON.stringify(loggerFns.info.mock.calls);
    expect(logged).toContain("care_detail");
    expect(logged).not.toMatch(/root canal|patel/i);
  });

  it("healthcare, French dashboard: the fallback is French", async () => {
    await generateReviewReplies({ ...INPUT, locale: "fr", reviewLimit: 1 });
    expect(drafts()[0].reply).toBe(healthcareFallbackReply({ rating: 4, locale: "fr" }));
  });

  it("healthcare: a compliant draft is kept as written", async () => {
    callMarketingModel.mockResolvedValue({ text: COMPLIANT, inputTokens: 1, outputTokens: 1, cacheReadTokens: 0 });
    await generateReviewReplies({ ...INPUT, reviewLimit: 1 });
    expect(drafts()[0]).toMatchObject({ reply: COMPLIANT, guardrail: HEALTHCARE_GUARDRAIL });
  });

  it("non-healthcare: unaffected — no rules block, drafts verbatim, no marker", async () => {
    useTenant(PLUMBER);
    await generateReviewReplies({ ...INPUT, reviewLimit: 3 });
    for (const d of drafts()) {
      expect(d.reply).toBe(LEAKY);
      expect(d).not.toHaveProperty("guardrail");
    }
    expect(systemBlocks(0)).not.toContain(HEALTHCARE_REPLY_RULES);
  });
});

describe("path 3 — regeneration of one rejected draft (reviewIds)", () => {
  it("healthcare: the redraft is safe", async () => {
    prisma.externalReview.findMany.mockResolvedValue([review("r2", 2)]);
    await generateReviewReplies({ ...INPUT, reviewIds: ["r2"] });
    expect(prisma.externalReview.findMany.mock.calls[0][0].where.id).toEqual({ in: ["r2"] });
    expect(drafts()).toHaveLength(1);
    expectSafe(drafts()[0].reply);
    expect(drafts()[0].guardrail).toBe(HEALTHCARE_GUARDRAIL);
  });

  it("non-healthcare: the redraft is the model's", async () => {
    useTenant(PLUMBER);
    prisma.externalReview.findMany.mockResolvedValue([review("r2", 2)]);
    await generateReviewReplies({ ...INPUT, reviewIds: ["r2"] });
    expect(drafts()[0].reply).toBe(LEAKY);
  });
});

describe("path 4 — AI suggestion (Fix with AI → worker → generate)", () => {
  it("the worker's dispatch for review_reply is the guarded generator", () => {
    expect(GENERATORS.review_reply).toBe(generateReviewReplies);
  });

  it("healthcare: generate('review_reply') produces safe drafts", async () => {
    await generate("review_reply", { ...INPUT, reviewLimit: 2 });
    for (const d of drafts()) expectSafe(d.reply);
  });

  it("non-healthcare: generate('review_reply') is unaffected", async () => {
    useTenant(PLUMBER);
    await generate("review_reply", { ...INPUT, reviewLimit: 2 });
    for (const d of drafts()) expect(d.reply).toBe(LEAKY);
  });
});

// ─── No unguarded path ──────────────────────────────────────────────────────

describe("every reply-drafting path is guarded", () => {
  it("each file in src/ that builds a reply prompt also runs enforceHealthcareReply", () => {
    const grep = (pattern: string) => {
      try {
        return execFileSync("git", ["grep", "-l", "-E", pattern, "--", "src"], { cwd: ROOT, encoding: "utf8" }).trim().split("\n").filter(Boolean);
      } catch {
        return [];
      }
    };
    const builders = grep("buildReviewReplyPrompt\\(|reviewReplySystemText\\(|REVIEW_REPLY_INSTRUCTION")
      .filter((f) => f !== "src/lib/action-agent/prompts.ts")
      .sort();
    // A new path lands here and must be reviewed, not slip through.
    expect(builders).toEqual(["src/app/api/ai/respond/route.ts", "src/lib/action-agent/generate.ts"]);
    const guarded = new Set(grep("enforceHealthcareReply\\("));
    for (const f of builders) expect(guarded.has(f), f).toBe(true);
  });

  it("there is no auto-reply path: nothing in src/ writes a reply to a review", () => {
    let out = "";
    try {
      out = execFileSync("git", ["grep", "-n", "-E", "replyContent\\s*:", "--", "src"], { cwd: ROOT, encoding: "utf8" });
    } catch {
      out = "";
    }
    // Only a select (`replyContent: true`) and the unanswered filter
    // (`replyContent: null`) — no line assigns a reply.
    const writes = out.split("\n").filter((l) => l && !/replyContent\s*:\s*(true|null)\b/.test(l));
    expect(writes).toEqual([]);
  });
});
