// ---------------------------------------------------------------------------
// Review Authenticity Pipeline
// ---------------------------------------------------------------------------

import { reviewAuthenticity } from "@/ai/prompts/templates";
import { AI_FEATURE_FLAGS } from "@/ai/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthenticityResult {
  score: number; // 0-1, where 1 = certainly authentic
  flags: string[];
  reasoning: string;
}

export interface AuthorProfile {
  name?: string;
  reviewCount?: number;
  memberSince?: string;
}

// ---------------------------------------------------------------------------
// Pattern constants
// ---------------------------------------------------------------------------

const SUPERLATIVES = /\b(best|greatest|most amazing|absolutely perfect|flawless|world-class|top-notch|unbeatable|number one|#1)\b/gi;
const PROMOTIONAL_PATTERNS = /\b(discount|promo|coupon|free|deal|offer|click here|visit|www\.|http|use code|limited time)\b/i;
const COMPETITOR_ATTACK = /\b(unlike|not like|way better than|don't go to|avoid|stay away from|worse than)\b/i;
const TEMPLATE_MARKERS = /\b(lorem|placeholder|\[name\]|\{.*\}|dear valued|to whom it may concern)\b/i;
const SPECIFIC_DETAILS = /\b(\d+\s*(am|pm|minutes|hours|days|weeks|months)|january|february|march|april|may|june|july|august|september|october|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
const PERSONAL_PRONOUNS = /\b(I|my|me|we|our|us)\b/g;
const NAMED_ENTITIES = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/g;

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export class AuthenticityPipeline {
  /**
   * Analyze a review for authenticity signals.
   */
  async analyze(
    content: string,
    authorProfile?: AuthorProfile,
    patterns?: { averageLength?: number; duplicateRatio?: number },
  ): Promise<AuthenticityResult> {
    const heuristic = this.heuristicAnalysis(content, authorProfile, patterns);

    if (!AI_FEATURE_FLAGS.ENABLED || !AI_FEATURE_FLAGS.REVIEW_AUTHENTICITY) {
      return heuristic;
    }

    try {
      // Generate prompt (used when real inference is enabled)
      const _prompt = reviewAuthenticity(content, authorProfile, patterns);

      // Mock inference – refine heuristic slightly
      return this.mockInference(heuristic);
    } catch {
      return heuristic;
    }
  }

  // -----------------------------------------------------------------------
  // Heuristic analysis
  // -----------------------------------------------------------------------

  heuristicAnalysis(
    content: string,
    authorProfile?: AuthorProfile,
    patterns?: { averageLength?: number; duplicateRatio?: number },
  ): AuthenticityResult {
    let score = 0.75; // Start with moderate-high authenticity assumption
    const flags: string[] = [];
    const reasoningParts: string[] = [];

    // ---- Content length check ----
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    if (wordCount < 5) {
      score -= 0.25;
      flags.push("extremely_short_content");
      reasoningParts.push("Review is extremely short with no specifics.");
    } else if (wordCount < 15) {
      score -= 0.1;
      flags.push("short_content");
      reasoningParts.push("Review is brief and lacks detail.");
    } else if (wordCount > 30) {
      score += 0.05;
      reasoningParts.push("Review has reasonable length.");
    }

    // ---- Specificity: dates, times, details ----
    if (SPECIFIC_DETAILS.test(content)) {
      score += 0.1;
      reasoningParts.push("Contains specific dates/times/details.");
    } else if (wordCount > 20) {
      score -= 0.05;
      flags.push("lacks_specific_details");
      reasoningParts.push("Moderate-length review with no specific details.");
    }

    // ---- Personal pronouns (authentic reviews tend to use them) ----
    const pronounMatches = content.match(PERSONAL_PRONOUNS);
    if (pronounMatches && pronounMatches.length >= 2) {
      score += 0.05;
      reasoningParts.push("Uses personal pronouns naturally.");
    }

    // ---- Named entities (staff names, product names) ----
    const namedEntities = content.match(NAMED_ENTITIES);
    if (namedEntities && namedEntities.length >= 1) {
      score += 0.05;
      reasoningParts.push("Mentions specific names or entities.");
    }

    // ---- Excessive superlatives ----
    const superMatches = content.match(SUPERLATIVES);
    if (superMatches && superMatches.length >= 3) {
      score -= 0.15;
      flags.push("excessive_superlatives");
      reasoningParts.push(
        "Contains many superlatives without supporting detail.",
      );
    } else if (superMatches && superMatches.length >= 2 && wordCount < 30) {
      score -= 0.1;
      flags.push("superlatives_without_detail");
      reasoningParts.push(
        "Multiple superlatives in a short review is suspicious.",
      );
    }

    // ---- Promotional language ----
    if (PROMOTIONAL_PATTERNS.test(content)) {
      score -= 0.2;
      flags.push("promotional_language");
      reasoningParts.push("Contains promotional language or links.");
    }

    // ---- Competitor attack patterns ----
    if (COMPETITOR_ATTACK.test(content)) {
      score -= 0.15;
      flags.push("competitor_attack_pattern");
      reasoningParts.push("Contains language attacking competitors.");
    }

    // ---- Template-like structure ----
    if (TEMPLATE_MARKERS.test(content)) {
      score -= 0.3;
      flags.push("template_markers");
      reasoningParts.push("Appears to use a template or placeholder text.");
    }

    // ---- Sentence structure variety (authentic reviews vary) ----
    const sentences = content
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);
    if (sentences.length >= 3) {
      const lengths = sentences.map((s) => s.trim().split(/\s+/).length);
      const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const variance =
        lengths.reduce((sum, l) => sum + (l - avgLen) ** 2, 0) / lengths.length;
      if (variance > 4) {
        score += 0.05;
        reasoningParts.push("Natural sentence length variation.");
      } else if (variance < 1) {
        score -= 0.05;
        flags.push("uniform_sentence_structure");
        reasoningParts.push("Suspiciously uniform sentence lengths.");
      }
    }

    // ---- Author profile signals ----
    if (authorProfile) {
      if (authorProfile.reviewCount !== undefined) {
        if (authorProfile.reviewCount === 1) {
          score -= 0.1;
          flags.push("single_review_author");
          reasoningParts.push("Author has only one review on record.");
        } else if (authorProfile.reviewCount > 10) {
          score += 0.05;
          reasoningParts.push("Author has established review history.");
        }
      }
    }

    // ---- Duplicate ratio check ----
    if (patterns?.duplicateRatio !== undefined && patterns.duplicateRatio > 0.3) {
      score -= 0.2;
      flags.push("high_duplicate_ratio");
      reasoningParts.push("High duplicate content ratio detected.");
    }

    // ---- Length outlier check ----
    if (patterns?.averageLength !== undefined && patterns.averageLength > 0) {
      const ratio = content.length / patterns.averageLength;
      if (ratio < 0.2 || ratio > 5) {
        score -= 0.1;
        flags.push("length_outlier");
        reasoningParts.push("Review length is a significant outlier.");
      }
    }

    // Clamp score
    score = Math.max(0, Math.min(1, score));

    const reasoning =
      reasoningParts.length > 0
        ? reasoningParts.join(" ")
        : "No strong signals detected; review appears normal.";

    return {
      score: Math.round(score * 100) / 100,
      flags,
      reasoning,
    };
  }

  // -----------------------------------------------------------------------
  // Mock inference
  // -----------------------------------------------------------------------

  private mockInference(heuristic: AuthenticityResult): AuthenticityResult {
    const jitter = (Math.random() - 0.5) * 0.06;
    return {
      ...heuristic,
      score: Math.round(Math.max(0, Math.min(1, heuristic.score + jitter)) * 100) / 100,
    };
  }
}
