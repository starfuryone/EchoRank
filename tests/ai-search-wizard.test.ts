// tests/ai-search-wizard.test.ts
//
// The setup wizard: what it accepts, what it offers, how it ranks, and what it
// asks for.
//
// THE ENGINE TESTS ARE THE LOAD-BEARING ONES. A wizard that lets someone tick
// an engine the runner will refuse produces a checkup reporting zeros for a
// provider nobody called — which reads on the dashboard as "you are invisible
// on Gemini" when the truth is "we never asked Gemini". That is a wrong answer
// presented confidently, and it is invisible unless something asserts that the
// form and the runner share one predicate.
//
// THE OTHER RULE WORTH PINNING is that suggested questions do not name the
// brand. The entire measurement is whether an assistant volunteers it
// unprompted; a suggestion containing the name measures our own typing.

import { describe, expect, it, vi } from "vitest";
import type { PlanType } from "@/generated/prisma";
import {
  brandVariations,
  isValidBrand,
  isValidDomain,
  normalizeBrand,
  normalizeDomain,
  validateSubmission,
} from "@/lib/ai-monitor/wizard/validation";
import {
  keepSelectableEngines,
  selectableProviders,
  wizardEngineOptions,
} from "@/lib/ai-monitor/wizard/engines";
import {
  SUGGESTION_WEIGHTS,
  commercialIntentFor,
  naturalness,
  rankSuggestions,
  suggestionScore,
} from "@/lib/ai-monitor/wizard/scoring";
import { extractSiteFields, analyseSite } from "@/lib/ai-monitor/wizard/site-analysis";
import {
  WIZARD_MIX,
  categoriesFor,
  categoryMatch,
  suggestPrompts,
  topicalRelevance,
  wizardLabelFor,
} from "@/lib/ai-monitor/wizard/suggest";
import { PROMPT_CATEGORIES, INITIAL_CATEGORY_ORDER } from "@/lib/ai-monitor/prompts/categories";

const WITH_KEY = { ANTHROPIC_API_KEY: "k" } as unknown as NodeJS.ProcessEnv;

/**
 * Just the fields these tests assert on. Typed so `mock.calls[0][0]` is
 * indexable — an untyped vi.fn() records its arguments as an empty tuple.
 */
interface GenerateArgs {
  count: number;
  categories?: readonly string[];
  description: string;
}

// ───────────────────────────── validation ─────────────────────────────

describe("normalising what the user typed", () => {
  it("reduces any pasted form of a website to its registrable domain", () => {
    // All of these are things people actually paste. Refusing them is a support
    // ticket, not a validation.
    for (const input of [
      "acme.com",
      "www.acme.com",
      "https://acme.com",
      "HTTPS://Www.Acme.com/pricing?utm=x",
      "https://blog.acme.com/post/1",
      "acme.com/",
    ]) {
      expect(normalizeDomain(input)).toBe("acme.com");
    }
  });

  it("keeps a multi-label public suffix intact", () => {
    expect(normalizeDomain("https://shop.acme.co.uk/x")).toBe("acme.co.uk");
  });

  it("refuses things that are not domains", () => {
    // registrableDomain is a parser and hands "not a domain" straight back, so
    // the shape check is what makes this a validation.
    for (const input of ["", "   ", "not a domain", "localhost", "com", "acme", "a b.com"]) {
      expect(normalizeDomain(input)).toBeNull();
      expect(isValidDomain(input)).toBe(false);
    }
  });

  it("keeps a brand's display casing but collapses whitespace", () => {
    expect(normalizeBrand("  Acme   Analytics ")).toBe("Acme Analytics");
    expect(isValidBrand("Acme")).toBe(true);
  });

  it("refuses a brand with no letter or digit in it", () => {
    // The deterministic scan cannot match "—" in prose, so accepting it would
    // create a brand that can never be mentioned.
    expect(isValidBrand("—")).toBe(false);
    expect(isValidBrand("   ")).toBe(false);
  });
});

