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
  temperature?: number | null;
  maxTokens?: number;
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
