// tests/ai-search-prompts.test.ts
//
// The prompt taxonomy, the commercial-value arithmetic, and the selection rule
// that decides which questions a tenant actually pays to track.
//
// These are the numbers a customer argues with. Every weight that can change a
// ranking is exercised here, because a weight nobody can observe is a weight
// nobody can trust — the same standard tests/ai-monitor-scoring.test.ts holds
// the visibility weights to.

import { describe, expect, it } from "vitest";
import {
  CATEGORY_SPECS,
  DEMAND_WEIGHT,
  INITIAL_CATEGORY_ORDER,
  INTENT_MULTIPLIERS,
  PROMPT_CATEGORIES,
  commercialValue,
  isPromptCategory,
  isPromptIntent,
} from "@/lib/ai-monitor/prompts/categories";
import {
  promptKey,
  selectInitialPrompts,
  type GeneratedPrompt,
} from "@/lib/ai-monitor/prompts/generate";

const prompt = (
  text: string,
  category: GeneratedPrompt["category"],
  intent: GeneratedPrompt["intent"] = "commercial",
): GeneratedPrompt => ({ text, category, intent, audience: null });

describe("taxonomy", () => {
  it("carries a spec for every category, keyed to itself", () => {
    for (const category of PROMPT_CATEGORIES) {
      const spec = CATEGORY_SPECS[category];
      expect(spec).toBeDefined();
      expect(spec.category).toBe(category);
      expect(spec.guidance.length).toBeGreaterThan(20);
    }
  });

  it("keeps every category the setup wizard already writes", () => {
    // These ten values exist in tracked_prompts rows today. Dropping one would
    // silently reinterpret stored data as uncategorised.
    const existing = [
      "DISCOVERY", "RECOMMENDATION", "COMPARISON", "ALTERNATIVES", "PRICING",
      "USE_CASE", "FEATURES", "TRUST", "PURCHASE", "BRAND_AWARENESS",
    ];
    for (const category of existing) expect(isPromptCategory(category)).toBe(true);
  });

  it("covers the whole funnel in the initial order, without repeats", () => {
    expect(new Set(INITIAL_CATEGORY_ORDER).size).toBe(INITIAL_CATEGORY_ORDER.length);
    expect([...INITIAL_CATEGORY_ORDER].sort()).toEqual([...PROMPT_CATEGORIES].sort());
  });

  it("rejects labels outside the vocabulary", () => {
    expect(isPromptCategory("BEST_PRODUCTS")).toBe(false);
    expect(isPromptIntent("transactional")).toBe(false);
    expect(isPromptIntent("commercial")).toBe(true);
  });
});