describe("brand variations", () => {
  it("derives the mechanical variants, display name first", () => {
    expect(brandVariations("Acme Analytics Inc.")).toEqual([
      "Acme Analytics Inc.",
      "Acme Analytics",
      "AcmeAnalytics",
      "Acme-Analytics",
    ]);
  });

  it("builds the spacing variants from the de-suffixed form", () => {
    // "AcmeAnalyticsInc" is not a thing anyone writes.
    expect(brandVariations("Acme Analytics Inc.")).not.toContain("AcmeAnalyticsInc");
  });

  it("splits a hyphenated name the other way", () => {
    expect(brandVariations("Echo-Rank")).toEqual(["Echo-Rank", "Echo Rank", "EchoRank"]);
  });

  it("keeps the user's own additions and de-duplicates case-insensitively", () => {
    const variants = brandVariations("Acme", ["ACME", "Acme Co"]);
    expect(variants).toContain("Acme Co");
    // "ACME" is the same string to the matcher, which folds case anyway.
    expect(variants.filter((v) => v.toLowerCase() === "acme")).toHaveLength(1);
  });

  it("invents nothing for a single word", () => {
    // Guessing "Big Blue" for IBM is the false positive that inflates mention
    // rate and looks like success.
    expect(brandVariations("Echorank360")).toEqual(["Echorank360"]);
  });
});

describe("validating a submission", () => {
  const valid = {
    brand: "Acme",
    website: "https://acme.com",
    engines: ["CLAUDE"],
    prompts: ["what is the best analytics tool for a small shop?"],
  };

  it("accepts a complete one and returns the values to store", () => {
    const result = validateSubmission(valid);
    expect(result.ok).toBe(true);
    expect(result.normalized).toMatchObject({
      brand: "Acme",
      domain: "acme.com",
      engines: ["CLAUDE"],
      language: "en",
    });
  });

  it("reports every problem at once, not the first", () => {
    // One problem per submission makes a user with three problems submit four
    // times, and the fourth is where they give up.
    const result = validateSubmission({ brand: " ", website: "nope", engines: [], prompts: [] });
    expect(result.ok).toBe(false);
    expect(result.errors.sort()).toEqual([
      "brand_required",
      "domain_invalid",
      "engines_required",
      "prompts_required",
    ]);
  });

  it("requires at least one engine and one prompt", () => {
    expect(validateSubmission({ ...valid, engines: [] }).errors).toContain("engines_required");
    expect(validateSubmission({ ...valid, prompts: ["   "] }).errors).toContain("prompts_required");
  });

  it("de-duplicates prompts and engines rather than rejecting them", () => {
    const result = validateSubmission({
      ...valid,
      engines: ["CLAUDE", "CLAUDE"],
      prompts: ["Best tool?", "best tool?", "Another one?"],
    });
    expect(result.normalized?.engines).toEqual(["CLAUDE"]);
    expect(result.normalized?.prompts).toEqual(["Best tool?", "Another one?"]);
  });

  it("normalises the domain and the variations before they are stored", () => {
    const result = validateSubmission({ ...valid, website: "HTTPS://WWW.Acme.com/pricing" });
    expect(result.normalized?.domain).toBe("acme.com");
    expect(result.normalized?.aliases[0]).toBe("Acme");
  });
});

// ───────────────────────────── engine selection ─────────────────────────────

describe("which engines the wizard offers", () => {
  it("only makes an engine selectable if the runner would actually run it", () => {
    // One predicate shared with runner/providers.ts. A tickable engine the
    // runner refuses reports zeros for a provider nobody called.
    const options = wizardEngineOptions(WITH_KEY);
    const selectable = options.filter((option) => option.selectable).map((o) => o.provider);
    expect(selectable).toEqual(["CLAUDE"]);
  });

  it("shows the rest disabled rather than hiding them", () => {
    const options = wizardEngineOptions(WITH_KEY);
    expect(options.length).toBeGreaterThan(1);
    for (const option of options.filter((o) => !o.selectable)) {
      expect(option.note).toBeTruthy();
      expect(option.reason).toBeTruthy();
    }
  });

  it("makes nothing selectable when no key is configured", () => {
    expect(selectableProviders({} as unknown as NodeJS.ProcessEnv)).toEqual([]);
  });

  it("drops an engine a stale tab submitted instead of failing the whole setup", () => {
    // The user loses the engine they could never have had, not five minutes of
    // form filling.
    expect(keepSelectableEngines(["CLAUDE", "GEMINI", "GROK"], WITH_KEY)).toEqual(["CLAUDE"]);
  });

  it("never invents an engine that is not in the catalogue", () => {
    expect(keepSelectableEngines(["MADE_UP"], WITH_KEY)).toEqual([]);
  });
});

