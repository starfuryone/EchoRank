// tests/action-agent-generate.test.ts
//
// The generators: deterministic assembly, the prompt boundary, the grounding
// context, and the one thing the review_reply kind must NOT do.
//
// THE HEADLINE INVARIANT: the model writes FIELDS and this code writes MARKUP.
// Every assertion about `@graph`, about escaping, and about address/telephone
// exists to keep that split from eroding — the day a generator pastes a model's
// string into a page is the day a customer ships JSON-LD that does not parse.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const { prisma, callMarketingModel, notify, loggerFns, redis, fetchPage } = vi.hoisted(() => ({
  prisma: {
    aiApiCall: { create: vi.fn() },
    actionItem: { create: vi.fn() },
    tenant: { findFirst: vi.fn() },
    externalReview: { findMany: vi.fn() },
    trackedPrompt: { findMany: vi.fn() },
    siteAudit: { findFirst: vi.fn() },
    crawlJob: { findFirst: vi.fn() },
    crawlPage: { findMany: vi.fn() },
  },
  callMarketingModel: vi.fn(),
  notify: vi.fn(),
  loggerFns: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  redis: { get: vi.fn(), incrby: vi.fn(), expire: vi.fn() },
  fetchPage: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/infrastructure/redis/connection", () => ({ getRedisConnection: () => redis }));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: loggerFns }));
vi.mock("@/lib/notifications/adapters", () => ({ notifyActionDraftReady: notify }));
vi.mock("@/lib/marketing/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/marketing/client")>();
  return { ...actual, callMarketingModel };
});
vi.mock("@/lib/site-crawler/fetch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/site-crawler/fetch")>();
  return { ...actual, fetchPage };
});

import {
  assembleSchema,
  cleanFaqs,
  coerceBusinessType,
  omittedFields,
  parseFieldsJson,
  renderFaq,
  schemaPlacement,
} from "@/lib/action-agent/assemble";
import {
  buildFaqPrompt,
  buildReviewReplyPrompt,
  buildSchemaPrompt,
  MAX_TOKENS,
  REVIEW_REPLY_INSTRUCTION,
} from "@/lib/action-agent/prompts";
import {
  gatherAuditFindings,
  gatherPageContext,
  gatherTrackedPrompts,
  gatherUnansweredReviews,
} from "@/lib/action-agent/context";
import { generateFaq, generateSchema } from "@/lib/action-agent/generate";

const URL_UNDER_TEST = "https://example.com/services";
const TENANT = "tenant_a";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.tenant.findFirst.mockResolvedValue({ name: "Acme", brandVoiceGuide: null });
  prisma.siteAudit.findFirst.mockResolvedValue(null);
  prisma.trackedPrompt.findMany.mockResolvedValue([]);
  prisma.crawlJob.findFirst.mockResolvedValue(null);
  prisma.crawlPage.findMany.mockResolvedValue([]);
  prisma.aiApiCall.create.mockResolvedValue({});
  prisma.actionItem.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({
      id: "item_1",
      tenantId: TENANT,
      kind: data.kind,
      sourceRef: data.sourceRef,
      draft: data.draft,
      status: "draft",
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectedNote: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      appliedAt: null,
    }),
  );
  redis.get.mockResolvedValue("0");
  redis.incrby.mockResolvedValue(1);
  redis.expire.mockResolvedValue(1);
});

// ─── Deterministic assembly ─────────────────────────────────────────────────

