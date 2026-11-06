// ---------------------------------------------------------------------------
// Sentiment Analysis Pipeline
// ---------------------------------------------------------------------------

//
// NAME MATCHING FIRST, THE MODEL ONLY FOR TONE. Topics are found by matching
// topic names in the text (TOPIC_PATTERNS) — free, deterministic, and the same
// answer every time. The model is asked only for the tone (label, score,
// emotions, confidence), which a word list judges badly ("not bad at all").
//
// ON THE HOUSE CLAUDE MODEL, PINNED. Not through src/ai/providers/registry.ts,
// which picks OpenAI whenever OPENAI_API_KEY is set: this is one vendor's
// model, decided (2026-11-06), not whichever key happens to be present. With
// no ANTHROPIC_API_KEY the heuristic answers and nothing is metered.

import { sentimentAnalysis, sentimentTone } from "@/ai/prompts/templates";
import { AI_FEATURE_FLAGS, CONFIDENCE_THRESHOLDS } from "@/ai/config";
import { HOUSE_CLAUDE_MODEL } from "@/ai/anthropic-request";
import { AnthropicProvider } from "@/ai/providers/anthropic";
import type { AiProvider } from "@/ai/providers/base";

/** The model the tone call runs on. */
export const SENTIMENT_MODEL = HOUSE_CLAUDE_MODEL;
/** The tone object is ~60 tokens; this is the ceiling, in Haiku 4.5 tokens. */
export const SENTIMENT_MAX_TOKENS = 200;

