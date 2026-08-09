// tests/ai-search-engines.test.ts
//
// The engine catalogue and its availability rules.
//
// THE ONE RULE WORTH REGRESSION-TESTING: a missing API key disables an engine
// and never throws. Eight providers is eight chances for a worker to die at
// boot, and a dead worker takes every other provider's checkups with it.

import { describe, expect, it } from "vitest";
import {
  ENGINE_CATALOGUE,
  availableEngines,
  engineAvailability,
  engineFor,
  engineReadiness,
  enginesForCheckup,
  modelFor,
} from "@/lib/ai-monitor/engines";
import { AI_PROVIDERS, TOKEN_FREE_PROVIDERS } from "@/lib/ai-monitor/pricing";

/**
 * Build an env fixture.
 *
 * NODE_ENV is declared required on ProcessEnv in this project's ambient types,
 * so a bare object literal will not typecheck. It plays no part in engine
 * availability — the helper just satisfies the type.
 */
function env(vars: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...vars } as NodeJS.ProcessEnv;
}

/** A box with nothing configured. */
const BARE = env();

/** Anthropic and OpenAI keys only — this box, as it stands today. */
const TWO_KEYS = env({
  ANTHROPIC_API_KEY: "sk-ant-test",
  OPENAI_API_KEY: "sk-test",
});

const EVERYTHING = env({
  ANTHROPIC_API_KEY: "sk-ant-test",
  OPENAI_API_KEY: "sk-test",
  GEMINI_API_KEY: "g",
  PERPLEXITY_API_KEY: "p",
  XAI_API_KEY: "x",
  MISTRAL_API_KEY: "m",
  LLAMA_API_HOST: "http://127.0.0.1:8000",
  DATAFORSEO_LOGIN: "l",
  DATAFORSEO_PASSWORD: "p",
});

describe("catalogue integrity", () => {
  it("names only providers the pricing table knows", () => {
    for (const spec of ENGINE_CATALOGUE) {
      expect(AI_PROVIDERS).toContain(spec.provider);
    }
  });

  it("has one entry per provider, so availability is unambiguous", () => {
    const providers = ENGINE_CATALOGUE.map((spec) => spec.provider);
    expect(new Set(providers).size).toBe(providers.length);
  });

  it("covers every provider the pricing table knows", () => {
    // A provider that can be METERED but never QUERIED is a row nobody can
    // explain: spend would appear against an engine with no dashboard column.
    for (const provider of AI_PROVIDERS) {
      expect(engineFor(provider)).not.toBeNull();
    }
  });

  it("pins a model for every engine", () => {
    for (const spec of ENGINE_CATALOGUE) {
      expect(spec.modelName.length).toBeGreaterThan(0);
      expect(modelFor(spec.provider)).toBe(spec.modelName);
    }
  });

  it("never claims citations from an engine that cannot search", () => {
    // Citations come from retrieved pages. An engine answering purely from
    // training data has nothing to cite, and a catalogue claiming otherwise
    // would make citationRate look measurable when it is not.
    for (const spec of ENGINE_CATALOGUE) {
      if (spec.supportsCitations) expect(spec.supportsSearch).toBe(true);
    }
  });

  it("orders every engine distinctly, so the table does not reshuffle", () => {
    const orders = ENGINE_CATALOGUE.map((spec) => spec.sortOrder);
    expect(new Set(orders).size).toBe(orders.length);
  });
});

