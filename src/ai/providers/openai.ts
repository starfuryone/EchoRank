// ---------------------------------------------------------------------------
// OpenAI AI Provider – calls the OpenAI API via fetch
// ---------------------------------------------------------------------------

import { AiProvider, type InferenceRequest, type InferenceResult } from "./base";

const DEFAULT_MODEL = "gpt-4o-mini-2024-07-18";
const API_BASE = "https://api.openai.com/v1";
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

export class OpenAiProvider extends AiProvider {
  readonly name = "openai";
  readonly isMock = false;
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    super();
    this.apiKey = apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.model = model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
    if (!this.apiKey) {
      throw new Error("OpenAI API key is required (set OPENAI_API_KEY env var)");
    }
  }

  async infer(request: InferenceRequest): Promise<InferenceResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
      temperature: request.temperature ?? 0.1,
      max_tokens: request.maxTokens ?? 512,
    };

    if (request.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.fetchWithTimeout(
          `${API_BASE}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(body),
          },
          TIMEOUT_MS,
        );

        if (response.status === 429) {
          // Rate limited — wait and retry
          const retryAfter = response.headers.get("retry-after");
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000 * (attempt + 1);
          await this.sleep(waitMs);
          lastError = new Error(`OpenAI rate limited (429)`);
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "unknown error");
          throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
        }

        const data = await response.json();
        const choice = data.choices?.[0];
        if (!choice) {
          throw new Error("OpenAI returned no choices");
        }

        return {
          content: choice.message?.content ?? "",
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          modelId: data.model ?? this.model,
          provider: "openai",
          isMock: false,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES) {
          await this.sleep(1000 * (attempt + 1));
        }
      }
    }

    throw lastError ?? new Error("OpenAI inference failed after retries");
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${API_BASE}/models`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
        5000,
      );
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