/** The tone call's provider, or null when no key is configured. */
function defaultToneProvider(): AiProvider | null {
  try {
    return new AnthropicProvider();
  } catch {
    return null; // no ANTHROPIC_API_KEY
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SentimentResult {
  label: "positive" | "negative" | "neutral" | "mixed";
  score: number; // -1 to 1
  emotions: string[];
  topics: string[];
  confidence: number;
}

/** Real token usage returned by a provider, when one actually ran. */
export interface InferenceUsage {
  promptTokens: number;
  completionTokens: number;
  modelId: string;
}

export interface SentimentInference {
  result: SentimentResult;
  /** Populated only when a real (non-mock) provider produced the result. */
  usage: InferenceUsage | null;
}

// ---------------------------------------------------------------------------
// Word lists for heuristic fallback
// ---------------------------------------------------------------------------

const POSITIVE_WORDS = new Set([
  "great",
  "excellent",
  "amazing",
  "wonderful",
  "love",
  "fantastic",
  "perfect",
  "outstanding",
  "recommend",
  "best",
  "awesome",
  "incredible",
  "superb",
  "delightful",
  "pleasant",
  "friendly",
  "helpful",
  "impressed",
  "thank",
  "thanks",
  "appreciate",
  "happy",
  "satisfied",
  "exceptional",
  "professional",
  "attentive",
  "brilliant",
  "phenomenal",
  "stellar",
  "bravo",
  "kudos",
  "exceeded",
  "reliable",
  "clean",
  "beautiful",
  "smooth",
  "quick",
  "efficient",
  "polite",
  "courteous",
  "warm",
  "welcoming",
  "comfortable",
]);

const NEGATIVE_WORDS = new Set([
  "terrible",
  "awful",
  "horrible",
  "worst",
  "hate",
  "disgusting",
  "unacceptable",
  "rude",
  "slow",
  "broken",
  "disappointed",
  "frustrated",
  "angry",
  "waste",
  "poor",
  "bad",
  "never",
  "useless",
  "incompetent",
  "pathetic",
  "appalling",
  "dreadful",
  "nightmare",
  "ridiculous",
  "outrageous",
  "mediocre",
  "unprofessional",
  "dirty",
  "filthy",
  "cold",
  "stale",
  "overpriced",
  "scam",
  "fraud",
  "ignored",
  "waited",
  "lied",
  "misleading",
  "disrespectful",
  "careless",
  "negligent",
  "unsafe",
  "disgusted",
  "furious",
  "annoyed",
  "irritated",
]);

const EMOTION_MARKERS: Record<string, string[]> = {
  anger: ["angry", "furious", "outraged", "livid", "infuriated", "mad"],
  frustration: [
    "frustrated",
    "annoyed",
    "irritated",
    "fed up",
    "exasperated",
    "sick of",
  ],
  joy: [
    "happy",
    "delighted",
    "thrilled",
    "overjoyed",
    "ecstatic",
    "pleased",
    "glad",
  ],
  sadness: ["sad", "disappointed", "let down", "heartbroken", "upset"],
  gratitude: [
    "thank",
    "thanks",
    "grateful",
    "appreciate",
    "thankful",
    "kudos",
  ],
  disgust: ["disgusting", "disgusted", "gross", "revolting", "repulsive"],
  fear: ["worried", "concerned", "afraid", "scared", "anxious", "nervous"],
  surprise: [
    "surprised",
    "shocked",
    "amazed",
    "astonished",
    "unexpected",
    "wow",
  ],
  contempt: [
    "pathetic",
    "ridiculous",
    "joke",
    "laughable",
    "unbelievable",
    "incompetent",
  ],
};

const TOPIC_PATTERNS: Record<string, RegExp> = {
  "customer service": /\b(service|staff|employee|representative|agent|team|support|help desk)\b/i,
  "product quality": /\b(quality|product|item|material|build|craftsmanship)\b/i,
  delivery: /\b(delivery|shipping|arrive|package|courier|dispatch|tracking)\b/i,
  pricing: /\b(price|cost|expensive|cheap|overpriced|value|worth|money|refund|charge)\b/i,
  "wait time": /\b(wait|waited|waiting|slow|long time|queue|line|delay|took forever)\b/i,
  cleanliness: /\b(clean|dirty|filthy|hygiene|sanitary|mess|spotless)\b/i,
  food: /\b(food|meal|dish|taste|flavor|menu|chef|cook|recipe|portion)\b/i,
  ambiance: /\b(ambiance|atmosphere|decor|music|noise|vibe|setting|environment)\b/i,
  communication: /\b(communication|response|reply|email|phone|call|contact|reach)\b/i,
  billing: /\b(bill|invoice|charge|payment|receipt|overcharge|billing)\b/i,
  location: /\b(location|parking|access|convenient|far|close|distance|neighborhood)\b/i,
  professionalism: /\b(professional|unprofessional|rude|polite|courteous|respectful)\b/i,
};

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export class SentimentPipeline {
  /** Injectable for tests; the default reads ANTHROPIC_API_KEY. */
  constructor(private readonly toneProvider: () => AiProvider | null = defaultToneProvider) {}

  /**
   * Analyse the sentiment of text content. Uses the mock AI inference and
   * falls back to keyword heuristics if parsing fails.
   */
  async analyze(
    content: string,
    context?: { customerName?: string; rating?: number; source?: string },
  ): Promise<SentimentResult> {
    // Always compute the heuristic result so we have a fallback
    const heuristic = this.heuristicAnalysis(content, context?.rating);

    if (!AI_FEATURE_FLAGS.ENABLED || !AI_FEATURE_FLAGS.SENTIMENT_ANALYSIS) {
      return heuristic;
    }

    try {
      const _prompt = sentimentAnalysis(content, context);

      // Use mock inference – produces a result derived from the heuristic
      // so the output is realistic and content-aware
      const mockResult = this.mockInference(content, context?.rating);

      if (mockResult.confidence >= CONFIDENCE_THRESHOLDS.REJECT) {
        return mockResult;
      }
      return heuristic;
    } catch {
      return heuristic;
    }
  }

  // -----------------------------------------------------------------------
  // Keyword-based heuristic
  // -----------------------------------------------------------------------

  heuristicAnalysis(content: string, rating?: number): SentimentResult {
    const lower = content.toLowerCase();
    const words = lower.split(/\W+/).filter(Boolean);

    let positiveCount = 0;
    let negativeCount = 0;

    for (const w of words) {
      if (POSITIVE_WORDS.has(w)) positiveCount++;
      if (NEGATIVE_WORDS.has(w)) negativeCount++;
    }

    // Also check multi-word negative/positive phrases
    const negPhrases = ["never again", "waste of", "fed up", "rip off", "sick of", "last time"];
    const posPhrases = ["highly recommend", "above and beyond", "went out of their way", "could not be happier"];

    for (const p of negPhrases) {
      if (lower.includes(p)) negativeCount += 2;
    }
    for (const p of posPhrases) {
      if (lower.includes(p)) positiveCount += 2;
    }

    // Build raw score from word counts
    const total = positiveCount + negativeCount;
    let rawScore = 0;
    if (total > 0) {
      rawScore = (positiveCount - negativeCount) / total; // -1 to 1
    }

    // Incorporate explicit rating if available (weight 40%)
    if (rating !== undefined && rating >= 1 && rating <= 5) {
      const ratingScore = (rating - 3) / 2; // maps 1->-1, 3->0, 5->1
      rawScore = rawScore * 0.6 + ratingScore * 0.4;
    }

    // Clamp
    const score = Math.max(-1, Math.min(1, rawScore));

    // Determine label
    let label: SentimentResult["label"];
    if (positiveCount > 0 && negativeCount > 0 && Math.abs(score) < 0.25) {
      label = "mixed";
    } else if (score > 0.15) {
      label = "positive";
    } else if (score < -0.15) {
      label = "negative";
    } else {
      label = "neutral";
    }

    // Detect emotions
    const emotions: string[] = [];
    for (const [emotion, markers] of Object.entries(EMOTION_MARKERS)) {
      for (const marker of markers) {
        if (lower.includes(marker)) {
          emotions.push(emotion);
          break;
        }
      }
    }

    // Detect topics
    const topics: string[] = [];
    for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
      if (pattern.test(content)) {
        topics.push(topic);
      }
    }

    // Confidence based on evidence
    let confidence = 0.5;
    if (total >= 3) confidence = 0.75;
    if (total >= 6) confidence = 0.85;
    if (rating !== undefined) confidence = Math.min(1, confidence + 0.1);
    if (content.length > 200) confidence = Math.min(1, confidence + 0.05);

    return { label, score: Math.round(score * 100) / 100, emotions, topics, confidence };
  }

  // -----------------------------------------------------------------------
  // Real LLM sentiment analysis (with heuristic fallback)
  // -----------------------------------------------------------------------

  /**
   * Topics by name matching, then the tone from the house Claude model,
   * returning the real token usage and the model that ran. With no key (or AI
   * disabled) `usage` is null so callers know not to meter or cost the call.
   */
  async analyzeWithUsage(
    content: string,
    context?: { customerName?: string; rating?: number; source?: string },
  ): Promise<SentimentInference> {
    // Name matching first: the topics (and the fallback tone) cost nothing.
    const heuristic = this.heuristicAnalysis(content, context?.rating);

    if (!AI_FEATURE_FLAGS.ENABLED || !AI_FEATURE_FLAGS.SENTIMENT_ANALYSIS) {
      return { result: heuristic, usage: null };
    }

    const provider = this.toneProvider();

    // No key: keep the content-aware heuristic, report no usage/cost.
    if (!provider || provider.isMock) {
      return { result: this.mockInference(content, context?.rating), usage: null };
    }

    const prompt = sentimentTone(content, { rating: context?.rating, source: context?.source });

    try {
      const inference = await provider.infer({
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
        maxTokens: SENTIMENT_MAX_TOKENS,
        responseFormat: "json",
        modelId: SENTIMENT_MODEL,
      });

      // Real tokens were spent regardless of whether the body parses cleanly.
      const usage: InferenceUsage = {
        promptTokens: inference.promptTokens,
        completionTokens: inference.completionTokens,
        modelId: inference.modelId,
      };

      const tone = this.parseTone(inference.content);
      return { result: tone ? { ...tone, topics: heuristic.topics } : heuristic, usage };
    } catch (err) {
      console.warn(
        "[SentimentPipeline] LLM inference failed, falling back to heuristic:",
        err instanceof Error ? err.message : err,
      );
      return { result: heuristic, usage: null };
    }
  }

  /**
   * Parse and validate the tone object. Returns null when the payload is
   * malformed so the caller can fall back to the heuristic. A ```json fence or
   * a sentence around the object is tolerated; topics are not read from it.
   */
  parseTone(raw: string): Omit<SentimentResult, "topics"> | null {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }

    if (
      typeof parsed.label !== "string" ||
      typeof parsed.score !== "number" ||
      !Array.isArray(parsed.emotions) ||
      typeof parsed.confidence !== "number"
    ) {
      return null;
    }

    const validLabels = ["positive", "negative", "neutral", "mixed"];
    if (!validLabels.includes(parsed.label)) {
      return null;
    }

    const score = Math.max(-1, Math.min(1, parsed.score as number));
    const confidence = Math.max(0, Math.min(1, parsed.confidence as number));

    return {
      label: parsed.label as SentimentResult["label"],
      score: Math.round(score * 100) / 100,
      emotions: (parsed.emotions as unknown[]).filter(
        (e): e is string => typeof e === "string",
      ),
      confidence: Math.round(confidence * 100) / 100,
    };
  }

  // -----------------------------------------------------------------------
  // Mock AI inference (content-aware)
  // -----------------------------------------------------------------------

  private mockInference(
    content: string,
    rating?: number,
  ): SentimentResult {
    const heuristic = this.heuristicAnalysis(content, rating);

    // Slightly adjust the heuristic to simulate AI variance
    const jitter = (Math.random() - 0.5) * 0.08;
    const adjustedScore = Math.max(-1, Math.min(1, heuristic.score + jitter));

    return {
      ...heuristic,
      score: Math.round(adjustedScore * 100) / 100,
      confidence: Math.min(1, heuristic.confidence + 0.1),
    };
  }
}
