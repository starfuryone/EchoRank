// The AI Visibility monitor's cost arithmetic and monthly cap.
//
// These tests guard the two ways cost metering fails silently. First, a swapped
// input/output rate: the token counts here are deliberately ASYMMETRIC, so
// transposing the two rates changes every expected figure rather than passing
// by luck. Second, an unpriced provider: the flip-a-provider-on-by-adding-a-key
// design means a key can arrive without a rate, and the tests below pin that
// this reports itself instead of metering the calls at zero.
import { describe, it, expect } from "vitest";
import type { PlanType } from "@/generated/prisma";
import {
  AI_PROVIDERS,
  DEFAULT_RATES,
  TOKEN_FREE_PROVIDERS,
  costUsdFor,
  parseRates,
  rateEnvName,
  ratesFor,
  roundUsd,
  unpricedProviders,
  type AiProvider,
} from "@/lib/ai-monitor/pricing";
import { capState } from "@/lib/ai-monitor/cap";
import { PLAN_CONFIGS, type SellablePlanType } from "@/lib/plan-config";
import { hasFeature } from "@/lib/feature-flags";

/** An env with nothing configured — the built-in table only. */
const BARE = {} as NodeJS.ProcessEnv;

describe("token pricing", () => {
  it("prices Haiku 4.5 at its published $1/$5 per MTok", () => {
    // 300 in / 600 out: 0.0003 + 0.003. Asymmetric, so swapping the rates
    // would give 0.0015 + 0.0006 = 0.0021 and fail.
    const { costUsd, priced } = costUsdFor(
      "CLAUDE",
      "claude-haiku-4-5",
      { inputTokens: 300, outputTokens: 600, cachedInputTokens: 0 },
      BARE,
    );
    expect(priced).toBe(true);
    expect(costUsd).toBe(0.0033);
  });

  it("bills cached input at the cache rate and does not also count it as input", () => {
    // 1000 cached at $0.10/MTok = $0.0001. Counting it as input too would give
    // $0.0011, and counting it ONLY as input would give $0.001.
    const { costUsd } = costUsdFor(
      "CLAUDE",
      "claude-haiku-4-5",
      { inputTokens: 0, outputTokens: 0, cachedInputTokens: 1000 },
      BARE,
    );
    expect(costUsd).toBe(0.0001);
  });

  it("rounds to Decimal(10,6), the column's precision", () => {
    expect(roundUsd(0.00000049)).toBe(0);
    expect(roundUsd(0.0000005)).toBe(0.000001);
    expect(roundUsd(1.2345674)).toBe(1.234567);
  });
});

describe("rate configuration", () => {
  it("parses the three-value form", () => {
    expect(parseRates("1,5,0.1")).toEqual({
      inputPerMTok: 1,
      outputPerMTok: 5,
      cachedInputPerMTok: 0.1,
    });
  });

  it("defaults cached input to a tenth of input in the two-value form", () => {
    expect(parseRates("3,15")).toEqual({
      inputPerMTok: 3,
      outputPerMTok: 15,
      cachedInputPerMTok: 0.3,
    });
  });

  it("treats a malformed value as unconfigured, never as zero", () => {
    // Zero rates would make every call look free and quietly disable the cap.
    for (const bad of ["", "1", "1,2,3,4", "abc,5", "1,-5", undefined]) {
      expect(parseRates(bad)).toBeNull();
    }
  });

  it("lets env override the built-in table without a deploy", () => {
    const env = { [rateEnvName("CLAUDE")]: "2,10,0.2" } as NodeJS.ProcessEnv;
    expect(ratesFor("CLAUDE", "claude-haiku-4-5", env)).toEqual({
      inputPerMTok: 2,
      outputPerMTok: 10,
      cachedInputPerMTok: 0.2,
    });
    // ...and the built-in value is what applies when it is not set.
    expect(ratesFor("CLAUDE", "claude-haiku-4-5", BARE)?.inputPerMTok).toBe(1);
  });

  it("prices a provider the built-in table has never heard of, from env alone", () => {
    // This is the whole flip-on-by-key contract: a key plus AI_RATES_<P> is
    // enough, with no entry in DEFAULT_RATES and no code change.
    const env = { [rateEnvName("GEMINI")]: "0.5,2" } as NodeJS.ProcessEnv;
    const { costUsd, priced } = costUsdFor(
      "GEMINI",
      "some-future-model",
      { inputTokens: 1_000_000, outputTokens: 1_000_000, cachedInputTokens: 0 },
      env,
    );
    expect(priced).toBe(true);
    expect(costUsd).toBe(2.5);
  });
});

