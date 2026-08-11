// tests/ai-search-competitor-filter.test.ts
//
// The competitor classifier: every signal isolated, the threshold pinned, and
// the real dogfood entities classified.
//
// THE DOGFOOD CASES ARE THE POINT OF THIS FILE. A live checkup against Claude
// put ChatGPT, Perplexity, Gemini, Google Search Console and Bing Webmaster
// Tools in the competitor list of an AI-visibility product, alongside the three
// entities that genuinely are rivals. Those exact strings are the fixtures
// below, so the rules are measured against what a real model actually wrote
// rather than against what a rule author imagined it would write.

import { describe, expect, it } from "vitest";
import {
  CLASSIFIER_VERSION,
  GENERIC_TERMS,
  PLATFORM_DENYLIST,
  RIVAL_THRESHOLD,
  WEIGHTS,
  classifyEntity,
  hasToolPreposition,
  isRival,
  sentenceWindow,
} from "@/lib/ai-monitor/analysis/competitor-filter";

/** A context that scores exactly at the threshold on its own. */
const RANKED_COMMERCIAL = { position: 1, promptCategory: "COMPARISON" };

describe("the platform denylist", () => {
  it("catches the assistants an answer names because it is one", () => {
    for (const platform of ["ChatGPT", "Perplexity", "Gemini", "Claude", "Copilot"]) {
      expect(classifyEntity(platform, RANKED_COMMERCIAL).classification).toBe("PLATFORM");
    }
  });

  it("catches spacing and case variants through the 0.90 matcher", () => {
    // Equality matching would let "Chat GPT" through as a rival, which is the
    // exact noise this exists to remove.
    for (const variant of ["Chat GPT", "chatgpt", "CHATGPT", "Chat-GPT"]) {
      expect(classifyEntity(variant, RANKED_COMMERCIAL).classification).toBe("PLATFORM");
    }
  });

  it("catches the consoles an answer names as places to look", () => {
    for (const console of ["Google Search Console", "Google Analytics", "Bing Webmaster Tools"]) {
      expect(classifyEntity(console, RANKED_COMMERCIAL).classification).toBe("PLATFORM");
    }
  });

  it("is a hard stop that context cannot argue with", () => {
    // Even the strongest rival signals must not promote a platform.
    const result = classifyEntity("ChatGPT", {
      position: 1,
      promptCategory: "COMPARISON",
      rankedInPrompts: 5,
      context: "The best alternative to ChatGPT for this is...",
    });
    expect(result.classification).toBe("PLATFORM");
    expect(result.trace[0].signal).toBe("platform_denylist");
  });

  it("explains itself in words a customer can read", () => {
    expect(classifyEntity("Perplexity", {}).trace[0].why).toMatch(/assistant or platform/i);
  });
});

describe("generic terms", () => {
  it("rejects bare category words", () => {
    for (const term of ["SEO", "AI", "analytics", "marketing"]) {
      expect(classifyEntity(term, RANKED_COMMERCIAL).classification).toBe("GENERIC");
    }
  });

  it("is case-insensitive", () => {
    expect(classifyEntity("seo", RANKED_COMMERCIAL).classification).toBe("GENERIC");
  });

  it("rejects the brand's own category vocabulary", () => {
    // "AI visibility" is what the brand sells, not who it competes with.
    const result = classifyEntity("AI visibility management", {
      ...RANKED_COMMERCIAL,
      categoryVocabulary: ["AI visibility management"],
    });
    expect(result.classification).toBe("GENERIC");
  });

  it("does not reject a brand that merely contains a category word", () => {
    // "Search Atlas" is a company; "search" is not.
    expect(classifyEntity("Search Atlas", RANKED_COMMERCIAL).classification).toBe("RIVAL");
  });
});

