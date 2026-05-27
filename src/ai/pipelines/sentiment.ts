// ---------------------------------------------------------------------------
// Sentiment Analysis Pipeline
// ---------------------------------------------------------------------------

import { sentimentAnalysis } from "@/ai/prompts/templates";
import { AI_FEATURE_FLAGS, CONFIDENCE_THRESHOLDS } from "@/ai/config";

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
