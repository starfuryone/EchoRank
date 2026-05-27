// ---------------------------------------------------------------------------
// Intent Detection Pipeline
// ---------------------------------------------------------------------------

import { intentDetection } from "@/ai/prompts/templates";
import { AI_FEATURE_FLAGS } from "@/ai/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntentCategory =
  | "complaint"
  | "praise"
  | "question"
  | "request_refund"
  | "request_callback"
  | "threat_legal"
  | "threat_social"
  | "resignation"
  | "comparison"
  | "suggestion";

export interface IntentResult {
  primary: IntentCategory;
  secondary: IntentCategory[];
  confidence: number;
  signals: string[];
}

// ---------------------------------------------------------------------------
// Keyword patterns per intent
// ---------------------------------------------------------------------------

interface IntentPattern {
  keywords: string[];
  phrases: string[];
  weight: number;
}

const INTENT_PATTERNS: Record<IntentCategory, IntentPattern> = {
  complaint: {
    keywords: [
      "disappointed",
      "frustrated",
      "unacceptable",
      "terrible",
      "awful",
      "horrible",
      "poor",
      "bad",
      "worst",
      "rude",
      "slow",
      "broken",
      "wrong",
      "problem",
      "issue",
      "failed",
      "angry",
      "upset",
      "annoyed",
      "disgusted",
      "incompetent",
    ],
    phrases: [
      "not happy",
      "not satisfied",
      "very unhappy",
      "let down",
      "fed up",
      "sick of",
      "had enough",
      "completely unacceptable",
      "waste of time",
      "waste of money",
    ],
    weight: 1.0,
  },
  praise: {
    keywords: [
      "great",
      "excellent",
      "amazing",
      "wonderful",
      "love",
      "fantastic",
      "perfect",
      "outstanding",
      "superb",
      "brilliant",
      "awesome",
      "incredible",
      "thank",
      "thanks",
      "grateful",
      "appreciate",
      "impressed",
      "happy",
      "pleased",
      "delighted",
    ],
    phrases: [
      "highly recommend",
      "above and beyond",
      "well done",
      "keep up",
      "so happy",
      "very pleased",
      "can't thank",
      "really appreciate",
      "exceeded expectations",
    ],
    weight: 1.0,
  },
  question: {
    keywords: [
      "how",
      "what",
      "when",
      "where",
      "why",
      "who",
      "which",
      "can",
      "could",
      "would",
      "does",
      "is",
    ],
    phrases: [
      "can you",
      "could you",
      "is there",
      "do you",
      "how do I",
      "I was wondering",
      "any idea",
      "wanted to know",
      "quick question",
    ],
    weight: 0.6, // Lower weight because question words are common
  },
  request_refund: {
    keywords: [
      "refund",
      "reimburse",
      "reimbursement",
      "compensation",
      "compensate",
      "chargeback",
    ],
    phrases: [
      "money back",
      "want a refund",
      "full refund",
      "partial refund",
      "get my money",
      "return my money",
      "dispute the charge",
      "credit my account",
    ],
    weight: 1.5,
  },
  request_callback: {
    keywords: ["call", "callback", "phone", "contact", "reach"],
    phrases: [
      "call me",
      "give me a call",
      "please call",
      "need to speak",
      "want to talk",
      "reach me at",
      "contact me",
      "call back",
      "get in touch",
      "speak with a manager",
      "speak to someone",
    ],
    weight: 1.3,
  },
  threat_legal: {
    keywords: [
      "lawyer",
      "attorney",
      "legal",
      "sue",
      "lawsuit",
      "court",
      "litigation",
      "solicitor",
      "tribunal",
    ],
    phrases: [
      "legal action",
      "take you to court",
      "hear from my lawyer",
      "small claims",
      "consumer protection",
      "file a complaint",
      "report you to",
      "regulatory body",
      "trading standards",
    ],
    weight: 2.0,
  },
  threat_social: {
    keywords: [
      "twitter",
      "facebook",
      "instagram",
      "tiktok",
      "youtube",
      "yelp",
      "reddit",
    ],
    phrases: [
      "social media",
      "post online",
      "tell everyone",
      "go public",
      "leave a review",
      "write a review",
      "viral",
      "expose you",
      "warn others",
      "google review",
      "news station",
      "local news",
    ],
    weight: 1.8,
  },
  resignation: {
    keywords: ["goodbye", "farewell", "done", "leaving", "cancel", "quit"],
    phrases: [
      "never again",
      "last time",
      "done with",
      "giving up",
      "moving on",
      "switching to",
      "going elsewhere",
      "final straw",
      "lost a customer",
      "taking my business",
      "no longer",
      "cancelling my",
    ],
    weight: 1.4,
  },
  comparison: {
    keywords: [
      "competitor",
      "alternative",
      "compared",
      "versus",
      "vs",
      "better",
      "cheaper",
    ],
    phrases: [
      "other companies",
      "better option",
      "switched to",
      "used to use",
      "compared to",
      "not as good as",
      "way better at",
      "cheaper at",
      "more expensive than",
    ],
    weight: 1.2,
  },
  suggestion: {
    keywords: [
      "suggest",
      "suggestion",
      "idea",
      "improve",
      "improvement",
      "recommend",
      "consider",
      "should",
      "could",
    ],
    phrases: [
      "would be great if",
      "it would help",
      "you should",
      "you could",
      "have you considered",
      "my suggestion",
      "food for thought",
      "one thing to improve",
      "would love to see",
      "feature request",
    ],
    weight: 1.1,
  },
};

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export class IntentPipeline {
  /**
   * Detect the intent of customer feedback content.
   */
  async detect(content: string): Promise<IntentResult> {
    const heuristic = this.heuristicDetection(content);

    if (!AI_FEATURE_FLAGS.ENABLED || !AI_FEATURE_FLAGS.INTENT_DETECTION) {
      return heuristic;
    }

    try {
      const _prompt = intentDetection(content);
      return this.mockInference(heuristic);
    } catch {
      return heuristic;
    }
  }

  // -----------------------------------------------------------------------
  // Keyword-based detection
  // -----------------------------------------------------------------------

  heuristicDetection(content: string): IntentResult {
    const lower = content.toLowerCase();
    const scores: Record<IntentCategory, { score: number; signals: string[] }> =
      {} as Record<IntentCategory, { score: number; signals: string[] }>;

    for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
      const cat = intent as IntentCategory;
      scores[cat] = { score: 0, signals: [] };

      // Check keywords
      for (const kw of pattern.keywords) {
        if (lower.includes(kw)) {
          scores[cat].score += pattern.weight;
          scores[cat].signals.push(`keyword: "${kw}"`);
        }
      }

      // Check phrases (worth more)
      for (const phrase of pattern.phrases) {
        if (lower.includes(phrase)) {
          scores[cat].score += pattern.weight * 2;
          scores[cat].signals.push(`phrase: "${phrase}"`);
        }
      }
    }

    // Special handling for questions (check for "?" as a strong signal)
    if (content.includes("?")) {
      scores.question.score += 3;
      scores.question.signals.push("contains question mark");
    }

    // Sort by score descending
    const sorted = Object.entries(scores)
      .filter(([, v]) => v.score > 0)
      .sort((a, b) => b[1].score - a[1].score);

    if (sorted.length === 0) {
      // No signals found; default to neutral complaint or question
      return {
        primary: "complaint",
        secondary: [],
        confidence: 0.3,
        signals: ["No strong intent signals detected"],
      };
    }

    const primary = sorted[0][0] as IntentCategory;
    const primaryScore = sorted[0][1].score;
    const secondary = sorted
      .slice(1)
      .filter(([, v]) => v.score > primaryScore * 0.3)
      .map(([k]) => k as IntentCategory);

    // Confidence based on how strong the primary signal is
    let confidence = 0.5;
    if (primaryScore >= 6) confidence = 0.9;
    else if (primaryScore >= 4) confidence = 0.8;
    else if (primaryScore >= 2) confidence = 0.65;

    // If there's a close secondary, confidence drops slightly
    if (sorted.length >= 2 && sorted[1][1].score > primaryScore * 0.7) {
      confidence *= 0.9;
    }

    const signals = sorted[0][1].signals.slice(0, 5);

    return {
      primary,
      secondary: secondary.slice(0, 3),
      confidence: Math.round(confidence * 100) / 100,
      signals,
    };
  }

  // -----------------------------------------------------------------------
  // Mock inference
  // -----------------------------------------------------------------------

  private mockInference(heuristic: IntentResult): IntentResult {
    return {
      ...heuristic,
      confidence: Math.min(1, Math.round((heuristic.confidence + 0.05) * 100) / 100),
    };
  }
}
