// ---------------------------------------------------------------------------
// AI Configuration Constants
// ---------------------------------------------------------------------------

/** Supported model identifiers used for analysis pipelines. */
export const AI_MODELS = {
  PRIMARY: "gpt-4o-2024-05-13",
  FALLBACK: "gpt-4o-mini-2024-07-18",
  FAST: "gpt-4o-mini-2024-07-18",
  EMBEDDING: "text-embedding-3-small",
} as const;

export type AiModelId = (typeof AI_MODELS)[keyof typeof AI_MODELS];

// ---------------------------------------------------------------------------
// Per-analysis-type parameters
// ---------------------------------------------------------------------------

export interface AnalysisTypeConfig {
  temperature: number;
  maxTokens: number;
  modelId: AiModelId;
  timeoutMs: number;
}

export const ANALYSIS_TYPE_CONFIG: Record<string, AnalysisTypeConfig> = {
  sentiment: {
    temperature: 0.1,
    maxTokens: 512,
    modelId: AI_MODELS.FAST,
    timeoutMs: 10_000,
  },
  escalation: {
    temperature: 0.2,
    maxTokens: 768,
    modelId: AI_MODELS.PRIMARY,
    timeoutMs: 15_000,
  },
  risk_assessment: {
    temperature: 0.2,
    maxTokens: 1024,
    modelId: AI_MODELS.PRIMARY,
    timeoutMs: 20_000,
  },
  review_authenticity: {
    temperature: 0.1,
    maxTokens: 512,
    modelId: AI_MODELS.FAST,
    timeoutMs: 10_000,
  },
  intent_detection: {
    temperature: 0.1,
    maxTokens: 256,
    modelId: AI_MODELS.FAST,
    timeoutMs: 8_000,
  },
  entity_extraction: {
    temperature: 0.0,
    maxTokens: 512,
    modelId: AI_MODELS.FAST,
    timeoutMs: 10_000,
  },
  emotional_escalation: {
    temperature: 0.15,
    maxTokens: 512,
    modelId: AI_MODELS.PRIMARY,
    timeoutMs: 12_000,
  },
  reputation_summary: {
    temperature: 0.4,
    maxTokens: 1024,
    modelId: AI_MODELS.PRIMARY,
    timeoutMs: 20_000,
  },
} as const;

// ---------------------------------------------------------------------------
// Confidence thresholds
// ---------------------------------------------------------------------------

export const CONFIDENCE_THRESHOLDS = {
  /** Minimum confidence to accept an AI result without fallback. */
  ACCEPT: 0.7,
  /** Confidence below this triggers a warning log. */
  LOW: 0.5,
  /** Below this we use the heuristic fallback instead. */
  REJECT: 0.3,
} as const;

// ---------------------------------------------------------------------------
// Risk level thresholds (based on escalation probability)
// ---------------------------------------------------------------------------

export const RISK_LEVEL_THRESHOLDS = {
  CRITICAL: 0.8,
  HIGH: 0.6,
  MODERATE: 0.35,
  LOW: 0.0, // everything below MODERATE
} as const;

// ---------------------------------------------------------------------------
// Escalation probability thresholds
// ---------------------------------------------------------------------------

export const ESCALATION_THRESHOLDS = {
  /** Create an EscalationAlert when probability exceeds this. */
  ALERT: 0.5,
  /** Mark as CRITICAL when probability exceeds this. */
  CRITICAL_ALERT: 0.8,
  /** Minimum rating to skip escalation prediction entirely. */
  SKIP_ABOVE_RATING: 3,
} as const;

// ---------------------------------------------------------------------------
// Cost tracking (USD per 1 K tokens)
// ---------------------------------------------------------------------------

export const COST_PER_1K_TOKENS: Record<
  string,
  { prompt: number; completion: number }