describe("unpriced providers are reported, not silently free", () => {
  it("flags a call with no rates instead of costing it at zero", () => {
    const { costUsd, priced } = costUsdFor(
      "GROK",
      "grok-whatever",
      { inputTokens: 500_000, outputTokens: 500_000, cachedInputTokens: 0 },
      BARE,
    );
    expect(priced).toBe(false);
    expect(costUsd).toBe(0);
  });

  it("names exactly the providers whose spend would be invisible", () => {
    const env = { [rateEnvName("MISTRAL")]: "0.2,0.6" } as NodeJS.ProcessEnv;
    const models: Record<string, string> = { CLAUDE: "claude-haiku-4-5" };
    const missing = unpricedProviders(
      ["CLAUDE", "MISTRAL", "GROK", "GOOGLE_AI_OVERVIEWS"],
      (p) => models[p] ?? "default-model",
      env,
    );
    // CLAUDE ships with rates, MISTRAL got them from env, and Google AI
    // Overviews is not token-billed at all — only GROK is unaccounted for.
    expect(missing).toEqual(["GROK"]);
  });

  it("does not let an unknown Claude model inherit a known one's rates", () => {
    // Rates are keyed per model with no wildcard, so switching the analysis
    // pass to a newer Claude reports itself as unpriced rather than quietly
    // billing Opus work at Haiku prices. Adding the model to DEFAULT_RATES (or
    // setting AI_RATES_CLAUDE) is the deliberate act that turns it back on.
    expect(ratesFor("CLAUDE", "claude-haiku-4-5", BARE)).not.toBeNull();
    expect(ratesFor("CLAUDE", "claude-next-unreleased", BARE)).toBeNull();
  });

  it("does not price Google AI Overviews from tokens — its cost is DataForSEO's", () => {
    const { costUsd, priced } = costUsdFor(
      "GOOGLE_AI_OVERVIEWS",
      "serp",
      { inputTokens: 9_999, outputTokens: 9_999, cachedInputTokens: 0 },
      BARE,
    );
    expect(priced).toBe(true);
    expect(costUsd).toBe(0);
    expect(TOKEN_FREE_PROVIDERS.has("GOOGLE_AI_OVERVIEWS")).toBe(true);
  });

  it("ships rates for every model the built-in table claims to know", () => {
    for (const [key, rates] of Object.entries(DEFAULT_RATES)) {
      const [provider, model] = key.split(":");
      expect(AI_PROVIDERS).toContain(provider as AiProvider);
      expect(rates.outputPerMTok).toBeGreaterThan(0);
      // Cache reads are cheaper than fresh input on every vendor that has them.
      expect(rates.cachedInputPerMTok).toBeLessThan(rates.inputPerMTok);
      expect(model.length).toBeGreaterThan(0);
    }
  });
});

describe("monthly cap", () => {
  it("caps at the boundary, not past it", () => {
    expect(capState(39.99, 40).capped).toBe(false);
    expect(capState(40, 40).capped).toBe(true);
    expect(capState(40.01, 40).capped).toBe(true);
  });

  it("a cap of 0 refuses the first call rather than allowing one free run", () => {
    const state = capState(0, 0);
    expect(state.capped).toBe(true);
    expect(state.remaining).toBe(0);
  });

  it("never reports negative headroom after an overshoot", () => {
    expect(capState(45, 40).remaining).toBe(0);
  });

  it("leaves an uncapped tier uncapped", () => {
    const state = capState(10_000, null);
    expect(state.capped).toBe(false);
    expect(state.remaining).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("per-tier checkup shape", () => {
  const plans = Object.keys(PLAN_CONFIGS) as SellablePlanType[];

  it("gives a monitor to exactly the tiers that carry ai_visibility", () => {
    for (const plan of plans) {
      const runs = PLAN_CONFIGS[plan].aiCheckup.frequency !== "none";
      expect(runs).toBe(hasFeature(plan, "ai_visibility"));
    }
  });

  it("keeps a non-running tier at zero on every axis", () => {
    for (const plan of plans) {
      const { aiCheckup, aiMonthlyCapUsd } = PLAN_CONFIGS[plan];
      if (aiCheckup.frequency !== "none") continue;
      // A tier with no monitor must not have a budget to spend, or a scheduler
      // bug would quietly buy checkups nobody sells.
      expect(aiCheckup.prompts).toBe(0);
      expect(aiCheckup.repetitions).toBe(0);
      expect(aiMonthlyCapUsd).toBe(0);
    }
  });

  it("gives every running tier prompts, repetitions and a budget", () => {
    for (const plan of plans) {
      const { aiCheckup, aiMonthlyCapUsd } = PLAN_CONFIGS[plan];
      if (aiCheckup.frequency === "none") continue;
      expect(aiCheckup.prompts).toBeGreaterThan(0);
      expect(aiCheckup.repetitions).toBeGreaterThan(0);
      // null = uncapped (ENTERPRISE); otherwise it must be spendable.
      expect(aiMonthlyCapUsd === null || aiMonthlyCapUsd > 0).toBe(true);
    }
  });

  it("never shrinks the checkup as the tier goes up", () => {
    // Every sellable tier carries the monitor now, so the ladder is the whole
    // tier list — STARTER included, since it absorbed the retired $29 tier.
    const ladder: SellablePlanType[] = ["STARTER", "GROWTH", "AGENCY", "ENTERPRISE"];
    for (let i = 1; i < ladder.length; i++) {
      const lower = PLAN_CONFIGS[ladder[i - 1]].aiCheckup;
      const upper = PLAN_CONFIGS[ladder[i]].aiCheckup;
      expect(upper.prompts).toBeGreaterThanOrEqual(lower.prompts);
      expect(upper.repetitions).toBeGreaterThanOrEqual(lower.repetitions);
      // null = every available provider, which is by definition >= any number.
      const lowerProviders = lower.providers ?? Number.POSITIVE_INFINITY;
      const upperProviders = upper.providers ?? Number.POSITIVE_INFINITY;
      expect(upperProviders).toBeGreaterThanOrEqual(lowerProviders);
    }
  });
});