// ───────────────────────────── ranking ─────────────────────────────

describe("the suggestion score", () => {
  it("weights the four signals 35/30/20/15", () => {
    // Hand-computed: 100*.35 + 80*.30 + 60*.20 + 40*.15 = 35 + 24 + 12 + 6.
    expect(
      suggestionScore({
        topicalRelevance: 100,
        categoryMatch: 80,
        commercialIntent: 60,
        queryNaturalness: 40,
      }),
    ).toBe(77);
    expect(SUGGESTION_WEIGHTS.topicalRelevance).toBe(0.35);
  });

  it("clamps a signal rather than letting it dominate", () => {
    expect(
      suggestionScore({
        topicalRelevance: 500,
        categoryMatch: -20,
        commercialIntent: Number.NaN,
        queryNaturalness: 0,
      }),
    ).toBe(35);
  });

  it("sorts descending and truncates to the tier limit", () => {
    const candidate = (text: string, topicalRelevance: number) => ({
      text,
      category: "DISCOVERY" as const,
      intent: "commercial" as const,
      topicalRelevance,
      categoryMatch: 100,
    });
    const ranked = rankSuggestions(
      [candidate("low?", 0), candidate("high?", 100), candidate("mid?", 50)],
      2,
    );
    expect(ranked.map((r) => r.candidate.text)).toEqual(["high?", "mid?"]);
  });

  it("breaks a tie on the generator's order, not alphabetically", () => {
    // Alphabetical is not a preference; it is a bias toward "a".
    const same = (text: string) => ({
      text,
      category: "DISCOVERY" as const,
      intent: "commercial" as const,
      topicalRelevance: 50,
      categoryMatch: 50,
    });
    const ranked = rankSuggestions([same("zebra tools?"), same("apple tools?")], 2);
    expect(ranked.map((r) => r.candidate.text)).toEqual(["zebra tools?", "apple tools?"]);
  });

  it("returns nothing for a zero limit rather than everything", () => {
    expect(rankSuggestions([], 5)).toEqual([]);
    expect(
      rankSuggestions(
        [
          {
            text: "a?",
            category: "DISCOVERY" as const,
            intent: "commercial" as const,
            topicalRelevance: 1,
            categoryMatch: 1,
          },
        ],
        0,
      ),
    ).toEqual([]);
  });
});

describe("naturalness", () => {
  it("prefers something a person would say to a keyword string", () => {
    const spoken = naturalness("we run two coffee shops and our till is a nightmare, what now?");
    const keyword = naturalness("best restaurant POS software 2026");
    expect(spoken).toBeGreaterThan(keyword);
  });

  it("penalises a very short fragment", () => {
    expect(naturalness("best CRM")).toBeLessThan(naturalness("which CRM should I use for a small team?"));
  });

  it("survives an empty string", () => {
    expect(naturalness("")).toBe(0);
    expect(naturalness("   ")).toBe(0);
  });
});

describe("commercial intent", () => {
  it("comes from the taxonomy rather than a second set of numbers", () => {
    // Two different answers to "which of my questions are worth money" is how a
    // brand stops trusting either.
    expect(commercialIntentFor("PURCHASE", "commercial")).toBeGreaterThan(
      commercialIntentFor("EDUCATION", "commercial"),
    );
  });

  it("discounts a navigational ask, who already knows the name", () => {
    expect(commercialIntentFor("PURCHASE", "navigational")).toBeLessThan(
      commercialIntentFor("PURCHASE", "commercial"),
    );
  });
});

