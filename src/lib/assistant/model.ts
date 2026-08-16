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
  content: string | ContentBlock[];
}

// ─── Tool use ───────────────────────────────────────────────────────────────
//
// ONLY THE PRO ASSISTANT USES THESE. The public assistant deliberately has no
// tools (see prompt.ts), and nothing below changes that: the tool list is a
// per-call argument, so a caller that passes none gets exactly the request the
// public path has always sent.

/** A tool the model may call. `input_schema` is JSON Schema, not zod. */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: false;
  };
}

/**
 * One content block, in either direction.
 *
 * Deliberately a hand-written union rather than the SDK's types: this module
 * speaks the wire format directly (see the header), so the shapes here are the
 * JSON the API actually sends and accepts.
 */
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    };

export interface ToolResult {
  /** Every block the model produced, in order. */
  blocks: ContentBlock[];
  /** "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | "refusal". */
  stopReason: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  model: string;
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
  content?: Array<{
    type: string;
    text?: string;
    id?: string;
    name?: string;
    input?: unknown;
  }>;
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

/**
 * One Messages call, returning the raw content blocks and the stop reason.
 *
 * This is the tool-aware entry point. `callAssistantModel` below is the
 * text-only wrapper the public assistant has always used; both go through the
 * same transport, retry policy and error mapping, so there is one place where
 * a 429 or a rotated key is handled.
 *
 * Retries on 429 and 5xx; any other 4xx is a bug in our request and surfaces
 * immediately rather than being retried three times.
 */
export async function callAssistantModelRaw(input: {
  model: string;
  system: SystemBlock[];
  messages: ChatTurn[];
  maxTokens: number;
  /** Omit entirely for a text-only call — the public assistant passes none. */
  tools?: ToolDefinition[];
  /**
   * "none" forbids further tool calls while KEEPING the tool list declared.
   *
   * That combination is the point. A turn that has spent its tool budget must
   * answer, but the conversation already contains tool_use/tool_result pairs,
   * and dropping `tools` from a request whose history references them is how
   * you turn one over-budget turn into a 400 on every retry.
   */
  toolChoice?: "auto" | "none";
}): Promise<ToolResult> {
  const key = apiKey();

  const body = JSON.stringify({
    model: input.model,
    max_tokens: input.maxTokens,
    system: input.system,
    messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
    // Sent only when there are tools: an empty `tools` array is a different
    // request shape from no `tools` key, and the public path must keep sending
    // the second one byte-for-byte so its prompt cache prefix is unchanged.
    ...(input.tools && input.tools.length > 0
      ? {
          tools: input.tools,
          ...(input.toolChoice ? { tool_choice: { type: input.toolChoice } } : {}),
        }
      : {}),
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

      // Unknown block types are DROPPED rather than passed through. Anything we
      // do not understand we also cannot echo back correctly on the next turn,
      // and a malformed replay is a 400 on every subsequent request in the
      // conversation rather than one degraded answer.
      const blocks: ContentBlock[] = [];
      for (const block of data.content ?? []) {
        if (block.type === "text" && typeof block.text === "string") {
          blocks.push({ type: "text", text: block.text });
        } else if (block.type === "tool_use" && block.id && block.name) {
          blocks.push({
            type: "tool_use",
            id: block.id,
            name: block.name,
            input: block.input ?? {},
          });
        }
      }

      return {
        blocks,
        stopReason: data.stop_reason ?? "end_turn",
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

/** Concatenated text of every text block, trimmed. */
export function blockText(blocks: ContentBlock[]): string {
  return blocks
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

/**
 * One text-only Messages call — the public assistant's entry point, unchanged
 * in behaviour from the day it shipped.
 *
 * An answer with no text is still an error HERE, where there are no tools and
 * therefore nothing else a turn could legitimately consist of. The Pro path
 * cannot make that assumption: a turn that ends in `tool_use` has no text yet
 * and is not a failure, so it uses `callAssistantModelRaw` directly.
 */
export async function callAssistantModel(input: {
  model: string;
  system: SystemBlock[];
  messages: ChatTurn[];
  maxTokens: number;
}): Promise<ModelResult> {
  const result = await callAssistantModelRaw(input);
  const text = blockText(result.blocks);
  if (!text) {
    throw new AssistantUpstreamError("The assistant returned an empty answer.", false);
  }
  return {
    text,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    cacheReadTokens: result.cacheReadTokens,
    model: result.model,
  };
}
