// src/lib/ai-monitor/engines.ts
//
// The catalogue of AI engines the monitor can query: what each one is called,
// what it can do, and — the part that changes at runtime — whether we can
// actually reach it right now.
//
// PURE. No Prisma, no fetch. The AIEngine table is seeded FROM this catalogue
// and carries only the operator's kill switch; the capabilities live here
// because the code has to know them to build a request, and a capability read
// from a row an operator can edit is a capability that can be wrong.
//
// A MISSING KEY DISABLES AN ENGINE, IT DOES NOT CRASH A WORKER. This is the one
// rule the whole module exists to enforce. Eight providers means eight chances
// for a worker to die at boot on a `throw new Error("GEMINI_API_KEY required")`,
// and a dead worker takes every OTHER provider's checkups down with it. So
// availability is a question you ASK (`availableEngines(env)`), never an
// exception you catch, and the scheduler only ever enqueues what came back.
//
// WHY KEYS ARE NAMED HERE RATHER THAN IN EACH ADAPTER. The scheduler has to
// know what is available BEFORE it constructs an adapter — it decides how many
// jobs to enqueue. Asking each adapter would mean instantiating eight clients
// to discover that six of them cannot run.

import { type AiProvider, TOKEN_FREE_PROVIDERS, ratesFor } from "./pricing";

/**
 * One engine: a provider plus the specific model we ask.
 *
 * PINNED MODELS, deliberately. A checkup's score is only comparable to last
 * week's if the same model answered, so the model id is code, not config —
 * the same reasoning as ANALYSIS_MODEL in analysis/llm.ts. Upgrading an engine
 * is a commit, and the trend chart can then mark the day it happened.
 */
export interface EngineSpec {
  provider: AiProvider;
  modelName: string;
  displayName: string;
  /**
   * Whether the engine searches the live web when it answers.
   *
   * LOAD-BEARING FOR THE RECOMMENDATION ENGINE, not decoration. An engine
   * answering from a frozen training set cannot be moved by a page published
   * this week, so "publish a comparison page" is a false promise for it. Phase
   * 7 filters its content recommendations to engines where this is true.
   */
  supportsSearch: boolean;
  /**
   * Whether it returns citations we can attribute.
   *
   * When false, this engine's citationRate is UNMEASURABLE, not zero. Rolling
   * a missing capability up as a 0 would drag the brand's citation score down
   * for a question we never asked — see metrics.ts, which records null.
   */
  supportsCitations: boolean;
  /** Env var holding the API key. Null for engines that need no key of ours. */
  apiKeyEnv: string | null;
  /**
   * Extra env vars that must ALSO be set. Llama is self-hosted, so a key alone
   * says nothing about where to send the request.
   */
  requiredEnv?: string[];
  sortOrder: number;
}

/**
 * Every engine, in dashboard order.
 *
 * Ordered by how much a customer cares, not alphabetically: ChatGPT and Google
 * AI Overviews reach the most people, so they head the per-engine table.
 */
export const ENGINE_CATALOGUE: readonly EngineSpec[] = [
  {
    provider: "CHATGPT",
    modelName: "gpt-5",
    displayName: "ChatGPT",
    supportsSearch: true,
    supportsCitations: true,
    apiKeyEnv: "OPENAI_API_KEY",
    sortOrder: 10,
  },
  {
    provider: "GOOGLE_AI_OVERVIEWS",
    modelName: "serp-ai-overview",
    displayName: "Google AI Overviews",
    supportsSearch: true,
    supportsCitations: true,
    // Reached through DataForSEO's SERP endpoint, which authenticates with a
    // login/password pair rather than a bearer key — hence no apiKeyEnv and
    // both halves listed as required.
    apiKeyEnv: null,
    requiredEnv: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"],
    sortOrder: 20,
  },
  {
    provider: "GEMINI",
    modelName: "gemini-3-pro",
    displayName: "Gemini",
    supportsSearch: true,
    supportsCitations: true,
    apiKeyEnv: "GEMINI_API_KEY",
    sortOrder: 30,
  },
  {
    provider: "CLAUDE",
    modelName: "claude-sonnet-5",
    displayName: "Claude",
    supportsSearch: true,
    supportsCitations: true,
    apiKeyEnv: "ANTHROPIC_API_KEY",
    sortOrder: 40,
  },
  {
    provider: "PERPLEXITY",
    modelName: "sonar-pro",
    displayName: "Perplexity",
    supportsSearch: true,
    supportsCitations: true,
    apiKeyEnv: "PERPLEXITY_API_KEY",
    sortOrder: 50,
  },
  {
    provider: "GROK",
    modelName: "grok-4",
    displayName: "Grok",
    supportsSearch: true,
    supportsCitations: false,
    apiKeyEnv: "XAI_API_KEY",
    sortOrder: 60,
  },
  {
    provider: "MISTRAL",
    modelName: "mistral-large-latest",
    displayName: "Mistral",
    supportsSearch: false,
    supportsCitations: false,
    apiKeyEnv: "MISTRAL_API_KEY",
    sortOrder: 70,
  },
  {
    provider: "LLAMA",
    modelName: "llama-4-maverick",
    displayName: "Llama",
    supportsSearch: false,
    supportsCitations: false,
    // Self-hosted or via a compatible gateway: the host is the required part,
    // the key is optional because a private endpoint may not use one.
    apiKeyEnv: null,
    requiredEnv: ["LLAMA_API_HOST"],
    sortOrder: 80,
  },
] as const;

