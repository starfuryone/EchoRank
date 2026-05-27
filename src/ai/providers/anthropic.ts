// ---------------------------------------------------------------------------
// Anthropic AI Provider – calls the Anthropic Messages API via fetch
// ---------------------------------------------------------------------------

import { AiProvider, type InferenceRequest, type InferenceResult } from "./base";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
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
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: request.maxTokens ?? 512,
      temperature: request.temperature ?? 0.1,
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
          modelId: data.model ?? this.model,
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