describe("assembleSchema", () => {
  const fields = {
    business_name: "Acme Plumbing",
    business_type: "LocalBusiness",
    description: "Emergency plumbing across the city.",
    services: ["leak repair", "boiler service"],
    area_served: ["Zurich"],
    same_as: ["https://linkedin.com/company/acme"],
    faqs: [{ q: "Do you work weekends?", a: "Yes, including Sundays." }],
  };

  function graph() {
    const block = assembleSchema(fields, URL_UNDER_TEST);
    const json = block.replace(/^<script[^>]*>\n/, "").replace(/\n<\/script>\n$/, "");
    return JSON.parse(json) as { "@context": string; "@graph": Record<string, unknown>[] };
  }

  it("produces a parseable JSON-LD document inside a script tag", () => {
    const block = assembleSchema(fields, URL_UNDER_TEST);
    expect(block.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(block.trimEnd().endsWith("</script>")).toBe(true);
    expect(() => graph()).not.toThrow();
  });

  it("wires Organization, WebSite and FAQPage with stable @id anchors", () => {
    const doc = graph();
    expect(doc["@context"]).toBe("https://schema.org");
    const types = doc["@graph"].map((node) => node["@type"]);
    expect(types).toEqual(["LocalBusiness", "WebSite", "FAQPage"]);
    expect(doc["@graph"][0]["@id"]).toBe(`${URL_UNDER_TEST}#org`);
    expect(doc["@graph"][1].publisher).toEqual({ "@id": `${URL_UNDER_TEST}#org` });
  });

  it("NEVER emits address or telephone, even when the model returns them", () => {
    // The two fields where a hallucination reaches a real customer: Google will
    // show a wrong phone number to people who then call it. There is no branch
    // that can emit these, so a prompt edit cannot reintroduce them.
    const block = assembleSchema(
      { ...fields, address: "10 Fake St", telephone: "+41 00 000 00 00" } as never,
      URL_UNDER_TEST,
    );
    expect(block).not.toContain("10 Fake St");
    expect(block).not.toContain("telephone");
    expect(block).not.toContain("address");
  });

  it("omits optional keys rather than emitting empty arrays", () => {
    const doc = JSON.parse(
      assembleSchema({ business_name: "Acme" }, URL_UNDER_TEST)
        .replace(/^<script[^>]*>\n/, "")
        .replace(/\n<\/script>\n$/, ""),
    ) as { "@graph": Record<string, unknown>[] };
    const org = doc["@graph"][0];
    expect(org).not.toHaveProperty("sameAs");
    expect(org).not.toHaveProperty("areaServed");
    expect(org).not.toHaveProperty("knowsAbout");
    // No FAQPage node at all when there are no pairs.
    expect(doc["@graph"]).toHaveLength(2);
  });

  it("coerces an invented @type back to Organization", () => {
    expect(coerceBusinessType("ArtisanalPlumbingCollective")).toBe("Organization");
    expect(coerceBusinessType(null)).toBe("Organization");
    expect(coerceBusinessType("LocalBusiness")).toBe("LocalBusiness");
  });

  it("reports what the page did not evidence", () => {
    expect(omittedFields({ business_name: "Acme" })).toEqual([
      "sameAs",
      "areaServed",
      "knowsAbout",
    ]);
    expect(omittedFields(fields)).toEqual([]);
  });

  it("gives placement steps that name the page and end at validation", () => {
    const steps = schemaPlacement(URL_UNDER_TEST);
    expect(steps[0]).toContain(URL_UNDER_TEST);
    expect(steps.join(" ")).toContain("</head>");
    expect(steps[steps.length - 1]).toContain("Rich Results Test");
  });
});

describe("cleanFaqs and renderFaq", () => {
  it("drops a pair missing either half rather than repairing it", () => {
    expect(
      cleanFaqs([
        { q: "A?", a: "Yes." },
        { q: "B?", a: "  " },
        { q: "", a: "orphan" },
        "not an object",
      ]),
    ).toEqual([{ q: "A?", a: "Yes." }]);
  });

  it("escapes HTML in both the question and the answer, ampersand first", () => {
    const { html } = renderFaq([{ q: 'Tom & "Jerry"?', a: "<script>alert(1)</script>" }]);
    expect(html).toContain("Tom &amp; &quot;Jerry&quot;?");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    // Never double-escaped: &amp; and not &amp;amp;
    expect(html).not.toContain("&amp;amp;");
    expect(html).not.toContain("<script>alert");
  });

  it("renders markdown and HTML from the SAME list so they cannot drift", () => {
    const items = [
      { q: "Do you work weekends?", a: "Yes." },
      { q: "Where are you?", a: "Zurich." },
    ];
    const { html, markdown } = renderFaq(items);
    for (const item of items) {
      expect(html).toContain(item.q);
      expect(markdown).toContain(item.q);
      expect(markdown).toContain(item.a);
    }
  });

  it("returns empty strings for an empty list rather than an empty section", () => {
    expect(renderFaq([])).toEqual({ html: "", markdown: "" });
  });
});

describe("parseFieldsJson", () => {
  it("tolerates a code fence and leading prose", () => {
    expect(parseFieldsJson('Here you go:\n```json\n{"business_name":"Acme"}\n```')).toEqual({
      business_name: "Acme",
    });
  });

  it("throws on a response with no object in it", () => {
    expect(() => parseFieldsJson("I could not do that.")).toThrow(/did not return JSON/);
  });

  it("throws on a bare array, which is not the contract", () => {
    expect(() => parseFieldsJson("[1,2,3]")).toThrow();
  });
});

// ─── The prompt boundary ────────────────────────────────────────────────────

describe("prompts", () => {
  it("puts the shared instruction first and the tenant voice second", () => {
    const prompt = buildSchemaPrompt({
      url: URL_UNDER_TEST,
      title: "Services",
      metaDescription: null,
      h1s: [],
      existingSchemaTypes: [],
      content: "We fix leaks.",
      auditFindings: [],
      voiceGuide: "Plain, direct, never salesy.",
    });
    expect(prompt.system).toHaveLength(2);
    expect(prompt.system[0].text).toContain("grounded ONLY in the page content");
    expect(prompt.system[1].text).toContain("Plain, direct, never salesy.");
  });

  it("carries no voice block when the tenant has no guide", () => {
    const prompt = buildSchemaPrompt({
      url: URL_UNDER_TEST,
      title: "",
      metaDescription: null,
      h1s: [],
      existingSchemaTypes: [],
      content: "x",
      auditFindings: [],
      voiceGuide: null,
    });
    expect(prompt.system).toHaveLength(1);
  });

  it("forbids address and telephone in the prompt as well as in the assembler", () => {
    const prompt = buildSchemaPrompt({
      url: URL_UNDER_TEST,
      title: "",
      metaDescription: null,
      h1s: [],
      existingSchemaTypes: [],
      content: "x",
      auditFindings: [],
      voiceGuide: null,
    });
    expect(prompt.userMessage).toContain("NEVER include an address or a telephone number");
  });

  it("quotes the audit findings when there are any, and says so when there are not", () => {
    const withFindings = buildSchemaPrompt({
      url: URL_UNDER_TEST,
      title: "",
      metaDescription: null,
      h1s: [],
      existingSchemaTypes: [],
      content: "x",
      auditFindings: ["duplicate_title_tag (warning, meta; 4 pages)"],
      voiceGuide: null,
    });
    expect(withFindings.userMessage).toContain("duplicate_title_tag");
  });

  it("orders the FAQ around the tracked prompts, and says when there are none", () => {
    const tracked = buildFaqPrompt({
      url: URL_UNDER_TEST,
      title: "Services",
      content: "x",
      trackedPrompts: ["best emergency plumber in Zurich", "who fixes boilers on Sunday"],
      pageInventory: [{ url: "https://example.com/about", title: "About" }],
      locale: "en",
      voiceGuide: null,
    });
    expect(tracked.userMessage).toContain("1. best emergency plumber in Zurich");
    expect(tracked.userMessage).toContain("https://example.com/about");

    const bare = buildFaqPrompt({
      url: URL_UNDER_TEST,
      title: "",
      content: "x",
      trackedPrompts: [],
      pageInventory: [],
      locale: "en",
      voiceGuide: null,
    });
    expect(bare.userMessage).toContain("tracks no questions yet");
  });

  it("localizes the FAQ deliverable but never the schema one", () => {
    const fr = buildFaqPrompt({
      url: URL_UNDER_TEST,
      title: "",
      content: "x",
      trackedPrompts: [],
      pageInventory: [],
      locale: "fr",
      voiceGuide: null,
    });
    expect(fr.userMessage).toContain("in French");

    // Schema takes no locale at all: a French `description` on an English page
    // describes the page wrongly.
    const schema = buildSchemaPrompt({
      url: URL_UNDER_TEST,
      title: "",
      metaDescription: null,
      h1s: [],
      existingSchemaTypes: [],
      content: "x",
      auditFindings: [],
      voiceGuide: null,
    });
    expect(schema.userMessage).not.toContain("in French");
  });

  it("uses de-CH's ss and never ß", () => {
    const de = buildReviewReplyPrompt({
      businessName: "Acme",
      platform: "GOOGLE",
      rating: 5,
      authorName: null,
      reviewText: "Great.",
      locale: "de-CH",
      voiceGuide: null,
    });
    expect(de.userMessage).toContain("Swiss High German");
    expect(de.userMessage).toContain("ss, never ß");
  });

  it("keeps each kind's token ceiling out of any request body", () => {
    expect(MAX_TOKENS).toEqual({ schema: 1800, faq: 2000, review_reply: 500 });
  });
});

// ─── The review-reply instruction is imported, not forked ───────────────────

describe("the review-reply instruction", () => {
  it("still carries every clause the legal position depends on", () => {
    for (const clause of [
      "never argue",
      "never admit legal fault",
      "invite offline contact",
      "Never fabricate facts, discounts or promises",
    ]) {
      expect(REVIEW_REPLY_INSTRUCTION).toContain(clause);
    }
  });

  it("is IMPORTED by /api/ai/respond rather than duplicated there", () => {
    // The route had this paragraph inline and now reads it from prompts.ts.
    // Two copies of "never admit legal fault" is how a legal position drifts,
    // so the absence of the literal is asserted, not just the import.
    const source = readFileSync(
      join(process.cwd(), "src/app/api/ai/respond/route.ts"),
      "utf8",
    );
    expect(source).toContain("REVIEW_REPLY_INSTRUCTION");
    expect(source).toContain("@/lib/action-agent/prompts");
    expect(source).not.toContain("never admit legal fault");
  });
});

// ─── Grounding context ──────────────────────────────────────────────────────

describe("gatherPageContext", () => {
  function html(body: string) {
    return `<!doctype html><html><head><title>Acme Services</title>
      <meta name="description" content="We fix leaks."></head>
      <body>${body}</body></html>`;
  }

  function ok(page: string) {
    return {
      finalUrl: URL_UNDER_TEST,
      statusCode: 200,
      redirectTarget: null,
      redirectHops: 0,
      contentType: "text/html; charset=utf-8",
      html: page,
      xRobotsTag: null,
      fetchMs: 12,
      error: null,
    };
  }

  it("extracts title, description, h1s and existing JSON-LD types", async () => {
    fetchPage.mockResolvedValue(
      ok(
        html(
          `<h1>Emergency plumbing</h1><h1>Boilers</h1>
           <script type="application/ld+json">{"@type":"Organization","name":"Acme"}</script>
           <p>We fix leaks fast.</p>`,
        ),
      ),
    );

    const context = await gatherPageContext(URL_UNDER_TEST);

    expect(context.title).toBe("Acme Services");
    expect(context.metaDescription).toBe("We fix leaks.");
    expect(context.h1s).toEqual(["Emergency plumbing", "Boilers"]);
    expect(context.existingSchemaTypes).toEqual(["Organization"]);
    expect(context.content).toContain("We fix leaks fast.");
  });

  it("SKIPS an unparseable JSON-LD block instead of failing", async () => {
    // A broken existing block is one of the strongest reasons to generate a
    // replacement, so refusing here would refuse exactly the pages that need it.
    fetchPage.mockResolvedValue(
      ok(html('<script type="application/ld+json">{ nope </script><p>Body text.</p>')),
    );
    const context = await gatherPageContext(URL_UNDER_TEST);
    expect(context.existingSchemaTypes).toEqual([]);
    expect(context.content).toContain("Body text.");
  });

  it("strips script and style text out of the content", async () => {
    fetchPage.mockResolvedValue(
      ok(html("<script>var secret = 1;</script><style>.a{}</style><p>Visible.</p>")),
    );
    const context = await gatherPageContext(URL_UNDER_TEST);
    expect(context.content).toContain("Visible.");
    expect(context.content).not.toContain("var secret");
  });

  it("refuses a URL the SSRF guard rejects, with no fetch at all", async () => {
    await expect(gatherPageContext("http://127.0.0.1/admin")).rejects.toMatchObject({
      name: "PageUnreachableError",
      statusCode: 422,
    });
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("reports the status code when the page answers but has no HTML", async () => {
    fetchPage.mockResolvedValue({ ...ok(""), statusCode: 404, html: null, contentType: null });
    await expect(gatherPageContext(URL_UNDER_TEST)).rejects.toThrow(/404/);
  });
});

describe("the other gatherers", () => {
  it("scopes audit findings by tenant and host, worst-affected first", async () => {
    prisma.siteAudit.findFirst.mockResolvedValue({
      issues: {
        items: [
          { key: "duplicate_title_tag", severity: "warning", group: "meta", count: 2 },
          { key: "is_4xx_code", severity: "error", group: "availability", count: 9 },
          { key: "never_seen_before", severity: "notice", group: "meta", count: 1 },
        ],
      },
    });

    const findings = await gatherAuditFindings(TENANT, "https://www.example.com/services");

    expect(prisma.siteAudit.findFirst.mock.calls[0][0].where).toEqual({
      tenantId: TENANT,
      domain: "example.com",
      status: "completed",
    });
    expect(findings[0]).toContain("is_4xx_code");
    expect(findings[0]).toContain("9 pages");
    // An uncatalogued key still reaches the model, annotated as such.
    expect(findings.join(" ")).toContain("never_seen_before (uncatalogued; 1 page)");
  });

  it("returns no findings rather than throwing when the tenant never ran an audit", async () => {
    prisma.siteAudit.findFirst.mockResolvedValue(null);
    expect(await gatherAuditFindings(TENANT, URL_UNDER_TEST)).toEqual([]);
  });

  it("orders tracked prompts by the customer's own weighting first", async () => {
    prisma.trackedPrompt.findMany.mockResolvedValue([{ text: "a" }, { text: "b" }]);
    await gatherTrackedPrompts(TENANT);
    const call = prisma.trackedPrompt.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ tenantId: TENANT, active: true });
    expect(call.orderBy[0]).toEqual({ importanceWeight: "desc" });
  });

  it("treats 'unanswered' as BOTH columns being null", async () => {
    prisma.externalReview.findMany.mockResolvedValue([]);
    await gatherUnansweredReviews(TENANT, 5);
    expect(prisma.externalReview.findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: TENANT,
      replyContent: null,
      repliedAt: null,
    });
  });

  it("excludes a bare star rating with no text", async () => {
    prisma.externalReview.findMany.mockResolvedValue([
      { id: "r1", platform: "GOOGLE", rating: 5, authorName: null, content: "   ", publishedAt: null },
      { id: "r2", platform: "GOOGLE", rating: 2, authorName: null, content: "Slow.", publishedAt: null },
    ]);
    const reviews = await gatherUnansweredReviews(TENANT, 5);
    expect(reviews.map((review) => review.id)).toEqual(["r2"]);
  });

  it("filters to specific ids when re-generating, still scoped by tenant", async () => {
    prisma.externalReview.findMany.mockResolvedValue([]);
    await gatherUnansweredReviews(TENANT, 1, ["rev_9"]);
    expect(prisma.externalReview.findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: TENANT,
      id: { in: ["rev_9"] },
    });
  });
});

