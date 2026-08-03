// src/lib/marketing/client.ts
//
// The Anthropic call for Marketing Studio. One endpoint, one model.
//
// WHY NOT src/ai/providers/registry.ts. That registry exists for AI-visibility
// probing, where the point is to ask several vendors the same question, and it
// resolves to OpenAI whenever OPENAI_API_KEY is set — which it is on this box.
// Routing marketing generation through it would send a `claude-haiku-4-5` model
// id to OpenAI and silently break the "Haiku only, no Sonnet anywhere" rule the
// module is built on. Its provider is also process-cached, returns no
// cache-read token counts, and defaults to Sonnet. This module needs the
// opposite of a vendor abstraction: exactly one model, pinned, auditable.
//
// WHY RAW FETCH AND NOT @anthropic-ai/sdk. The house pattern for calling this
// API is already raw fetch (src/ai/providers/anthropic.ts), the surface used
// here is a single POST, and this box serves production from the working tree —
// adding a dependency is a deploy risk taken for one endpoint. If the module
// later needs streaming or tool use, the SDK becomes worth it; today it is not.

import { MARKETING_MODEL } from "@/lib/marketing-templates";
import type { SystemBlock } from "./prompt";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const TIMEOUT_MS = 60_000;
const MAX_RETRIES = 2;

export interface MarketingCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  /** Always 0 today — the prefix is below Haiku 4.5's cacheable minimum. Read
   *  and stored anyway so the metering table shows it the day that changes. */
  cacheReadTokens: number;
}

export class MarketingKeyMissingError extends Error {
  readonly statusCode = 503;
  constructor() {
    super("Content generation is not configured on this deployment.");
    this.name = "MarketingKeyMissingError";
  }
}

export class MarketingUpstreamError extends Error {
  readonly statusCode = 502;
  constructor(message: string) {
    super(message);
    this.name = "MarketingUpstreamError";
  }
}

/**
 * Read the key at CALL time, not at module load.
 *
 * Module-level capture would freeze whatever was in the environment when the
 * first request happened to warm this module, which is exactly the trap that
 * made the av-service keep serving a rotated key after a `pm2 restart`. Reading
 * per call means a `pm2 delete && pm2 start` picks the new key up immediately.
 */
function apiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new MarketingKeyMissingError();
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

/**
 * One Messages call. Retries on 429 and 5xx; a 4xx other than 429 is a bug in
 * our request and is surfaced immediately rather than retried three times.
 */
export async function callMarketingModel(input: {
  system: SystemBlock[];
  userMessage: string;
  maxTokens: number;
}): Promise<MarketingCallResult> {
  const key = apiKey();

  const body = JSON.stringify({
    model: MARKETING_MODEL,
    max_tokens: input.maxTokens,
    system: input.system,
    messages: [{ role: "user", content: input.userMessage }],
  });

  let lastError: Error = new MarketingUpstreamError("Generation failed");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": API_VERSION,
        },
        body,
        signal: controller.signal,
      });

      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("retry-after"));
        lastError = new MarketingUpstreamError(
          response.status === 429 ? "Generation is busy right now." : "Generation failed upstream.",
        );
        if (attempt < MAX_RETRIES) {
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 10_000)
            : 1000 * (attempt + 1));
          continue;
        }
        throw lastError;
      }

      if (!response.ok) {
        // 400/401/403 — our request or our key. Never logged with the body,
        // which would put the prompt (and on a 401, header echoes) in the log.
        throw new MarketingUpstreamError(
          response.status === 401 || response.status === 403
            ? "Content generation is not configured correctly on this deployment."
            : "That brief could not be generated.",
        );
      }

      const data = (await response.json()) as AnthropicResponse;
      const text = (data.content ?? [])
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("")
        .trim();

      if (!text) throw new MarketingUpstreamError("Generation returned nothing.");

      return {
        text,
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
        cacheReadTokens: data.usage?.cache_read_input_tokens ?? 0,
      };
    } catch (err) {
      if (err instanceof MarketingUpstreamError && !/busy|upstream/.test(err.message)) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) await sleep(1000 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}
