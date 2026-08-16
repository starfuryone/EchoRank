// src/lib/assistant/model.ts
//
// The Anthropic call for the AI Assistant.
//
// WHY RAW FETCH AND NOT @anthropic-ai/sdk. The house pattern for calling this API
// is already raw fetch — src/ai/providers/anthropic.ts and src/lib/marketing/
// client.ts both do it, and the second one states the reason: this box serves
// production from its working tree, so adding a dependency is a deploy risk. The
// surface used here is a single non-streaming POST. If the assistant later needs
// streaming or tool use, the SDK becomes worth it; today it is not.
//
// WHY NOT src/ai/providers/registry.ts. That registry exists for AI-visibility
// probing, where the point is to ask several vendors the same question, and it
// resolves to OpenAI whenever OPENAI_API_KEY is set — which it is on this box.
// Routing assistant turns through it would send a Claude model id to OpenAI.
//
// NON-STREAMING, DELIBERATELY. Answers are capped at ~1000 output tokens and
// arrive in a couple of seconds; a streamed transport would have to survive
// Cloudflare's proxy buffering, which is a thing to verify per deployment rather
// than assume. A single JSON response has no such failure mode.

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const TIMEOUT_MS = 45_000;
const MAX_RETRIES = 2;

export interface SystemBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ModelResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  /** Tokens served from the prompt cache, when the prefix was long enough. */
  cacheReadTokens: number;
  model: string;
}

export class AssistantKeyMissingError extends Error {
  readonly statusCode = 503;
  constructor() {
    super("The assistant is not configured on this deployment.");
    this.name = "AssistantKeyMissingError";
  }
}

export class AssistantUpstreamError extends Error {
  readonly statusCode = 502;
  /**
   * False for a 4xx that is our own request's fault. Retrying those three times
   * turns one bad request into three bad requests and a slower error page.
   */
  constructor(
    message: string,
    readonly retryable = true,
  ) {
    super(message);
    this.name = "AssistantUpstreamError";
  }
}

/**
 * Read the key at CALL time, not at module load.
 *
 * Module-level capture freezes whatever was in the environment when the first
 * request warmed this module — the trap that made the av-service keep serving a
 * rotated key after a restart. The value is never logged, echoed or returned.
 */
function apiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new AssistantKeyMissingError();
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
 * One Messages call. Retries on 429 and 5xx; any other 4xx is a bug in our
 * request and surfaces immediately rather than being retried three times.
 */
export async function callAssistantModel(input: {
  model: string;
  system: SystemBlock[];
  messages: ChatTurn[];
  maxTokens: number;
}): Promise<ModelResult> {
  const key = apiKey();

  const body = JSON.stringify({
    model: input.model,
    max_tokens: input.maxTokens,
    system: input.system,
    messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
  });

  let lastError: Error = new AssistantUpstreamError("The assistant could not answer.");

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
        lastError = new AssistantUpstreamError(
          response.status === 429
            ? "The assistant is busy right now. Try again in a moment."
            : "The assistant could not answer just now.",
        );
        if (attempt < MAX_RETRIES) {
          await sleep(
            Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.min(retryAfter * 1000, 10_000)
              : 1000 * (attempt + 1),
          );
          continue;
        }
        throw lastError;
      }

      if (!response.ok) {
        // 400/401/403 — our request or our key. Never logged with the body,
        // which would put the prompt (and on a 401, header echoes) in the log.
        throw new AssistantUpstreamError(
          response.status === 401 || response.status === 403
            ? "The assistant is not configured correctly on this deployment."
            : "The assistant could not answer that.",
          false,
        );
      }

      const data = (await response.json()) as AnthropicResponse;
      const text = (data.content ?? [])
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text as string)
        .join("")
        .trim();

      if (!text) {
        throw new AssistantUpstreamError("The assistant returned an empty answer.", false);
      }

      return {
        text,
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
        cacheReadTokens: data.usage?.cache_read_input_tokens ?? 0,
        model: input.model,
      };
    } catch (error) {
      if (error instanceof AssistantKeyMissingError) throw error;
      if (error instanceof AssistantUpstreamError) {
        if (!error.retryable || attempt >= MAX_RETRIES) throw error;
        lastError = error;
      } else {
        // Network error or timeout.
        lastError = new AssistantUpstreamError("The assistant did not answer in time.");
        if (attempt >= MAX_RETRIES) throw lastError;
      }
      await sleep(1000 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}
