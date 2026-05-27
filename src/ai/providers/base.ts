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
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json" | "text";
}

export abstract class AiProvider {
  abstract readonly name: string;
  abstract readonly isMock: boolean;
  abstract infer(request: InferenceRequest): Promise<InferenceResult>;
  abstract healthCheck(): Promise<boolean>;
}
