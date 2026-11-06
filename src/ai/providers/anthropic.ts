// ---------------------------------------------------------------------------
// Anthropic AI Provider – calls the Anthropic Messages API via fetch
// ---------------------------------------------------------------------------

import { AiProvider, type InferenceRequest, type InferenceResult } from "./base";
import { houseClaudeControls } from "../anthropic-request";

// House policy: claude-haiku-5-5 for every Anthropic call that is not a
// tracking answer (tests/model-policy.test.ts).
//
// This is a LIVE path: the AI monitor's analysis and JSON calls, the tracker's
// Claude answer and the sentiment pipeline's tone call (orchestrator ->
// /api/ai/analyze) all construct it directly. The sentiment pipeline used to
// reach it through registry.ts, which picks OpenAI whenever OPENAI_API_KEY is
// set; it no longer goes through the registry (2026-11-06).
//
// ANTHROPIC_MODEL still overrides, for a one-off experiment. Nothing sets it.
const DEFAULT_MODEL = "claude-haiku-5-5";
const API_BASE = "https://api.anthropic.com/v1";
const API_VERSION = "2023-06-01";
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

export class AnthropicProvider extends AiProvider {
  readonly name = "anthropic";
  readonly isMock = false;
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    super();
    this.apiKey = apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
    this.model = model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
    if (!this.apiKey) {
      throw new Error(
        "Anthropic API key is required (set ANTHROPIC_API_KEY env var)",
      );
    }
  }

  async infer(request: InferenceRequest): Promise<InferenceResult> {
    // Only honor a model override that is actually an Anthropic model. The
    // shared analysis-type config carries OpenAI model ids, so anything that
    // is not a "claude-*" id falls back to this provider's configured model.
    const requestedModel =
      request.modelId && request.modelId.startsWith("claude")
        ? request.modelId
        : this.model;

    const cap = request.maxTokens ?? 512;
    // No temperature, ever, and no prefill (the one message is the user's):
    // both are a 400 on the 4.6+ generation. A house call also turns thinking
    // off and restates the cap for the tokenizer; a tracking answer ("observe")
    // keeps the model's own defaults and the cap as given.
    const body: Record<string, unknown> = {
      model: requestedModel,
      ...(request.mode === "observe"
        ? { max_tokens: cap }
        : houseClaudeControls(requestedModel, cap)),
      system: request.systemPrompt,
      messages: [{ role: "user", content: request.userPrompt }],
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.fetchWithTimeout(
          `${API_BASE}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": this.apiKey,
              "anthropic-version": API_VERSION,
            },
            body: JSON.stringify(body),
          },
          TIMEOUT_MS,
        );

        if (response.status === 429) {
          const retryAfter = response.headers.get("retry-after");
          const waitMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : 1000 * (attempt + 1);
          await this.sleep(waitMs);
          lastError = new Error("Anthropic rate limited (429)");
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "unknown error");
          throw new Error(
            `Anthropic API error ${response.status}: ${errorBody}`,
          );
        }

        const data = await response.json();

        // Extract text content from the response
        const textBlocks = (data.content ?? []).filter(
          (b: { type: string }) => b.type === "text",
        );
        const content = textBlocks
          .map((b: { text: string }) => b.text)
          .join("");

        return {
          content,
          promptTokens: data.usage?.input_tokens ?? 0,
          completionTokens: data.usage?.output_tokens ?? 0,
          modelId: data.model ?? requestedModel,
          provider: "anthropic",
          isMock: false,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES) {
          await this.sleep(1000 * (attempt + 1));
        }
      }
    }

    throw lastError ?? new Error("Anthropic inference failed after retries");
  }

  async healthCheck(): Promise<boolean> {
    // Verify the API key works by sending a minimal request
    try {
      const response = await this.fetchWithTimeout(
        `${API_BASE}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": this.apiKey,
            "anthropic-version": API_VERSION,
          },
          body: JSON.stringify({
            model: this.model,
            max_tokens: 1,
            messages: [{ role: "user", content: "ping" }],
          }),
        },
        5000,
      );
      // 200 = success, 401/403 = bad key
      return response.ok;
    } catch {
      return false;
    }
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
