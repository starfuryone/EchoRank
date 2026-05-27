// ---------------------------------------------------------------------------
// Escalation Prediction Pipeline
// ---------------------------------------------------------------------------

import { escalationPrediction } from "@/ai/prompts/templates";
import {
  AI_FEATURE_FLAGS,
  RISK_LEVEL_THRESHOLDS,
} from "@/ai/config";
import type { RiskLevel } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EscalationPrediction {
  escalationProbability: number; // 0-1
  publicPostProbability: number; // 0-1
  churnProbability: number; // 0-1
  riskLevel: RiskLevel;
  signals: string[];
  suggestedActions: string[];
}

export interface CustomerHistory {
  previousFeedbackCount?: number;
  averageRating?: number;
  hasOpenTicket?: boolean;
  previousNegativeCount?: number;
}

// ---------------------------------------------------------------------------
// Signal patterns
// ---------------------------------------------------------------------------

const LEGAL_PATTERNS = /\b(lawyer|attorney|legal|sue|lawsuit|court|litigation|litigate|solicitor|tribunal|small claims)\b/i;
const SOCIAL_MEDIA_PATTERNS = /\b(twitter|facebook|instagram|tiktok|youtube|yelp|google review|reddit|social media|post online|tell everyone|go public|expose)\b/i;
const RESIGNATION_PATTERNS = /\b(never again|last time|done with|switching to|moving to|cancel|goodbye|farewell|going elsewhere|final straw)\b/i;
const COMPETITOR_PATTERNS = /\b(competitor|competition|alternative|other company|switched to|better option|already using)\b/i;
const URGENCY_PATTERNS = /\b(immediately|urgent|right now|asap|emergency|cannot wait|unacceptable delay)\b/i;
const PROFANITY_LIGHT = /\b(damn|hell|crap|suck|sucks|stupid|idiot|joke)\b/i;
const REFUND_PATTERNS = /\b(refund|money back|reimburse|compensation|compensate|chargeback|dispute charge)\b/i;

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export class EscalationPipeline {
  /**
   * Predict escalation risk for a piece of feedback.
   */
  async predict(
    content: string,
    rating: number,
    customerHistory?: CustomerHistory,
  ): Promise<EscalationPrediction> {
    // Always compute signal-based scoring
    const signalResult = this.signalBasedScoring(content, rating, customerHistory);

    if (!AI_FEATURE_FLAGS.ENABLED || !AI_FEATURE_FLAGS.ESCALATION_PREDICTION) {
      return signalResult;
    }

    try {
      // Generate prompt (kept for when real inference is enabled)
      const _prompt = escalationPrediction(
        content,
        {
          previousFeedbackCount: customerHistory?.previousFeedbackCount,
          averageRating: customerHistory?.averageRating,
          hasOpenTicket: customerHistory?.hasOpenTicket,
        },
        rating,
      );

      // Mock inference – refines the signal-based result
      return this.mockInference(signalResult, content);
    } catch {
      return signalResult;
    }
  }

  // -----------------------------------------------------------------------
  // Signal-based scoring
  // -----------------------------------------------------------------------

  signalBasedScoring(
    content: string,
    rating: number,
    customerHistory?: CustomerHistory,
  ): EscalationPrediction {
    let probability = 0;
    const signals: string[] = [];
    const suggestedActions: string[] = [];
    const lower = content.toLowerCase();

    // Rating-based base probability
    if (rating === 1) {
      probability += 0.3;
      signals.push("Very low rating (1/5)");
    } else if (rating === 2) {
      probability += 0.2;
      signals.push("Low rating (2/5)");
    } else if (rating === 3) {
      probability += 0.1;
      signals.push("Below-average rating (3/5)");
    }

    // Emotional language detection
    const emotionalWords = [
      "angry",
      "furious",
      "outraged",
      "livid",
      "disgusted",
      "appalled",
      "horrified",
      "infuriated",
      "frustrated",
      "fed up",
      "sick of",
      "hate",
      "despise",
    ];
    const foundEmotional = emotionalWords.filter((w) => lower.includes(w));
    if (foundEmotional.length > 0) {
      probability += 0.15;
      signals.push(`Emotional language detected: ${foundEmotional.join(", ")}`);
      suggestedActions.push("Assign to senior team member for de-escalation");
    }

    // Legal mention
    if (LEGAL_PATTERNS.test(content)) {
      probability += 0.25;
      signals.push("Legal action mentioned");
      suggestedActions.push("Flag for legal review immediately");
      suggestedActions.push("Do not admit fault in initial response");
    }

    // Social media / public post mention
    if (SOCIAL_MEDIA_PATTERNS.test(content)) {
      probability += 0.2;
      signals.push("Social media or public posting mentioned");
      suggestedActions.push("Prioritize rapid personal response");
      suggestedActions.push("Offer direct escalation to management");
    }

    // "Never again" / resignation patterns
    if (RESIGNATION_PATTERNS.test(content)) {
      probability += 0.15;
      signals.push("Customer resignation language detected");
      suggestedActions.push("Initiate retention outreach");
    }

    // ALL CAPS detection (more than 30% of alpha characters)
    const alphaChars = content.replace(/[^a-zA-Z]/g, "");
    const upperChars = content.replace(/[^A-Z]/g, "");
    if (alphaChars.length > 10 && upperChars.length / alphaChars.length > 0.3) {
      probability += 0.1;
      signals.push("Excessive use of capital letters");
    }

    // Multiple exclamation marks
    const exclamationCount = (content.match(/!/g) || []).length;
    if (exclamationCount >= 3) {
      probability += 0.1;
      signals.push(`Multiple exclamation marks (${exclamationCount})`);
    }

    // Long content (> 500 chars indicates invested/upset customer)
    if (content.length > 500) {
      probability += 0.1;
      signals.push("Lengthy feedback (customer is highly invested)");
    }

    // Previous negative feedback
    if (
      customerHistory?.previousNegativeCount &&
      customerHistory.previousNegativeCount > 0
    ) {
      probability += 0.15;
      signals.push(
        `Repeat negative feedback (${customerHistory.previousNegativeCount} previous)`,
      );
      suggestedActions.push("Review full customer history before responding");
    }

    // Competitor mention
    if (COMPETITOR_PATTERNS.test(content)) {
      probability += 0.1;
      signals.push("Competitor or alternative mentioned");
      suggestedActions.push("Include competitive retention offer");
    }

    // Urgency markers
    if (URGENCY_PATTERNS.test(content)) {
      probability += 0.05;
      signals.push("Urgency markers detected");
      suggestedActions.push("Respond within 1 hour");
    }

    // Profanity
    if (PROFANITY_LIGHT.test(content)) {
      probability += 0.05;
      signals.push("Strong language detected");
    }

    // Refund/compensation demand
    if (REFUND_PATTERNS.test(content)) {
      probability += 0.1;
      signals.push("Refund or compensation requested");
      suggestedActions.push("Prepare compensation options before responding");
    }

    // Open ticket already
    if (customerHistory?.hasOpenTicket) {
      probability += 0.1;
      signals.push("Customer already has an open recovery ticket");
      suggestedActions.push("Link to existing ticket and provide unified response");
    }

    // Cap at 0.95
    probability = Math.min(0.95, probability);

    // Default suggested actions if none were added
    if (suggestedActions.length === 0) {
      if (probability > 0.3) {
        suggestedActions.push("Respond promptly with empathy");
        suggestedActions.push("Offer to discuss resolution");
      } else {
        suggestedActions.push("Send standard follow-up response");
      }
    }

    // Calculate churn and public-post probabilities
    const churnProbability = Math.min(0.95, probability * 0.85 + (rating <= 2 ? 0.1 : 0));
    const publicPostProbability = SOCIAL_MEDIA_PATTERNS.test(content)
      ? Math.min(0.95, probability * 0.9)
      : Math.min(0.95, probability * 0.4);

    const riskLevel = this.probabilityToRiskLevel(probability);

    return {
      escalationProbability: Math.round(probability * 100) / 100,
      publicPostProbability: Math.round(publicPostProbability * 100) / 100,
      churnProbability: Math.round(churnProbability * 100) / 100,
      riskLevel,
      signals,
      suggestedActions,
    };
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private probabilityToRiskLevel(probability: number): RiskLevel {
    if (probability >= RISK_LEVEL_THRESHOLDS.CRITICAL) return "CRITICAL";
    if (probability >= RISK_LEVEL_THRESHOLDS.HIGH) return "HIGH";
    if (probability >= RISK_LEVEL_THRESHOLDS.MODERATE) return "MODERATE";
    return "LOW";
  }

  private mockInference(
    signalResult: EscalationPrediction,
    _content: string,
  ): EscalationPrediction {
    // Small random perturbation to simulate model variance
    const jitter = () => (Math.random() - 0.5) * 0.06;

    return {
      ...signalResult,
      escalationProbability: Math.round(
        Math.max(0, Math.min(0.95, signalResult.escalationProbability + jitter())) * 100,
      ) / 100,
      publicPostProbability: Math.round(
        Math.max(0, Math.min(0.95, signalResult.publicPostProbability + jitter())) * 100,
      ) / 100,
      churnProbability: Math.round(
        Math.max(0, Math.min(0.95, signalResult.churnProbability + jitter())) * 100,
      ) / 100,
    };
  }
}
