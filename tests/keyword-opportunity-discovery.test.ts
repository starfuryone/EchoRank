// tests/keyword-opportunity-discovery.test.ts
//
// The deterministic half of the pipeline: what a keyword means, which way its
// demand is moving, what counts as noise, and the one filter that must never
// let a brand name into a prompt.

import { describe, expect, it } from "vitest";

import {
  INTENT_RULES,
  PROVIDER_INTENT_MAP,
  classifyIntent,
  classifyIntentDetailed,
  normalizeKeyword,
} from "@/lib/keyword-opportunity/intent";
import {
  TREND_MIN_POINTS,
  sortedHistory,
  trendPercentFrom,
} from "@/lib/keyword-opportunity/trend";
import {
  isNoise,
  keywordKey,
  mergeKeywords,
  parseKeywordsForSite,
  parseRankedKeywords,
  discoveryFailureReason,
  selectWorkingSet,
  WORKING_SET_LIMIT,
  type DiscoveredKeyword,
} from "@/lib/keyword-opportunity/discover";
import {
  fallbackPromptFor,
  withoutBrandNamedPrompts,
} from "@/lib/keyword-opportunity/prompts";
import { DEFAULT_INTENT_SCORE, intentScore } from "@/lib/keyword-opportunity/score";

const ALIASES = ["AcmeCRM", "Acme CRM", "acmecrm.com"];

describe("intent classification", () => {
  it("reaches the two classes DataForSEO cannot express", () => {
    // THE WHOLE REASON THE PATTERN LAYER EXISTS. The provider has four values
    // and the scorer has five; without these two, intent scores 90 and 80 are
    // dead branches that no live keyword ever reaches.
    expect(classifyIntent("HubSpot alternatives", "commercial")).toBe("product_comparison");
    expect(classifyIntent("Salesforce vs HubSpot", "commercial")).toBe("product_comparison");
    expect(classifyIntent("how to choose a CRM", "informational")).toBe("solution_seeking");
    expect(classifyIntent("why is my CRM so slow", "informational")).toBe("solution_seeking");

    expect(intentScore("product_comparison")).toBe(90);
    expect(intentScore("solution_seeking")).toBe(80);
  });

  it("classifies the rest the way the fixtures assume", () => {
    expect(classifyIntent("affordable CRM software", null)).toBe("transactional");
    expect(classifyIntent("cheapest CRM for small teams", null)).toBe("transactional");
    expect(classifyIntent("best CRM for startups", null)).toBe("commercial_investigation");
    expect(classifyIntent("CRM for agencies", null)).toBe("commercial_investigation");
  });

  it("lets patterns beat the provider, which is the stated precedence", () => {
    // The provider calls this transactional; it is a comparison that mentions
    // price, and the prompt template branches on that difference.
    const result = classifyIntentDetailed("cheapest CRM alternatives", "transactional");
    expect(result.intent).toBe("product_comparison");
    expect(result.source).toBe("pattern");
  });

  it("falls back to the provider when no pattern matches", () => {
    const result = classifyIntentDetailed("crm", "commercial");
    expect(result.intent).toBe("commercial_investigation");
    expect(result.source).toBe("provider");
  });

  it("falls back to informational — the LOWEST class — when nothing is known", () => {
    // Guessing "commercial" to be generous would inflate every unrecognised
    // long-tail keyword into the recommendations.
    const result = classifyIntentDetailed("qwertyuiop", null);
    expect(result.intent).toBe("informational");
    expect(result.source).toBe("default");
    expect(intentScore(result.intent)).toBe(DEFAULT_INTENT_SCORE);
  });

  it("maps navigational onto the default rather than a commercial class", () => {
    // Someone typing a brand to reach a site has no gap for this tool to find.
    expect(PROVIDER_INTENT_MAP.navigational).toBe("informational");
    expect(classifyIntent("qwertyuiop", "navigational")).toBe("informational");
  });

  it("orders the rules most specific first", () => {
    expect(INTENT_RULES.map((rule) => rule.intent)).toEqual([
      "product_comparison",
      "solution_seeking",
      "transactional",
      "commercial_investigation",
    ]);
  });

  it("normalises punctuation and accents so \\b behaves", () => {
    expect(normalizeKeyword("CRM  vs.  Sheets!")).toBe("crm vs sheets");
    expect(normalizeKeyword("logiciel CRM à bas prix")).toBe("logiciel crm a bas prix");
  });
});