describe("availability", () => {
  it("disables an engine whose key is missing rather than throwing", () => {
    for (const provider of AI_PROVIDERS) {
      const result = engineAvailability(provider, BARE);
      expect(result.available).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
    }
    expect(availableEngines(BARE)).toEqual([]);
  });

  it("treats an empty-string key as missing, not as set", () => {
    // A .env line left as `GEMINI_API_KEY=` is the most common way this fails,
    // and truthiness alone would let it through to a 401 in a worker.
    const result = engineAvailability("GEMINI", env({ GEMINI_API_KEY: "   " }));
    expect(result.available).toBe(false);
    expect(result.reason).toBe("missing_key");
  });

  it("needs every required var, not just the key", () => {
    // Llama needs a host; a key alone says nothing about where to send it.
    expect(engineAvailability("LLAMA", env({ LLAMA_API_HOST: "" })).available).toBe(false);
    expect(engineAvailability("LLAMA", env({ LLAMA_API_HOST: "http://x" })).available).toBe(true);
  });

  it("enables Google AI Overviews on DataForSEO credentials, which are a pair", () => {
    expect(engineAvailability("GOOGLE_AI_OVERVIEWS", env({ DATAFORSEO_LOGIN: "l" })).available).toBe(
      false,
    );
    expect(
      engineAvailability("GOOGLE_AI_OVERVIEWS", env({
        DATAFORSEO_LOGIN: "l",
        DATAFORSEO_PASSWORD: "p",
      })).available,
    ).toBe(true);
  });

  it("returns available engines in catalogue order", () => {
    const available = availableEngines(EVERYTHING);
    expect(available.length).toBe(ENGINE_CATALOGUE.length);
    const orders = available.map((spec) => spec.sortOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("honours the operator kill switch", () => {
    const available = availableEngines(EVERYTHING, new Set(["CHATGPT"]));
    expect(available.map((spec) => spec.provider)).not.toContain("CHATGPT");
  });
});

describe("per-tier engine selection", () => {
  it("gives an unlimited tier every reachable engine", () => {
    expect(enginesForCheckup(null, TWO_KEYS).map((spec) => spec.provider)).toEqual([
      "CHATGPT",
      "CLAUDE",
    ]);
  });

  it("takes an allowance from the head of the catalogue, stably", () => {
    // Stability is the point. A tier's two engines have to be the SAME two
    // every week, or the week-on-week visibility score compares two different
    // measurements and the trend line is fiction.
    const first = enginesForCheckup(2, EVERYTHING).map((spec) => spec.provider);
    const second = enginesForCheckup(2, EVERYTHING).map((spec) => spec.provider);
    expect(first).toEqual(second);
    expect(first).toEqual(["CHATGPT", "GOOGLE_AI_OVERVIEWS"]);
  });

  it("gives a tier fewer engines than it bought when keys are missing", () => {
    // AGENCY buys every provider; a box with two keys has two. The dashboard
    // must show two, not six with four silent zeros.
    expect(enginesForCheckup(null, TWO_KEYS).length).toBe(2);
    expect(enginesForCheckup(6, TWO_KEYS).length).toBe(2);
  });

  it("returns nothing for an allowance of zero rather than everything", () => {
    expect(enginesForCheckup(0, EVERYTHING)).toEqual([]);
  });
});

describe("readiness reporting", () => {
  it("flags an engine that is reachable but would meter at zero", () => {
    // The dangerous state: the key is set, so calls happen and cost money, but
    // no rates are configured, so the monthly cap never sees the spend.
    const gemini = engineReadiness(EVERYTHING).find((row) => row.provider === "GEMINI");
    expect(gemini?.available).toBe(true);
    expect(gemini?.unpriced).toBe(true);
  });

  it("does not flag an engine that ships with rates", () => {
    const claude = engineReadiness(EVERYTHING).find((row) => row.provider === "CLAUDE");
    expect(claude?.available).toBe(true);
    expect(claude?.unpriced).toBe(false);
  });

  it("does not flag a provider that is not token-billed at all", () => {
    const overviews = engineReadiness(EVERYTHING).find(
      (row) => row.provider === "GOOGLE_AI_OVERVIEWS",
    );
    expect(TOKEN_FREE_PROVIDERS.has("GOOGLE_AI_OVERVIEWS")).toBe(true);
    expect(overviews?.unpriced).toBe(false);
  });

  it("never calls an unavailable engine unpriced — it is simply off", () => {
    for (const row of engineReadiness(BARE)) {
      expect(row.available).toBe(false);
      expect(row.unpriced).toBe(false);
    }
  });
});