> = {
  "gpt-4o-2024-05-13": { prompt: 0.005, completion: 0.015 },
  "gpt-4o-mini-2024-07-18": { prompt: 0.00015, completion: 0.0006 },
  "text-embedding-3-small": { prompt: 0.00002, completion: 0 },
  // Anthropic rates (USD per 1K tokens) — VERIFY against current pricing.
  "claude-sonnet-4-6": { prompt: 0.003, completion: 0.015 },
  "claude-opus-4-7": { prompt: 0.015, completion: 0.075 },
  "claude-opus-4-6": { prompt: 0.015, completion: 0.075 },
  "claude-haiku-4-5-20251001": { prompt: 0.001, completion: 0.005 },
  // The undated id, which is what every call site now sends and what the API
  // echoes back. resolveRates would already reach the dated key by stripping
  // the suffix, but the house model should not depend on that fallback to be
  // costed — a table miss silently prices usage at $0.
  "claude-haiku-4-5": { prompt: 0.001, completion: 0.005 },
};

/** Strip a trailing YYYYMMDD snapshot suffix (e.g. `-20250514`) from a model id. */
function baseModelId(modelId: string): string {
  return modelId.replace(/-\d{8}$/, "");
}

/**
 * Resolve the cost rates for a model id. Providers may return a dated snapshot
 * id (e.g. Anthropic resolves `claude-sonnet-4-6` to `claude-sonnet-4-6-2025…`)
 * that won't exactly match a table key, so we fall back to matching on the
 * date-stripped base. Without this, Anthropic usage would always cost $0.
 */
function resolveRates(
  modelId: string,
): { prompt: number; completion: number } | undefined {
  const exact = COST_PER_1K_TOKENS[modelId];
  if (exact) return exact;

  const base = baseModelId(modelId);
  for (const [key, rates] of Object.entries(COST_PER_1K_TOKENS)) {
    if (baseModelId(key) === base) return rates;
  }
  return undefined;
}

/** Calculate dollar cost for a given model call. */
export function estimateCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const rates = resolveRates(modelId);
  if (!rates) return 0;
  return (
    (promptTokens / 1000) * rates.prompt +
    (completionTokens / 1000) * rates.completion
  );
}

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

export const AI_FEATURE_FLAGS = {
  /** Master switch – set to false to disable all AI inference. */
  ENABLED: true,
  /** Enable sentiment analysis on new feedback. */
  SENTIMENT_ANALYSIS: true,
  /** Enable escalation prediction. */
  ESCALATION_PREDICTION: true,
  /** Enable review authenticity checks. */
  REVIEW_AUTHENTICITY: true,
  /** Enable intent detection. */
  INTENT_DETECTION: true,
  /** Enable entity extraction. */
  ENTITY_EXTRACTION: true,
  /** Enable emotional escalation scoring. */
  EMOTIONAL_ESCALATION: true,
  /** Enable automatic reputation score calculation. */
  REPUTATION_SCORING: true,
  /** Enable churn probability estimation. */
  CHURN_PREDICTION: true,
  /** Use the mock inference engine instead of a real API. */
  USE_MOCK_INFERENCE: true,
  /** Log full prompts/responses for debugging (never in production). */
  DEBUG_LOGGING: process.env.NODE_ENV !== "production",
} as const;

// ---------------------------------------------------------------------------
// Reputation score weights
// ---------------------------------------------------------------------------

export const REPUTATION_WEIGHTS = {
  SENTIMENT: 0.35,
  RESPONSE_RATE: 0.2,
  RECOVERY: 0.2,
  REVIEW_VELOCITY: 0.15,
  INVERSE_VOLATILITY: 0.1,
} as const;

// ---------------------------------------------------------------------------
// Batch processing
// ---------------------------------------------------------------------------

export const BATCH_CONFIG = {
  /** Maximum concurrent analyses in a batch. */
  MAX_CONCURRENCY: 5,
  /** Maximum items per batch call. */
  MAX_BATCH_SIZE: 50,
} as const;