describe("context cues", () => {
  const base = { promptCategory: null, position: null };

  it("adds for comparison language", () => {
    const result = classifyEntity("Semrush", {
      ...base,
      context: "If you want an alternative to Semrush, consider these.",
    });
    expect(result.score).toBe(WEIGHTS.comparisonLanguage);
    expect(result.classification).toBe("RIVAL");
  });

  it("recognises each comparison phrasing", () => {
    for (const phrase of [
      "an alternative to Semrush",
      "Semrush vs Ahrefs",
      "competitors of Semrush",
      "similar to Semrush",
      "instead of Semrush",
      "compared to Semrush",
    ]) {
      expect(classifyEntity("Semrush", { ...base, context: phrase }).score).toBeGreaterThanOrEqual(
        WEIGHTS.comparisonLanguage,
      );
    }
  });

  it("subtracts when the entity is the instrument, not the option", () => {
    // "using Semrush" is an instruction. Without this, every tool a reader is
    // told to use would be counted as a rival.
    const result = classifyEntity("Semrush", {
      ...base,
      context: "You can check this using Semrush or a similar crawler.",
    });
    expect(result.trace.some((t) => t.signal === "tool_preposition")).toBe(true);
    expect(result.classification).toBe("GENERIC");
  });

  it("only counts a preposition sitting immediately before the entity", () => {
    // "using it you can beat Semrush" is not Semrush-as-a-tool.
    expect(hasToolPreposition("using it you can beat Semrush", "Semrush")).toBe(false);
    expect(hasToolPreposition("track this using Semrush", "Semrush")).toBe(true);
  });

  it("adds for a place in the ranked recommendation list", () => {
    const result = classifyEntity("Profound", { ...base, position: 2 });
    expect(result.score).toBe(WEIGHTS.rankedRecommendation);
    expect(result.trace[0].why).toContain("position 2");
  });

  it("reuses the ranking pass rather than recomputing a position", () => {
    // position null means the answer named it in prose without ranking it.
    expect(classifyEntity("Profound", { ...base, position: null }).score).toBe(0);
  });
});

describe("prompt intent", () => {
  it("adds when the question was about choosing a product", () => {
    for (const category of ["DISCOVERY", "COMPARISON", "ALTERNATIVES", "PURCHASE"]) {
      const result = classifyEntity("Profound", { promptCategory: category });
      expect(result.score).toBe(WEIGHTS.commercialPrompt);
    }
  });

  it("subtracts when the question was about solving a problem", () => {
    for (const category of ["PROBLEM_SOLVING", "HOW_TO", "EDUCATION"]) {
      expect(classifyEntity("Profound", { promptCategory: category }).score).toBe(
        WEIGHTS.nonCommercialPrompt,
      );
    }
  });

  it("is neutral for a category it has no opinion about", () => {
    expect(classifyEntity("Profound", { promptCategory: "PRICING" }).score).toBe(0);
  });
});

describe("cross-run consistency", () => {
  it("adds when the entity is recommended for two or more questions", () => {
    expect(classifyEntity("Profound", { rankedInPrompts: 2 }).score).toBe(
      WEIGHTS.crossPromptConsistency,
    );
  });

  it("does not add for a single appearance", () => {
    expect(classifyEntity("Profound", { rankedInPrompts: 1 }).score).toBe(0);
  });
});

describe("the threshold", () => {
  it("is a rival at exactly the threshold, not just above it", () => {
    // position(1) + commercial(1) = 2.
    const result = classifyEntity("Profound", { position: 3, promptCategory: "COMPARISON" });
    expect(result.score).toBe(RIVAL_THRESHOLD);
    expect(result.classification).toBe("RIVAL");
  });

  it("is generic one point below", () => {
    const result = classifyEntity("Profound", { position: 3 });
    expect(result.score).toBe(RIVAL_THRESHOLD - 1);
    expect(result.classification).toBe("GENERIC");
  });

  it("lets a tool preposition pull a ranked commercial mention back down", () => {
    // ranked(+1) + commercial(+1) + tool(-2) = 0.
    const result = classifyEntity("Semrush", {
      position: 1,
      promptCategory: "COMPARISON",
      context: "You can measure this using Semrush.",
    });
    expect(result.score).toBe(0);
    expect(result.classification).toBe("GENERIC");
  });
});

