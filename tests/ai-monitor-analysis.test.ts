// The deterministic pass over an AI answer, and the validation of the LLM
// pass's JSON.
//
// The false positive these tests exist to prevent is a substring match: a brand
// called "Ada" appearing to be mentioned in every answer that says "Canada"
// would inflate mention rate and visibility score together, and would look like
// success rather than like a bug.
import { describe, it, expect } from "vitest";
import {
  analyseDeterministic,
  citedDomainsIn,
  firstListPosition,
  fold,
  foldWithMap,
  findNameHits,
  type BrandMatcher,
} from "@/lib/ai-monitor/analysis/deterministic";
import { parseLlmAnalysis } from "@/lib/ai-monitor/analysis/llm";

const BRAND: BrandMatcher = {
  names: ["Echorank", "Echorank360"],
  domain: "echorank360.com",
  competitors: ["Semrush", "Ahrefs"],
};

describe("name matching", () => {
  it("does not match a brand name inside a longer word", () => {
    expect(findNameHits(fold("I flew to Canada last week."), ["Ada"])).toHaveLength(0);
    expect(findNameHits(fold("Ada is a good tool."), ["Ada"])).toHaveLength(1);
  });

  it("matches across accents and case", () => {
    // A French answer writes "Écho" where the brand registered "Echo".
    expect(findNameHits(fold("Essayez Écho pour cela."), ["Echo"])).toHaveLength(1);
    expect(findNameHits(fold("ECHORANK is listed."), ["Echorank"])).toHaveLength(1);
  });

  it("does not double-count overlapping aliases", () => {
    // "Echorank" and "Echorank360" both match the same words; the sentence was
    // one mention, not two.
    const hits = findNameHits(fold("Echorank360 is a tool."), ["Echorank", "Echorank360"]);
    expect(hits).toHaveLength(1);
  });

  it("does not treat a digit suffix as a word boundary", () => {
    expect(findNameHits(fold("Echorank3600 is unrelated."), ["Echorank360"])).toHaveLength(0);
  });

  it("keeps folded indices pointing at the original string", () => {
    const source = "Café Echorank";
    const { text, map } = foldWithMap(source);
    const hit = findNameHits(text, ["Echorank"])[0];
    // Folding "é" must not shift the index of what follows it.
    expect(source.slice(map[hit.start], map[hit.end - 1] + 1)).toBe("Echorank");
  });
});

describe("list position", () => {
  it("finds a 1-based position in a numbered list", () => {
    const answer = ["1. Semrush", "2. Echorank", "3. Ahrefs"].join("\n");
    expect(firstListPosition(answer, BRAND.names)).toBe(2);
  });

  it("handles bulleted lists", () => {
    const answer = ["- Ahrefs", "- Echorank"].join("\n");
    expect(firstListPosition(answer, BRAND.names)).toBe(2);
  });

  it("reads the FIRST list only", () => {
    // A ranking followed by an unrelated list of caveats must not let the
    // caveats overwrite a genuine placement.
    const answer = [
      "1. Echorank",
      "2. Semrush",
      "",
      "Some caveats to consider:",
      "",
      "- Pricing varies",
      "- Ahrefs has more data",
      "- Echorank is newer",
    ].join("\n");
    expect(firstListPosition(answer, BRAND.names)).toBe(1);
  });

  it("returns null for a prose-only mention", () => {
    expect(firstListPosition("Echorank is worth a look.", BRAND.names)).toBeNull();
  });
});

describe("citations", () => {
  it("extracts registrable domains from URLs and bare mentions, deduped", () => {
    const answer = "See https://www.echorank360.com/pricing and also ahrefs.com for detail.";
    expect(citedDomainsIn(answer)).toEqual(["echorank360.com", "ahrefs.com"]);
  });

  it("does not mistake abbreviations or version numbers for domains", () => {
    expect(citedDomainsIn("e.g. version 3.5, i.e. the newer one")).toEqual([]);
  });

  it("survives a domain at the end of a sentence", () => {
    expect(citedDomainsIn("Read more at echorank360.com.")).toEqual(["echorank360.com"]);
  });
});