describe("commercial value", () => {
  it("ranks the funnel: purchase over discovery over education", () => {
    const purchase = commercialValue({ category: "PURCHASE" });
    const discovery = commercialValue({ category: "DISCOVERY" });
    const education = commercialValue({ category: "EDUCATION" });
    expect(purchase).toBeGreaterThan(discovery);
    expect(discovery).toBeGreaterThan(education);
  });

  it("never scores a real category at zero", () => {
    // Education is worth less than purchase intent, not worth nothing: being
    // the answer to "what is X" is how a brand becomes the default later.
    for (const category of PROMPT_CATEGORIES) {
      expect(commercialValue({ category })).toBeGreaterThan(0);
    }
  });

  it("discounts a navigational question below a commercial one", () => {
    const commercial = commercialValue({ category: "DISCOVERY", intent: "commercial" });
    const navigational = commercialValue({ category: "DISCOVERY", intent: "navigational" });
    expect(navigational).toBeLessThan(commercial);
    expect(INTENT_MULTIPLIERS.navigational).toBeLessThan(INTENT_MULTIPLIERS.commercial);
  });

  it("falls back to the category's own intent when none is given", () => {
    const spec = CATEGORY_SPECS.BRAND_AWARENESS;
    expect(commercialValue({ category: "BRAND_AWARENESS" })).toBe(
      commercialValue({ category: "BRAND_AWARENESS", intent: spec.defaultIntent }),
    );
  });

  it("adds demand as a bonus, bounded by DEMAND_WEIGHT", () => {
    const base = commercialValue({ category: "USE_CASE" });
    const withDemand = commercialValue({ category: "USE_CASE", searchVolume: 50_000 });
    expect(withDemand).toBeGreaterThan(base);
    expect(withDemand - base).toBeLessThanOrEqual(DEMAND_WEIGHT);
  });

  it("treats demand logarithmically, not linearly", () => {
    // 100 -> 1,000 must matter more than 50,000 -> 51,000, or one viral
    // keyword would outrank every genuinely commercial question.
    const low = commercialValue({ category: "USE_CASE", searchVolume: 100 });
    const mid = commercialValue({ category: "USE_CASE", searchVolume: 1_000 });
    const high = commercialValue({ category: "USE_CASE", searchVolume: 50_000 });
    const veryHigh = commercialValue({ category: "USE_CASE", searchVolume: 51_000 });
    expect(mid - low).toBeGreaterThan(veryHigh - high);
  });

  it("ignores demand that is absent, zero or nonsense", () => {
    const base = commercialValue({ category: "TRUST" });
    for (const volume of [null, undefined, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(commercialValue({ category: "TRUST", searchVolume: volume })).toBeLessThanOrEqual(
        base + DEMAND_WEIGHT,
      );
    }
    expect(commercialValue({ category: "TRUST", searchVolume: 0 })).toBe(base);
    expect(commercialValue({ category: "TRUST", searchVolume: -5 })).toBe(base);
  });

  it("stays inside 0-100 for every combination", () => {
    for (const category of PROMPT_CATEGORIES) {
      for (const intent of ["commercial", "research", "navigational"] as const) {
        const value = commercialValue({ category, intent, searchVolume: 10_000_000 });
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("near-duplicate detection", () => {
  it("collapses word order and punctuation", () => {
    expect(promptKey("What is the best CRM for a small team?")).toBe(
      promptKey("For a small team, what's the best CRM"),
    );
  });

  it("folds accents, so a French answer does not split a prompt in two", () => {
    expect(promptKey("meilleur logiciel de caisse")).toBe(
      promptKey("MEILLEUR LOGICIEL DE CAISSÉ"),
    );
  });

  it("keeps genuinely different questions apart", () => {
    expect(promptKey("best CRM for small teams")).not.toBe(
      promptKey("best CRM for enterprise teams"),
    );
  });

  it("returns an empty key for a prompt that is nothing but filler", () => {
    // Empty keys are dropped by the selector rather than colliding with each
    // other — otherwise two junk prompts would look like duplicates of one.
    expect(promptKey("what is the a an")).toBe("");
    expect(promptKey("???")).toBe("");
  });
});

describe("initial selection", () => {
  const wideCandidates: GeneratedPrompt[] = [
    prompt("who should we buy from right now", "PURCHASE"),
    prompt("which one would you recommend for a two-person shop", "RECOMMENDATION"),
    prompt("is Toast better than Square for a cafe", "COMPARISON"),
    prompt("what can we use instead of Toast", "ALTERNATIVES"),
    prompt("what are the best tills for a small cafe", "DISCOVERY"),
    prompt("how much does a POS usually cost", "PRICING"),
    prompt("are these systems actually any good", "TRUST", "research"),
    prompt("what suits a food truck", "USE_CASE", "research"),
    prompt("our queue is too slow at lunch, what helps", "PROBLEM_SOLVING", "research"),
    prompt("does it do split bills", "FEATURES", "research"),
  ];

  it("spreads the first set across the funnel instead of taking the top scores", () => {
    // The failure this prevents: sorting by commercialValue and taking the top
    // five gives five bottom-of-funnel prompts, and the report can then say
    // nothing about why the brand never enters the conversation earlier.
    const selected = selectInitialPrompts(wideCandidates, { limit: 5 });
    expect(selected.length).toBe(5);
    expect(new Set(selected.map((p) => p.category)).size).toBe(5);
  });

  it("follows the initial category order when it cannot take everything", () => {
    const selected = selectInitialPrompts(wideCandidates, { limit: 3 });
    expect(selected.map((p) => p.category)).toEqual([
      "DISCOVERY",
      "RECOMMENDATION",
      "COMPARISON",
    ]);
  });

  it("prefers the most valuable question within a category", () => {
    const selected = selectInitialPrompts(
      [
        prompt("cheapest option", "DISCOVERY", "navigational"),
        prompt("best option for a busy cafe", "DISCOVERY", "commercial"),
      ],
      { limit: 1 },
    );
    expect(selected[0].text).toBe("best option for a busy cafe");
  });

  it("drops duplicates within the batch", () => {
    const selected = selectInitialPrompts(
      [
        prompt("what is the best CRM for a small team", "DISCOVERY"),
        prompt("For a small team, what's the best CRM?", "DISCOVERY"),
      ],
      { limit: 5 },
    );
    expect(selected.length).toBe(1);
  });

  it("drops candidates the brand already tracks", () => {
    const existing = new Set([promptKey("what are the best tills for a small cafe")]);
    const selected = selectInitialPrompts(wideCandidates, { limit: 10, existingKeys: existing });
    expect(selected.map((p) => p.text)).not.toContain("what are the best tills for a small cafe");
  });

  it("returns everything it has when the limit exceeds the pool", () => {
    const selected = selectInitialPrompts(wideCandidates, { limit: 50 });
    expect(selected.length).toBe(wideCandidates.length);
  });

  it("keeps categories the order does not name rather than discarding paid work", () => {
    const selected = selectInitialPrompts(wideCandidates, {
      limit: 10,
      categoryOrder: ["DISCOVERY"],
    });
    expect(selected.length).toBe(wideCandidates.length);
    expect(selected[0].category).toBe("DISCOVERY");
  });

  it("terminates on an empty pool", () => {
    expect(selectInitialPrompts([], { limit: 10 })).toEqual([]);
  });

  it("scores every prompt it returns", () => {
    for (const selected of selectInitialPrompts(wideCandidates, { limit: 10 })) {
      expect(selected.commercialValue).toBeGreaterThan(0);
    }
  });
});
