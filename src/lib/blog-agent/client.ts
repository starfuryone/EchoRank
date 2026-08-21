// src/lib/blog-agent/client.ts
//
// The Anthropic call for the blog agent. One endpoint, one model.
//
// WHY RAW FETCH AND NOT @anthropic-ai/sdk. This is the house pattern —
// src/ai/providers/anthropic.ts, src/lib/assistant/model.ts and
// src/lib/marketing/client.ts all call this API the same way, each with the
// same note. The surface used here is one POST with no streaming and no tool
// use, and this box serves production from its working tree, so a dependency
// added for one endpoint is a deploy risk taken for nothing.
//
// WHY NOT src/lib/marketing/client.ts, which is nearly this file. That module
// reads ANTHROPIC_API_KEY and throws MarketingKeyMissingError; this one must
// read BLOG_AGENT_ANTHROPIC_KEY so a rotated or leaked marketing key does not
// take the blog agent with it, and vice versa. Sharing the module would mean
// sharing the key, which is the thing the separate variable exists to prevent.

import { blogAgentApiKey, blogAgentModel, callCostUsd } from "./config";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
/** Generous: a 1,600-word article at low priority is not a fast request. */
const TIMEOUT_MS = 120_000;
const MAX_RETRIES = 2;

/** Output ceiling. ~4k tokens comfortably covers 1,600 words plus frontmatter. */
export const MAX_OUTPUT_TOKENS = 4_096;

export class BlogAgentUpstreamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "BlogAgentUpstreamError";
  }
}

export interface DraftCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  /** USD, computed from the reported token counts. Stored per run. */
  costUsd: number;
  model: string;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  stop_reason?: string;
  error?: { message?: string };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One Messages call.
 *
 * Retries 429 and 5xx; a 4xx other than 429 is a bug in our request and is
 * surfaced immediately rather than retried three times into the same wall.
 *
 * No `thinking` parameter: Haiku 4.5 predates adaptive thinking, and this is a
 * single-shot generation with a deterministic checker behind it — the budget is
 * better spent on the retry the gate may ask for.
 */
export async function callDraftModel(input: {
  system: string;
  userMessage: string;
}): Promise<DraftCallResult> {
  const key = blogAgentApiKey();
  const model = blogAgentModel();

  const body = JSON.stringify({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: input.system,
    messages: [{ role: "user", content: input.userMessage }],
  });

  let lastError = new BlogAgentUpstreamError("Draft generation failed");

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
        lastError = new BlogAgentUpstreamError(
          response.status === 429 ? "Rate limited" : "Upstream error",
          response.status,
        );
        if (attempt < MAX_RETRIES) {
          const retryAfter = Number(response.headers.get("retry-after"));
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2_000 * 2 ** attempt);
          continue;
        }
        throw lastError;
      }

      const json = (await response.json()) as AnthropicResponse;

      if (!response.ok) {
        throw new BlogAgentUpstreamError(json.error?.message ?? "Bad request", response.status);
      }

      const text = (json.content ?? [])
        .filter((b) => b.type === "text" && b.text)
        .map((b) => b.text!)
        .join("");

      if (!text.trim()) {
        throw new BlogAgentUpstreamError(`Model returned no text (stop_reason: ${json.stop_reason})`);
      }

      const inputTokens = json.usage?.input_tokens ?? 0;
      const outputTokens = json.usage?.output_tokens ?? 0;
      return {
        text,
        inputTokens,
        outputTokens,
        costUsd: callCostUsd(inputTokens, outputTokens),
        model,
      };
    } catch (err) {
      if (err instanceof BlogAgentUpstreamError) {
        // A 4xx is ours to fix; retrying it just spends the budget.
        if (err.status && err.status !== 429 && err.status < 500) throw err;
        lastError = err;
      } else if (err instanceof Error && err.name === "AbortError") {
        lastError = new BlogAgentUpstreamError("Draft generation timed out");
      } else {
        lastError = new BlogAgentUpstreamError(
          err instanceof Error ? err.message : "Draft generation failed",
        );
      }
      if (attempt >= MAX_RETRIES) throw lastError;
      await sleep(2_000 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

/**
 * Pull the fenced block out of the model's reply.
 *
 * The prompt asks for exactly one fence and nothing else, and a small model
 * sometimes adds a sentence before it anyway. Extracting rather than trusting
 * costs four lines and removes a whole class of gate failure that would
 * otherwise burn the one retry on a formatting slip.
 */
export function extractFenced(reply: string): string {
  const fence = /```(?:markdown|md|yaml)?\n([\s\S]*?)```/.exec(reply);
  return (fence ? fence[1] : reply).trim();
}