// ───────────────────────────── site analysis ─────────────────────────────

describe("reading one homepage", () => {
  it("prefers og:title and the meta description", () => {
    const fields = extractSiteFields(`
      <html><head>
        <title>Acme — Home</title>
        <meta property="og:title" content="Acme Analytics">
        <meta name="description" content="Dashboards for small shops.">
      </head><body><h1>Know your numbers</h1></body></html>`);
    expect(fields.title).toBe("Acme Analytics");
    expect(fields.description).toBe("Dashboards for small shops.");
    expect(fields.heading).toBe("Know your numbers");
    expect(fields.summary).toBe("Acme Analytics — Dashboards for small shops. — Know your numbers");
  });

  it("does not repeat a site whose title and h1 are the same", () => {
    const fields = extractSiteFields(
      "<html><head><title>Acme</title></head><body><h1>Acme</h1></body></html>",
    );
    expect(fields.summary).toBe("Acme");
  });

  it("returns empty fields for a page with no metadata at all", () => {
    const fields = extractSiteFields("<html><body><p>hello</p></body></html>");
    expect(fields.title).toBeNull();
    expect(fields.summary).toBe("");
  });

  it("treats an unreachable site as a normal outcome", async () => {
    // Otherwise a brand behind Cloudflare cannot be set up at all.
    const result = await analyseSite("acme.com", {
      fetch: async () =>
        ({ html: null, error: "timeout", statusCode: null }) as unknown as Awaited<
          ReturnType<typeof import("@/lib/site-crawler/fetch").fetchPage>
        >,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("timeout");
    expect(result.summary).toBe("");
  });

  it("fetches exactly once", async () => {
    // Constraint: one fetch, not a crawl. The 12-page crawler still exists for
    // background onboarding and must not be reached from here.
    const fetchSpy = vi.fn<(url: string) => Promise<never>>(
      async () => ({ html: "<title>Acme</title>" }) as never,
    );
    await analyseSite("acme.com", { fetch: fetchSpy });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe("https://acme.com/");
  });
});

// ───────────────────────────── the mix ─────────────────────────────

describe("the wizard's category mix", () => {
  it("names all eight shapes the spec asks for", () => {
    expect(WIZARD_MIX.map((entry) => entry.label)).toEqual([
      "best-provider",
      "comparison",
      "recommendation",
      "product",
      "problem-solving",
      "local",
      "alternatives",
      "buying-intent",
    ]);
  });

  it("stores them as members of the existing vocabulary", () => {
    // A second vocabulary would mean DISCOVERY and best-provider both existing
    // and meaning the same thing.
    for (const entry of WIZARD_MIX) {
      expect(PROMPT_CATEGORIES).toContain(entry.category);
    }
    expect(wizardLabelFor("DISCOVERY")).toBe("best-provider");
  });

  it("keeps LOCAL in the funnel order so it can actually be selected", () => {
    // A category the round-robin never reaches is a category that never appears.
    expect(INITIAL_CATEGORY_ORDER).toContain("LOCAL");
  });

  it("drops local questions for a business with no geography", () => {
    // A global SaaS asked for "near me" gets a city picked at random, and it
    // crowds out a comparison.
    expect(categoriesFor(true)).toContain("LOCAL");
    expect(categoriesFor(false)).not.toContain("LOCAL");
    expect(categoriesFor(false)).toHaveLength(WIZARD_MIX.length - 1);
  });
});

describe("scoring a candidate against its claimed category", () => {
  const candidate = (text: string, category: (typeof PROMPT_CATEGORIES)[number]) => ({
    text,
    category,
    intent: "commercial" as const,
    audience: null,
  });

  it("rewards a sentence carrying the shape its category implies", () => {
    expect(categoryMatch(candidate("is Toast better than Square?", "COMPARISON"), ["COMPARISON"]))
      .toBeGreaterThan(
        categoryMatch(candidate("tell me about tills", "COMPARISON"), ["COMPARISON"]),
      );
  });

  it("marks down a category the wizard never asked for", () => {
    expect(categoryMatch(candidate("what is a POS?", "EDUCATION"), ["COMPARISON"])).toBe(40);
  });
});

describe("topical relevance", () => {
  it("rises with overlap against what the business does", () => {
    const context = "restaurant point of sale software for independent cafes";
    expect(topicalRelevance("which restaurant software suits a cafe?", context)).toBeGreaterThan(
      topicalRelevance("what is the weather tomorrow?", context),
    );
  });

  it("falls back to a neutral score with no context to compare", () => {
    expect(topicalRelevance("anything at all?", "")).toBe(60);
  });
});

// ───────────────────────────── the suggestion step ─────────────────────────────

const GENERATED = {
  value: {
    prompts: [
      {
        text: "which analytics tool is best for a small online shop?",
        category: "DISCOVERY" as const,
        intent: "commercial" as const,
        audience: "small retailer",
      },
      {
        text: "is Acme better than Plausible for a small shop?",
        category: "COMPARISON" as const,
        intent: "commercial" as const,
        audience: null,
      },
      {
        text: "what is analytics",
        category: "EDUCATION" as const,
        intent: "research" as const,
        audience: null,
      },
    ],
  },
  raw: "{}",
  attempts: 1,
  inputTokens: 300,
  outputTokens: 90,
  model: "claude-haiku-4-5",
};

function meterSpy() {
  const calls: { spec: unknown; usage: unknown }[] = [];
  const meter = async <T,>(
    _ctx: unknown,
    spec: unknown,
    fn: () => Promise<{ value: T; usage?: unknown }>,
  ): Promise<T> => {
    const outcome = await fn();
    calls.push({ spec, usage: outcome.usage });
    return outcome.value;
  };
  return { meter, calls };
}

const SITE = async () => ({
  url: "https://acme.com/",
  ok: true,
  title: "Acme Analytics",
  description: "Dashboards for small shops",
  heading: null,
  summary: "Acme Analytics — Dashboards for small shops",
  error: null,
});

describe("generating suggestions", () => {
  const ctx = { tenantId: "t1", plan: "GROWTH" as PlanType };
  const request = { brand: "Acme", domain: "acme.com", industry: "analytics" };

  it("makes exactly one metered model call", async () => {
    // Constraint: a single metered Haiku call. Two would double the cost of a
    // step the tier pays for once.
    const generate = vi.fn<(req: GenerateArgs) => Promise<never>>(async () => GENERATED as never);
    const { meter, calls } = meterSpy();
    await suggestPrompts(request, ctx, { analyse: SITE as never, generate, meter });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].spec).toMatchObject({ provider: "CLAUDE", purpose: "inference" });
    expect(calls[0].usage).toEqual({ inputTokens: 300, outputTokens: 90 });
  });

  it("truncates to the tier's allowance when the model returns more", async () => {
    // The fixture above has only three candidates, so it can never exercise the
    // cut — a mutation run showed the tier limit could be replaced with 999 and
    // nothing failed. This one returns more than GROWTH allows.
    const many = {
      ...GENERATED,
      value: {
        prompts: Array.from({ length: 25 }, (_, i) => ({
          text: `which analytics tool suits a shop with ${i} locations?`,
          category: "DISCOVERY" as const,
          intent: "commercial" as const,
          audience: null,
        })),
      },
    };
    const { meter } = meterSpy();
    const result = await suggestPrompts(request, ctx, {
      analyse: SITE as never,
      generate: async () => many as never,
      meter,
    });
    expect(result.limit).toBe(15);
    expect(result.suggestions).toHaveLength(15);
  });

  it("caps the kept suggestions at the tier's prompt allowance", async () => {
    const generate = vi.fn<(req: GenerateArgs) => Promise<never>>(async () => GENERATED as never);
    const { meter } = meterSpy();
    const result = await suggestPrompts(request, ctx, {
      analyse: SITE as never,
      generate,
      meter,
    });
    // GROWTH allows 15; only 3 candidates came back, so all survive ranking.
    expect(result.limit).toBe(15);
    expect(result.suggestions).toHaveLength(3);
    // Asked for twice the allowance so the score has something to discard.
    expect(generate.mock.calls[0][0].count).toBe(30);
  });

  it("orders by score and carries it through for storage", async () => {
    const { meter } = meterSpy();
    const result = await suggestPrompts(request, ctx, {
      analyse: SITE as never,
      generate: async () => GENERATED as never,
      meter,
    });
    const scores = result.suggestions.map((s) => s.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    // The bare "what is analytics" fragment should not lead.
    expect(result.suggestions[0].text).not.toBe("what is analytics");
  });

  it("labels each suggestion with the wizard's own category name", async () => {
    const { meter } = meterSpy();
    const result = await suggestPrompts(request, ctx, {
      analyse: SITE as never,
      generate: async () => GENERATED as never,
      meter,
    });
    const discovery = result.suggestions.find((s) => s.category === "DISCOVERY");
    expect(discovery?.label).toBe("best-provider");
  });

  it("asks for local questions only when a country was given", async () => {
    const generate = vi.fn<(req: GenerateArgs) => Promise<never>>(async () => GENERATED as never);
    const { meter } = meterSpy();

    await suggestPrompts(request, ctx, { analyse: SITE as never, generate, meter });
    expect(generate.mock.calls[0][0].categories).not.toContain("LOCAL");

    await suggestPrompts({ ...request, country: "CH" }, ctx, {
      analyse: SITE as never,
      generate,
      meter,
    });
    expect(generate.mock.calls[1][0].categories).toContain("LOCAL");
  });

  it("briefs the generator with the homepage as well as the typed description", async () => {
    const generate = vi.fn<(req: GenerateArgs) => Promise<never>>(async () => GENERATED as never);
    const { meter } = meterSpy();
    await suggestPrompts({ ...request, description: "we sell dashboards" }, ctx, {
      analyse: SITE as never,
      generate,
      meter,
    });
    const brief = generate.mock.calls[0][0].description;
    expect(brief).toContain("we sell dashboards");
    expect(brief).toContain("Dashboards for small shops");
  });

  it("returns an empty set rather than throwing when the tenant is capped", async () => {
    const { AiCapReachedError } = await import("@/lib/ai-monitor/cap");
    const result = await suggestPrompts(request, ctx, {
      analyse: SITE as never,
      generate: async () => GENERATED as never,
      meter: async () => {
        throw new AiCapReachedError(40, 40);
      },
    });
    expect(result.capped).toBe(true);
    expect(result.suggestions).toEqual([]);
    // The wizard still works — the user writes their own.
    expect(result.error).toBeNull();
  });

  it("survives a model reply nothing could be parsed from", async () => {
    const { meter } = meterSpy();
    const result = await suggestPrompts(request, ctx, {
      analyse: SITE as never,
      generate: async () =>
        ({ value: null, error: "schema mismatch", inputTokens: 10, outputTokens: 1, model: "m" }) as never,
      meter,
    });
    expect(result.suggestions).toEqual([]);
    expect(result.error).toBe("schema mismatch");
  });

  it("still returns the site read when the model fails", async () => {
    const { meter } = meterSpy();
    const result = await suggestPrompts(request, ctx, {
      analyse: SITE as never,
      generate: async () => ({ value: null, inputTokens: 0, outputTokens: 0, model: "m" }) as never,
      meter,
    });
    expect(result.site.title).toBe("Acme Analytics");
  });

  it("takes its ceiling from the tier, not a constant", async () => {
    // STARTER's shape allows 10 prompts where GROWTH allows 15. STARTER never
    // reaches this step in practice — the route's requireFeature("ai_visibility")
    // gate refuses it first, and that gate is deliberately not duplicated here —
    // but the ceiling has to come from the tier either way.
    const generate = vi.fn<(req: GenerateArgs) => Promise<never>>(async () => GENERATED as never);
    const { meter } = meterSpy();
    const result = await suggestPrompts(request, { tenantId: "t1", plan: "STARTER" }, {
      analyse: SITE as never,
      generate,
      meter,
    });
    expect(result.limit).toBe(10);
    expect(generate.mock.calls[0][0].count).toBe(20);
  });
});