describe("trend derivation", () => {
  const history = (volumes: number[]) =>
    volumes.map((search_volume, index) => ({
      year: 2026,
      month: index + 1,
      search_volume,
    }));

  it("compares three months against three, not endpoint to endpoint", () => {
    // Flat but for one spike at the start. An endpoint comparison would report
    // a collapse; the three-month mean absorbs it.
    const spiky = history([300, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]);
    expect(Math.abs(trendPercentFrom(spiky))).toBeLessThan(45);
  });

  it("reports real growth", () => {
    const growing = history([100, 100, 100, 100, 100, 100, 100, 100, 100, 200, 200, 200]);
    expect(trendPercentFrom(growing)).toBeCloseTo(100, 1);
  });

  it("reports real decline", () => {
    const falling = history([200, 200, 200, 100, 100, 100, 100, 100, 100, 100, 100, 100]);
    expect(trendPercentFrom(falling)).toBeCloseTo(-50, 1);
  });

  it("refuses to divide by a zero baseline instead of returning Infinity", () => {
    // A keyword that went from nobody searching it to twelve people searching
    // it is not up by an infinite percentage.
    const fromNothing = history([0, 0, 0, 4, 8, 12, 12, 12, 12, 12, 12, 12]);
    expect(trendPercentFrom(fromNothing)).toBe(0);
    expect(Number.isFinite(trendPercentFrom(fromNothing))).toBe(true);
  });

  it("says nothing rather than guessing on too little history", () => {
    expect(trendPercentFrom(history([100, 200, 300]))).toBe(0);
    expect(trendPercentFrom([])).toBe(0);
    expect(TREND_MIN_POINTS).toBeGreaterThan(3);
  });

  it("sorts the history itself rather than trusting the provider's order", () => {
    const scrambled = [
      { year: 2026, month: 3, search_volume: 30 },
      { year: 2025, month: 12, search_volume: 10 },
      { year: 2026, month: 1, search_volume: 20 },
    ];
    expect(sortedHistory(scrambled).map((p) => p.search_volume)).toEqual([10, 20, 30]);
  });

  it("drops malformed points instead of scoring them as zero", () => {
    const dirty = [
      { year: 2026, month: 1, search_volume: 100 },
      { year: Number.NaN, month: 2, search_volume: 100 },
      { year: 2026, month: 3, search_volume: null },
    ];
    expect(sortedHistory(dirty)).toHaveLength(1);
  });
});

describe("discovery parsing", () => {
  it("reads the FLAT keywords_for_site shape", () => {
    const rows = parseKeywordsForSite([
      {
        keyword: "best CRM for startups",
        keyword_info: { search_volume: 8100, cpc: 18, competition: 0.71 },
        search_intent_info: { main_intent: "commercial" },
      },
    ]);
    expect(rows[0]).toMatchObject({
      keyword: "best CRM for startups",
      monthlyVolume: 8100,
      cpcUsd: 18,
      intent: "commercial_investigation",
      source: "keywords_for_site",
    });
  });

  it("reads the NESTED ranked_keywords shape", () => {
    // THE WRONG NUMBER: a parser written for one shape reads undefined from the
    // other and every keyword comes back at zero volume, which looks like a
    // quiet market rather than a bug.
    const rows = parseRankedKeywords([
      {
        keyword_data: {
          keyword: "CRM for agencies",
          keyword_info: { search_volume: 2400, cpc: 31, competition: 0.68 },
        },
      },
    ]);
    expect(rows[0]).toMatchObject({
      keyword: "CRM for agencies",
      monthlyVolume: 2400,
      cpcUsd: 31,
      source: "ranked_keywords",
    });
  });

  it("survives a response with nothing usable in it", () => {
    expect(parseKeywordsForSite([{}, { keyword: "  " }])).toEqual([]);
    expect(parseRankedKeywords([{}])).toEqual([]);
  });
});

describe("merging and the working set", () => {
  const row = (over: Partial<DiscoveredKeyword>): DiscoveredKeyword => ({
    keyword: "crm",
    monthlyVolume: 0,
    cpcUsd: 0,
    competition: 0,
    trendPercent: 0,
    intent: "commercial_investigation",
    providerIntent: null,
    source: "keywords_for_site",
    ...over,
  });

  it("dedupes on a normalised key", () => {
    expect(keywordKey("  Best  CRM ")).toBe("best crm");
    const merged = mergeKeywords(
      [row({ keyword: "Best CRM", monthlyVolume: 100 })],
      [row({ keyword: "best  crm", monthlyVolume: 900 })],
    );
    expect(merged).toHaveLength(1);
  });

  it("fills gaps rather than letting a duplicate zero a good keyword", () => {
    const merged = mergeKeywords(
      [row({ keyword: "crm", monthlyVolume: 5000, cpcUsd: 12, trendPercent: 0 })],
      [row({ keyword: "crm", monthlyVolume: 0, cpcUsd: 0, trendPercent: 25 })],
    );
    expect(merged[0].monthlyVolume).toBe(5000);
    expect(merged[0].cpcUsd).toBe(12);
    // A trend of exactly 0 means "we could not tell", so a real reading wins.
    expect(merged[0].trendPercent).toBe(25);
  });

  it("drops branded keywords, because the searcher already knows the brand", () => {
    expect(isNoise("acmecrm pricing", ALIASES)).toBe(true);
    expect(isNoise("Acme CRM login", ALIASES)).toBe(true);
  });

  it("KEEPS competitor-branded keywords — they are the best opportunities", () => {
    // THE WRONG NUMBER: the tool drops "HubSpot alternatives", which is the
    // single most valuable keyword shape it can find, because a filter written
    // for our own brand was applied to everyone's.
    expect(isNoise("HubSpot alternatives", ALIASES)).toBe(false);
    expect(isNoise("Salesforce vs Pipedrive", ALIASES)).toBe(false);
  });

  it("drops navigational shapes nobody can win", () => {
    expect(isNoise("crm customer service number", [])).toBe(true);
    expect(isNoise("crm careers", [])).toBe(true);
    expect(isNoise("best crm for startups", [])).toBe(false);
  });

  it("cuts to the working-set limit by volume, stably", () => {
    const many = Array.from({ length: 250 }, (_, i) =>
      row({ keyword: `keyword ${i}`, monthlyVolume: i }),
    );
    const set = selectWorkingSet(many, ALIASES);
    expect(set).toHaveLength(WORKING_SET_LIMIT);
    expect(set[0].monthlyVolume).toBe(249);
    // Same input, same hundred — an unstable cut would score a different set
    // each run for no reason the customer could see.
    expect(selectWorkingSet(many, ALIASES).map((r) => r.keyword)).toEqual(
      set.map((r) => r.keyword),
    );
  });
});