describe("the real dogfood answers", () => {
  // Verbatim from the live checkup against Claude on 2026-08-11.
  const RIVALS = ["Profound", "Peec AI", "Otterly.AI", "Rankscale", "Athena"];
  const PLATFORMS = [
    "ChatGPT",
    "Perplexity",
    "Gemini",
    "Google AI Overviews",
    "Google Alerts",
    "Bing Webmaster Tools",
    "Google Search Console",
  ];

  it("classifies the genuine rivals as rivals", () => {
    for (const name of RIVALS) {
      const result = classifyEntity(name, {
        position: 2,
        promptCategory: "COMPARISON",
        rankedInPrompts: 3,
      });
      expect(result.classification, name).toBe("RIVAL");
    }
  });

  it("classifies the platforms out of the competitor list", () => {
    // Every one of these was in the top-10 competitors of an AI-visibility
    // product before this module existed.
    for (const name of PLATFORMS) {
      const result = classifyEntity(name, {
        position: 5,
        promptCategory: "COMPARISON",
        rankedInPrompts: 3,
      });
      expect(result.classification, name).toBe("PLATFORM");
    }
  });

  it("keeps Semrush and Ahrefs as rivals when the answer ranks them", () => {
    // They are real competitors in the adjacent category, and unlike the
    // platforms they are not in the denylist.
    for (const name of ["Semrush", "Ahrefs"]) {
      expect(
        classifyEntity(name, { position: 4, promptCategory: "DISCOVERY", rankedInPrompts: 2 })
          .classification,
      ).toBe("RIVAL");
    }
  });
});

describe("the record it leaves", () => {
  it("stamps the version beside every verdict", () => {
    // Same lesson as scoreVersion: rows written under old rules keep meaning
    // what they meant, and re-classifying is an explicit new version.
    expect(classifyEntity("Profound", {}).classifierVersion).toBe(CLASSIFIER_VERSION);
    expect(classifyEntity("ChatGPT", {}).classifierVersion).toBe(CLASSIFIER_VERSION);
  });

  it("traces every signal that fired, for the UI to show", () => {
    const result = classifyEntity("Semrush", {
      position: 1,
      promptCategory: "COMPARISON",
      rankedInPrompts: 4,
      context: "A good alternative to Semrush is...",
    });
    expect(result.trace.map((t) => t.signal).sort()).toEqual([
      "commercial_prompt",
      "comparison_language",
      "cross_prompt_consistency",
      "ranked_recommendation",
    ]);
    // The deltas must account for the score exactly, or the explanation is a
    // story rather than a record.
    expect(result.trace.reduce((total, t) => total + t.delta, 0)).toBe(result.score);
  });

  it("survives an empty or whitespace entity", () => {
    expect(classifyEntity("").classification).toBe("GENERIC");
    expect(classifyEntity("   ").classification).toBe("GENERIC");
  });
});

describe("the lists are config, in one place", () => {
  it("keeps the denylist and generic terms non-empty and de-duplicated", () => {
    expect(PLATFORM_DENYLIST.length).toBeGreaterThan(10);
    expect(new Set(PLATFORM_DENYLIST.map((t) => t.toLowerCase())).size).toBe(
      PLATFORM_DENYLIST.length,
    );
    expect(new Set(GENERIC_TERMS.map((t) => t.toLowerCase())).size).toBe(GENERIC_TERMS.length);
  });

  it("only rivals reach the rollup", () => {
    expect(isRival("RIVAL")).toBe(true);
    expect(isRival("PLATFORM")).toBe(false);
    expect(isRival("GENERIC")).toBe(false);
  });
});

describe("the sentence window", () => {
  it("takes the sentence around the mention and its neighbours", () => {
    const text = "First sentence. Semrush is mentioned here. Third one. Fourth one.";
    const window = sentenceWindow(text, "Semrush");
    expect(window).toContain("First sentence");
    expect(window).toContain("Semrush is mentioned");
    expect(window).toContain("Third one");
    expect(window).not.toContain("Fourth one");
  });

  it("returns nothing when the entity is absent", () => {
    expect(sentenceWindow("No mention here.", "Semrush")).toBe("");
  });
});
