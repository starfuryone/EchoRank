// src/lib/ai-monitor/runner/shared-answers.ts
//
// The tracker's (and the keyword-opportunity test's) side of the shared answer
// cache (src/lib/answer-cache.ts): how an askEngine call is described for the
// key, and the wrapper that reads a shared answer or asks and shares one.
//
// Both callers ask through askEngine with ASK_SYSTEM_PROMPT and the same caps,
// so a question asked by the tracker for one tenant and by the keyword test
// for another is the same request and shares the same answer.

import "server-only";
import { TRACKING_MAX_TOKENS } from "@/ai/anthropic-request";
import { requestProfile, isBrandSpecific, withSharedAnswer, type AnswerRequest } from "@/lib/answer-cache";
import type { BrandContext } from "../analysis/analyze-response";
import { aioTask } from "./aio-engine";
import { ASK_MAX_TOKENS, ASK_SYSTEM_PROMPT, type AskResult } from "./providers";

/** Bump when an adapter changes what it sends, so old answers stop matching. */
const ADAPTER_VERSION = 1;

/** The cache description of one askEngine call. */
export function trackerAnswerRequest(
  provider: string,
  model: string,
  repetition: number,
  env: NodeJS.ProcessEnv = process.env,
): AnswerRequest {
  const cap = provider === "CLAUDE" ? TRACKING_MAX_TOKENS : ASK_MAX_TOKENS;
  let location = "";
  if (provider === "GOOGLE_AI_OVERVIEWS") {
    const task = aioTask("", env);
    location = `${task.location_code}:${task.language_code}`;
  }
  return {
    engine: provider,
    model,
    profile: requestProfile("askEngine", ADAPTER_VERSION, provider, ASK_SYSTEM_PROMPT, cap),
    location,
    repetition,
  };
}

/** The names and domains that make a prompt brand-specific for this brand. */
export function brandTerms(brand: BrandContext) {
  return {
    names: [brand.brand, ...brand.brandVariations, ...(brand.competitors ?? [])],
    domains: [brand.domain],
  };
}

/**
 * Ask through the shared cache. `ask` is the metered call; on a hit it is not
 * made, so nothing is metered and the answer comes back with zero tokens.
 */
export async function askShared(
  args: { provider: string; model: string; promptText: string; repetition: number; brand: BrandContext },
  ask: () => Promise<AskResult>,
): Promise<{ result: AskResult; hit: boolean }> {
  const outcome = await withSharedAnswer(
    {
      promptText: args.promptText,
      request: trackerAnswerRequest(args.provider, args.model, args.repetition),
      brandSpecific: isBrandSpecific(args.promptText, brandTerms(args.brand)),
    },
    ask,
    (r) => (r.answer.trim() ? { answer: r.answer, sources: r.sources ?? [], model: r.model } : null),
  );
  if (outcome.hit && outcome.shared) {
    return {
      hit: true,
      result: {
        answer: outcome.shared.answer,
        sources: outcome.shared.sources,
        model: outcome.shared.model,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
      },
    };
  }
  return { hit: false, result: outcome.value as AskResult };
}