describe("the brand-naming filter on the live prompt path", () => {
  it("drops a generated prompt that names the brand", () => {
    // THE WRONG NUMBER: aiGap collapses toward zero on the keywords the tool
    // exists to surface, because the question handed the assistant the answer.
    const { kept, dropped } = withoutBrandNamedPrompts(
      [
        { text: "we're a small agency, what CRM should we use for client retainers?" },
        { text: "is AcmeCRM good for agencies?" },
      ],
      ALIASES,
    );
    expect(kept).toHaveLength(1);
    expect(dropped).toHaveLength(1);
  });

  it("has no exemption — there is no category that may name the brand here", () => {
    expect(withoutBrandNamedPrompts([{ text: "what is Acme CRM?" }], ALIASES).kept).toHaveLength(0);
  });

  it("refuses the batch when no alias was supplied, rather than passing it", () => {
    const { kept } = withoutBrandNamedPrompts([{ text: "best CRM for startups?" }], []);
    expect(kept).toHaveLength(0);
  });

  it("produces a fallback that cannot name the brand, by construction", () => {
    // The fallback is built from the keyword, and discovery has already dropped
    // every branded keyword — so a surviving keyword yields a safe prompt. This
    // is why a model returning nothing usable does not silently skip a keyword.
    const keyword = "best CRM for startups";
    expect(isNoise(keyword, ALIASES)).toBe(false);
    const prompt = fallbackPromptFor(keyword);
    expect(withoutBrandNamedPrompts([{ text: prompt }], ALIASES).kept).toHaveLength(1);
    expect(prompt.length).toBeGreaterThan(keyword.length);
  });
});

describe("why discovery produced nothing", () => {
  // THE BUG THIS GUARDS. The first dogfood run billed $0.024, scored zero
  // keywords, and recorded one sentence that fitted three different causes.
  // Diagnosis went to the provider; it could equally have been our own filter.
  const counts = (over: Partial<Parameters<typeof discoveryFailureReason>[1]> = {}) => ({
    keywordsForSite: 0,
    rankedKeywords: 0,
    tracked: 0,
    merged: 0,
    afterNoise: 0,
    kept: 0,
    ...over,
  });

  it("names the endpoints when they errored", () => {
    const reason = discoveryFailureReason("echorank360.com", counts(), ["labs/keywords_for_site"]);
    expect(reason).toMatch(/failed at labs\/keywords_for_site/);
  });

  it("says OUR filter ate it when discovery found plenty and kept none", () => {
    const reason = discoveryFailureReason(
      "echorank360.com",
      counts({ keywordsForSite: 200, merged: 200, afterNoise: 0 }),
      [],
    );
    expect(reason).toMatch(/all 200 discovered keywords were filtered as branded or navigational/);
    // Must NOT read as "the provider knows nothing about this domain".
    expect(reason).not.toMatch(/returned nothing/);
  });

  it("says the provider knew nothing when both endpoints came back empty", () => {
    const reason = discoveryFailureReason("echorank360.com", counts(), []);
    expect(reason).toMatch(/returned nothing for echorank360\.com/);
    expect(reason).not.toMatch(/filtered as branded/);
  });

  it("always carries the funnel, so the next reader does not have to guess", () => {
    for (const failed of [[], ["x"]]) {
      const reason = discoveryFailureReason("d.com", counts({ merged: 3, afterNoise: 1 }), failed);
      expect(reason).toMatch(/keywords_for_site \d+/);
      expect(reason).toMatch(/merged \d+/);
      expect(reason).toMatch(/after noise filter \d+/);
    }
  });
});