export function engineFor(provider: AiProvider): EngineSpec | null {
  return ENGINE_CATALOGUE.find((e) => e.provider === provider) ?? null;
}

/** The model id we ask a provider for. Used by the pricing lookups. */
export function modelFor(provider: AiProvider): string {
  return engineFor(provider)?.modelName ?? "unknown";
}

export type UnavailableReason = "missing_key" | "missing_config" | "unknown_engine";

export interface EngineAvailability {
  provider: AiProvider;
  available: boolean;
  reason: UnavailableReason | null;
  /** The env vars that were looked for and not found. */
  missing: string[];
}

/**
 * Can we call this engine right now?
 *
 * Env is a PARAMETER with a default, not a module-scope read, so a test can
 * describe a box with three keys set without mutating process.env and leaking
 * that into the next test file.
 */
export function engineAvailability(
  provider: AiProvider,
  env: NodeJS.ProcessEnv = process.env,
): EngineAvailability {
  const spec = engineFor(provider);
  if (!spec) {
    return { provider, available: false, reason: "unknown_engine", missing: [] };
  }

  const missingKey = spec.apiKeyEnv && !env[spec.apiKeyEnv]?.trim() ? [spec.apiKeyEnv] : [];
  const missingConfig = (spec.requiredEnv ?? []).filter((name) => !env[name]?.trim());

  if (missingKey.length > 0) {
    return {
      provider,
      available: false,
      reason: "missing_key",
      missing: [...missingKey, ...missingConfig],
    };
  }
  if (missingConfig.length > 0) {
    return { provider, available: false, reason: "missing_config", missing: missingConfig };
  }

  return { provider, available: true, reason: null, missing: [] };
}

/**
 * Every engine we can actually reach, in dashboard order.
 *
 * `disabled` is the set an operator has switched off in the AIEngine table;
 * the caller reads those rows and passes the ids in, so this stays pure.
 */
export function availableEngines(
  env: NodeJS.ProcessEnv = process.env,
  disabled: ReadonlySet<string> = new Set(),
): EngineSpec[] {
  return ENGINE_CATALOGUE.filter(
    (spec) => !disabled.has(spec.provider) && engineAvailability(spec.provider, env).available,
  );
}

/**
 * The engines one checkup should query, given a tier's allowance.
 *
 * `allowance` is `aiCheckup.providers` from plan-config: a number, or null for
 * "every engine that is available". Taken from the head of the catalogue rather
 * than at random so a tier's two engines are the same two every week — a
 * visibility score computed from a different pair each time is not a trend.
 */
export function enginesForCheckup(
  allowance: number | null,
  env: NodeJS.ProcessEnv = process.env,
  disabled: ReadonlySet<string> = new Set(),
): EngineSpec[] {
  const available = availableEngines(env, disabled);
  if (allowance === null) return available;
  return available.slice(0, Math.max(0, allowance));
}

export interface EngineReadiness extends EngineAvailability {
  displayName: string;
  /**
   * True when the engine is reachable but has no configured token rates, so
   * its spend meters as zero and does not count against the monthly cap. The
   * settings page surfaces this — an available engine that bills invisibly is
   * worse than one that is off.
   */
  unpriced: boolean;
}

/** Availability plus pricing, for the settings page and the weekly report. */
export function engineReadiness(env: NodeJS.ProcessEnv = process.env): EngineReadiness[] {
  return ENGINE_CATALOGUE.map((spec) => {
    const availability = engineAvailability(spec.provider, env);
    return {
      ...availability,
      displayName: spec.displayName,
      unpriced:
        availability.available &&
        !TOKEN_FREE_PROVIDERS.has(spec.provider) &&
        ratesFor(spec.provider, spec.modelName, env) === null,
    };
  });
}