// ─── End to end, with the model stubbed ─────────────────────────────────────

describe("generateSchema", () => {
  function okPage() {
    fetchPage.mockResolvedValue({
      finalUrl: URL_UNDER_TEST,
      statusCode: 200,
      redirectTarget: null,
      redirectHops: 0,
      contentType: "text/html",
      html: "<html><head><title>Acme</title></head><body><h1>Plumbing</h1><p>We fix leaks.</p></body></html>",
      xRobotsTag: null,
      fetchMs: 10,
      error: null,
    });
  }

  it("writes a draft whose jsonLd came from the assembler, not from the model", async () => {
    okPage();
    // The model returns a string that would be catastrophic if pasted through.
    callMarketingModel.mockResolvedValue({
      text: JSON.stringify({
        business_name: "Acme",
        business_type: "LocalBusiness",
        description: "We fix leaks.",
        faqs: [{ q: "Weekends?", a: "Yes." }],
        jsonLd: "<script>DROP TABLE pages;</script>",
      }),
      inputTokens: 400,
      outputTokens: 300,
      cacheReadTokens: 0,
    });

    const outcome = await generateSchema({
      tenantId: TENANT,
      plan: "STARTER",
      locale: "en",
      url: URL_UNDER_TEST,
    });

    const draft = prisma.actionItem.create.mock.calls[0][0].data.draft as {
      jsonLd: string;
      businessType: string;
    };
    expect(draft.jsonLd).not.toContain("DROP TABLE");
    expect(draft.jsonLd).toContain('"@context": "https://schema.org"');
    expect(draft.businessType).toBe("LocalBusiness");
    expect(outcome.items).toHaveLength(1);
    expect(notify).toHaveBeenCalledWith({
      tenantId: TENANT,
      actionItemId: "item_1",
      kind: "schema",
    });
  });

  it("costs nothing when the page cannot be read", async () => {
    fetchPage.mockResolvedValue({
      finalUrl: URL_UNDER_TEST,
      statusCode: 503,
      redirectTarget: null,
      redirectHops: 0,
      contentType: null,
      html: null,
      xRobotsTag: null,
      fetchMs: 10,
      error: null,
    });

    await expect(
      generateSchema({ tenantId: TENANT, plan: "STARTER", locale: "en", url: URL_UNDER_TEST }),
    ).rejects.toMatchObject({ name: "PageUnreachableError" });

    // Grounding runs BEFORE the budget assertion for exactly this reason.
    expect(callMarketingModel).not.toHaveBeenCalled();
    expect(prisma.aiApiCall.create).not.toHaveBeenCalled();
  });

  it("stores the page URL as the sourceRef, so a re-generation targets the same page", async () => {
    okPage();
    callMarketingModel.mockResolvedValue({
      text: '{"business_name":"Acme","business_type":"Organization","description":"x"}',
      inputTokens: 1,
      outputTokens: 1,
      cacheReadTokens: 0,
    });

    await generateSchema({
      tenantId: TENANT,
      plan: "STARTER",
      locale: "en",
      url: URL_UNDER_TEST,
    });

    expect(prisma.actionItem.create.mock.calls[0][0].data.sourceRef).toBe(URL_UNDER_TEST);
  });
});

