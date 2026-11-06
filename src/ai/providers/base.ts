// ---------------------------------------------------------------------------
// AI Provider Abstraction – base interface for all AI inference providers
// ---------------------------------------------------------------------------

export interface InferenceResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  modelId: string;
  provider: string;
  isMock: boolean;
}

export interface InferenceRequest {
  systemPrompt: string;
  userPrompt: string;
  /**
   * Sampling temperature. `null` means DO NOT SEND the parameter at all.
   *
   * Newer Anthropic models reject `temperature` outright — a Sonnet-class
   * model answers a request carrying one with a 400 "`temperature` is
   * deprecated for this model". Callers that want the vendor's own default, or that are
   * talking to such a model, pass null. Omitting the field entirely keeps the
   * previous behaviour (a provider default), so nothing that already works
   * changes.
   */
  //
  // AnthropicProvider never sends one, whatever is passed here: every Claude
  // model the house runs on is from the generation that rejects it.
  temperature?: number | null;
  /**
   * A cap sized in Haiku 4.5 tokens. AnthropicProvider restates it for the
   * model's tokenizer on a house call (see src/ai/anthropic-request.ts).
   */
  maxTokens?: number;
  /**
   * "house" (the default): our own work — thinking off on a model that thinks
   * by default, the cap restated for the tokenizer.
   * "observe": a tracking answer — the model's own defaults and the cap exactly
   * as given, because what is measured must be what an ordinary user gets.
   */
  mode?: "house" | "observe";
  responseFormat?: "json" | "text";
  /** Optional per-call model override. Falls back to the provider default. */
  modelId?: string;
}

export abstract class AiProvider {
  abstract readonly name: string;
  abstract readonly isMock: boolean;
  abstract infer(request: InferenceRequest): Promise<InferenceResult>;
  abstract healthCheck(): Promise<boolean>;
}