describe("the full deterministic pass", () => {
  it("reads a ranked, cited, competitive answer", () => {
    const answer = [
      "Here are the top tools:",
      "",
      "1. Semrush — the incumbent",
      "2. Echorank — strong on AI visibility, see https://echorank360.com",
      "3. Ahrefs — best backlink index",
      "",
      "Echorank is the newest of the three.",
    ].join("\n");

    const result = analyseDeterministic(answer, BRAND);
    expect(result.brandMentioned).toBe(true);
    // Two prose mentions. The https://echorank360.com link is NOT a third:
    // it is a citation, already worth 15 points in its own component, and
    // counting it here would score the same fact twice.
    expect(result.mentionCount).toBe(2);
    expect(result.listPosition).toBe(2);
    expect(result.competitorNames).toEqual(["Semrush", "Ahrefs"]);
    expect(result.citedOwnDomain).toBe(true);
    expect(result.contextSnippets).toHaveLength(2);
  });

  it("does not count a bare-domain citation as a prose mention either", () => {
    const result = analyseDeterministic("Try echorank360.com for this.", BRAND);
    expect(result.mentionCount).toBe(0);
    expect(result.brandMentioned).toBe(false);
    // ...but it is still a citation, and still the brand's own domain.
    expect(result.citedOwnDomain).toBe(true);
  });

  it("cuts snippets from the original text, accents intact", () => {
    const answer = "La société Echorank est basée à Montréal.";
    const [snippet] = analyseDeterministic(answer, BRAND).contextSnippets;
    expect(snippet).toContain("société");
    expect(snippet).toContain("Montréal");
  });

  it("reports an unmentioned brand without inventing a position", () => {
    const result = analyseDeterministic("Semrush and Ahrefs lead the market.", BRAND);
    expect(result.brandMentioned).toBe(false);
    expect(result.mentionCount).toBe(0);
    expect(result.listPosition).toBeNull();
    expect(result.contextSnippets).toEqual([]);
    // Competitors are still recorded — who won when we lost is the finding.
    expect(result.competitorNames).toEqual(["Semrush", "Ahrefs"]);
  });

  it("treats an empty answer as a real outcome, not an error", () => {
    const result = analyseDeterministic("", BRAND);
    expect(result.brandMentioned).toBe(false);
    expect(result.citedDomains).toEqual([]);
  });

  it("does not claim an own-domain citation when the brand has no domain", () => {
    const result = analyseDeterministic("Echorank, see echorank360.com", {
      ...BRAND,
      domain: null,
    });
    expect(result.citedOwnDomain).toBe(false);
    expect(result.citedDomains).toEqual(["echorank360.com"]);
  });
});

describe("LLM response validation", () => {
  const good = JSON.stringify({
    recommended: true,
    recommendationStrength: 0.8,
    sentiment: "positive",
    quotedDescription: "a strong choice for AI visibility",
    factualClaims: ["Founded in 2024"],
    possibleInaccuracies: [],
    confidence: 0.9,
  });

  it("parses a well-formed object", () => {
    expect(parseLlmAnalysis(good)).toEqual({
      recommended: true,
      recommendationStrength: 0.8,
      sentiment: "positive",
      quotedDescription: "a strong choice for AI visibility",
      factualClaims: ["Founded in 2024"],
      possibleInaccuracies: [],
      confidence: 0.9,
    });
  });

  it("unwraps a markdown code fence", () => {
    expect(parseLlmAnalysis("```json\n" + good + "\n```")?.recommended).toBe(true);
  });

  it("forces strength to 0 when the model contradicts itself", () => {
    const contradictory = JSON.stringify({
      recommended: false,
      recommendationStrength: 0.9,
      sentiment: "positive",
      confidence: 1,
    });
    expect(parseLlmAnalysis(contradictory)?.recommendationStrength).toBe(0);
  });

  it("falls back to neutral for an unknown sentiment label", () => {
    expect(parseLlmAnalysis(JSON.stringify({ sentiment: "enthusiastic" }))?.sentiment).toBe(
      "neutral",
    );
  });

  it("clamps out-of-range confidence rather than trusting it", () => {
    expect(parseLlmAnalysis(JSON.stringify({ confidence: 42 }))?.confidence).toBe(1);
    expect(parseLlmAnalysis(JSON.stringify({ confidence: "high" }))?.confidence).toBe(0.5);
  });

  it("drops non-string entries from the claim arrays", () => {
    const messy = JSON.stringify({ factualClaims: ["real", 7, null, "  "] });
    expect(parseLlmAnalysis(messy)?.factualClaims).toEqual(["real"]);
  });

  it("returns null for anything that is not a JSON object", () => {
    // A garbled response must degrade the one response, not fail the checkup.
    for (const bad of ["not json", "[1,2,3]", "null", '"a string"', ""]) {
      expect(parseLlmAnalysis(bad)).toBeNull();
    }
  });
});