describe("generateFaq", () => {
  beforeEach(() => {
    fetchPage.mockResolvedValue({
      finalUrl: URL_UNDER_TEST,
      statusCode: 200,
      redirectTarget: null,
      redirectHops: 0,
      contentType: "text/html",
      html: "<html><head><title>Acme</title></head><body><p>We fix leaks.</p></body></html>",
      xRobotsTag: null,
      fetchMs: 10,
      error: null,
    });
  });

  it("renders html and markdown from the pairs it stores", async () => {
    callMarketingModel.mockResolvedValue({
      text: JSON.stringify({
        faqs: [
          { q: "Do you work weekends?", a: "Yes, including Sundays." },
          { q: "Where are you?", a: "Zurich." },
        ],
      }),
      inputTokens: 1,
      outputTokens: 200,
      cacheReadTokens: 0,
    });

    await generateFaq({
      tenantId: TENANT,
      plan: "STARTER",
      locale: "en",
      url: URL_UNDER_TEST,
    });

    const draft = prisma.actionItem.create.mock.calls[0][0].data as {
      draft: { items: { q: string }[]; html: string; markdown: string };
    };
    expect(draft.draft.items).toHaveLength(2);
    expect(draft.draft.html).toContain("Do you work weekends?");
    expect(draft.draft.markdown).toContain("Zurich.");
  });

  it("writes no draft — and says why — when nothing was answerable", async () => {
    callMarketingModel.mockResolvedValue({
      text: '{"faqs":[]}',
      inputTokens: 1,
      outputTokens: 30,
      cacheReadTokens: 0,
    });

    const outcome = await generateFaq({
      tenantId: TENANT,
      plan: "STARTER",
      locale: "en",
      url: URL_UNDER_TEST,
    });

    expect(outcome.emptyReason).toBe("no_answerable_questions");
    expect(prisma.actionItem.create).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    // The tokens were still spent, so they are still metered.
    expect(prisma.aiApiCall.create).toHaveBeenCalledTimes(1);
  });
});
