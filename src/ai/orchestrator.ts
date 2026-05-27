// ---------------------------------------------------------------------------
// AI Orchestrator – singleton that coordinates all AI analysis pipelines
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import {
  AI_FEATURE_FLAGS,
  AI_MODELS,
  ANALYSIS_TYPE_CONFIG,
  BATCH_CONFIG,
  ESCALATION_THRESHOLDS,
  estimateCost,
} from "@/ai/config";
import { SentimentPipeline, type SentimentResult } from "@/ai/pipelines/sentiment";
import {
  EscalationPipeline,
  type EscalationPrediction,
} from "@/ai/pipelines/escalation-prediction";
import { IntentPipeline, type IntentResult } from "@/ai/pipelines/intent-detection";
import {
  AuthenticityPipeline,
  type AuthenticityResult,
} from "@/ai/pipelines/review-authenticity";
import { EscalationScoreCalculator } from "@/ai/scoring/escalation-score";
import type { RiskLevel } from "@/generated/prisma";
import { getProvider } from "@/ai/providers/registry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FullAnalysisResult {
  id: string;
  sentiment: SentimentResult;
  intent: IntentResult;
  entities: EntityResult[];
  escalation: EscalationPrediction | null;
  riskLevel: RiskLevel;
  suggestedAction: string;
  confidence: number;
  tokenUsage: { prompt: number; completion: number };
  latencyMs: number;
  cost: number;
}

export interface EntityResult {
  text: string;
  type: string;
  context: string;
}

export interface QuickRiskResult {
  riskLevel: RiskLevel;
  probability: number;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Singleton orchestrator
// ---------------------------------------------------------------------------

let _instance: AiOrchestrator | null = null;

export class AiOrchestrator {
  private sentimentPipeline: SentimentPipeline;
  private escalationPipeline: EscalationPipeline;
  private intentPipeline: IntentPipeline;
  private authenticityPipeline: AuthenticityPipeline;
  private escalationScoreCalc: EscalationScoreCalculator;

  private constructor() {
    this.sentimentPipeline = new SentimentPipeline();
    this.escalationPipeline = new EscalationPipeline();
    this.intentPipeline = new IntentPipeline();
    this.authenticityPipeline = new AuthenticityPipeline();
    this.escalationScoreCalc = new EscalationScoreCalculator();
  }

  static getInstance(): AiOrchestrator {
    if (!_instance) {
      _instance = new AiOrchestrator();
    }
    return _instance;
  }

  // -----------------------------------------------------------------------
  // Full feedback analysis pipeline
  // -----------------------------------------------------------------------

  async analyzeFeedback(
    tenantId: string,
    feedbackId: string,
  ): Promise<FullAnalysisResult> {
    if (!AI_FEATURE_FLAGS.ENABLED) {
      throw new Error("AI analysis is currently disabled");
    }

    const startMs = Date.now();

    // 1. Fetch feedback + customer data
    const feedback = await prisma.feedback.findFirst({
      where: { id: feedbackId, tenantId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            location: true,
          },
        },
      },
    });

    if (!feedback) {
      throw new Error(`Feedback ${feedbackId} not found for tenant ${tenantId}`);
    }

    const content = feedback.comment ?? "";
    const rating = feedback.rating ?? 3;

    // Fetch customer history
    const [previousFeedback, openTickets] = await Promise.all([
      prisma.feedback.findMany({
        where: {
          tenantId,
          customerId: feedback.customerId,
          status: "SUBMITTED",
          id: { not: feedbackId },
        },
        select: { rating: true },
        orderBy: { submittedAt: "desc" },
        take: 10,
      }),
      prisma.recoveryTicket.count({
        where: {
          tenantId,
          customerId: feedback.customerId,
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
      }),
    ]);

    const prevRatings = previousFeedback
      .map((f) => f.rating)
      .filter((r): r is number => r !== null);
    const avgPrevRating =
      prevRatings.length > 0
        ? prevRatings.reduce((a, b) => a + b, 0) / prevRatings.length
        : undefined;

    // 2-5. Run analysis pipelines in parallel
    const [sentimentResult, intentResult, entitiesResult, escalationResult] =
      await Promise.all([
        // 2. Sentiment analysis
        this.sentimentPipeline.analyze(content, {
          customerName: feedback.customer.name,
          rating,
          source: "feedback",
        }),
        // 3. Intent detection
        this.intentPipeline.detect(content),
        // 4. Entity extraction
        this.extractEntities(content),
        // 5. Escalation prediction (only if rating <= threshold)
        rating <= ESCALATION_THRESHOLDS.SKIP_ABOVE_RATING && content.length > 0
          ? this.escalationPipeline.predict(content, rating, {
              previousFeedbackCount: prevRatings.length,
              averageRating: avgPrevRating,
              hasOpenTicket: openTickets > 0,
              previousNegativeCount: prevRatings.filter((r) => r <= 2).length,
            })
          : null,
      ]);

    // 6. Calculate composite risk score
    const riskLevel = this.calculateCompositeRisk(
      sentimentResult,
      escalationResult,
      rating,
    );

    // 7. Suggested action
    const suggestedAction = this.generateSuggestedAction(
      riskLevel,
      intentResult,
      escalationResult,
    );

    // Token usage: use real counts only when provider is not mock
    const provider = getProvider();
    const config = ANALYSIS_TYPE_CONFIG.sentiment;
    const promptTokens = provider.isMock ? 0 : Math.round(content.length / 4) + 200;
    const completionTokens = provider.isMock ? 0 : 150;
    const latencyMs = Date.now() - startMs;

    // Overall confidence
    const confidence = this.averageConfidence(
      sentimentResult.confidence,
      intentResult.confidence,
      escalationResult?.escalationProbability,
    );

    // 7. Store AiAnalysis record
    const analysis = await prisma.aiAnalysis.create({
      data: {
        tenantId,
        feedbackId,
        analysisType: "full_feedback",
        sentimentLabel: sentimentResult.label,
        sentimentScore: sentimentResult.score,
        escalationProbability: escalationResult?.escalationProbability ?? null,
        publicPostProbability: escalationResult?.publicPostProbability ?? null,
        churnProbability: escalationResult?.churnProbability ?? null,
        riskLevel,
        intent: intentResult.primary,
        entities: entitiesResult as unknown as Prisma.InputJsonValue,
        emotions: sentimentResult.emotions as unknown as string[],
        topics: sentimentResult.topics as unknown as string[],
        suggestedAction,
        confidence,
        modelId: provider.isMock ? "mock-heuristic-v1" : provider.name,
        promptTokens,
        completionTokens,
        latencyMs,
      },
    });

    // 8. Create EscalationAlert if warranted
    if (escalationResult && escalationResult.escalationProbability >= ESCALATION_THRESHOLDS.ALERT) {
      const shouldAlert = await this.escalationScoreCalc.shouldCreateAlert(
        tenantId,
        feedbackId,
        escalationResult.escalationProbability,
      );

      if (shouldAlert) {
        await this.escalationScoreCalc.createAlert({
          tenantId,
          customerId: feedback.customerId,
          feedbackId,
          alertType: "escalation_prediction",
          probability: escalationResult.escalationProbability,
          title: `${riskLevel} risk: ${feedback.customer.name} rated ${rating}/5`,
          description: this.buildAlertDescription(
            feedback.customer.name,
            rating,
            sentimentResult,
            escalationResult,
            content,
          ),
          suggestedAction,
        });
      }
    }

    // Record usage meter only for real AI inference (not mock)
    if (!provider.isMock) {
      await this.recordUsage(tenantId, promptTokens, completionTokens, config.modelId);
    }

    // 9. Return complete analysis
    const cost = provider.isMock
      ? 0
      : estimateCost(
          config.modelId as "gpt-4o-2024-05-13" | "gpt-4o-mini-2024-07-18" | "text-embedding-3-small",
          promptTokens,
          completionTokens,
        );

    return {
      id: analysis.id,
      sentiment: sentimentResult,
      intent: intentResult,
      entities: entitiesResult,
      escalation: escalationResult,
      riskLevel,
      suggestedAction,
      confidence,
      tokenUsage: { prompt: promptTokens, completion: completionTokens },
      latencyMs,
      cost,
    };
  }

  // -----------------------------------------------------------------------
  // External review analysis pipeline
  // -----------------------------------------------------------------------

  async analyzeExternalReview(
    tenantId: string,
    reviewId: string,
  ): Promise<FullAnalysisResult> {
    if (!AI_FEATURE_FLAGS.ENABLED) {
      throw new Error("AI analysis is currently disabled");
    }

    const startMs = Date.now();

    const review = await prisma.externalReview.findFirst({
      where: { id: reviewId, tenantId },
      include: {
        source: { select: { platform: true, name: true } },
      },
    });

    if (!review) {
      throw new Error(`External review ${reviewId} not found for tenant ${tenantId}`);
    }

    const content = review.content ?? "";
    const rating = review.rating ?? 3;

    // Run pipelines in parallel
    const [sentimentResult, intentResult, entitiesResult, authenticityResult, escalationResult] =
      await Promise.all([
        this.sentimentPipeline.analyze(content, {
          rating,
          source: review.source.platform,
        }),
        this.intentPipeline.detect(content),
        this.extractEntities(content),
        this.authenticityPipeline.analyze(content, {
          name: review.authorName ?? undefined,
        }),
        rating <= ESCALATION_THRESHOLDS.SKIP_ABOVE_RATING && content.length > 0
          ? this.escalationPipeline.predict(content, rating)
          : null,
      ]);

    const riskLevel = this.calculateCompositeRisk(
      sentimentResult,
      escalationResult,
      rating,
    );

    const suggestedAction = this.generateSuggestedAction(
      riskLevel,
      intentResult,
      escalationResult,
    );

    const providerExt = getProvider();
    const config = ANALYSIS_TYPE_CONFIG.sentiment;
    const promptTokens = providerExt.isMock ? 0 : Math.round(content.length / 4) + 250;
    const completionTokens = providerExt.isMock ? 0 : 180;
    const latencyMs = Date.now() - startMs;

    const confidence = this.averageConfidence(
      sentimentResult.confidence,
      intentResult.confidence,
      authenticityResult.score,
    );

    const analysis = await prisma.aiAnalysis.create({
      data: {
        tenantId,
        externalReviewId: reviewId,
        analysisType: "external_review",
        sentimentLabel: sentimentResult.label,
        sentimentScore: sentimentResult.score,
        escalationProbability: escalationResult?.escalationProbability ?? null,
        publicPostProbability: escalationResult?.publicPostProbability ?? null,
        churnProbability: escalationResult?.churnProbability ?? null,
        riskLevel,
        intent: intentResult.primary,
        entities: entitiesResult as unknown as Prisma.InputJsonValue,
        emotions: sentimentResult.emotions as unknown as string[],
        topics: sentimentResult.topics as unknown as string[],
        suggestedAction,
        confidence,
        modelId: providerExt.isMock ? "mock-heuristic-v1" : providerExt.name,
        promptTokens,
        completionTokens,
        latencyMs,
      },
    });

    // Update the review's sentiment fields
    await prisma.externalReview.update({
      where: { id: reviewId },
      data: {
        sentimentLabel: sentimentResult.label,
        sentimentScore: sentimentResult.score,
        riskLevel,
        isProcessed: true,
      },
    });

    // Alert if escalation detected
    if (escalationResult && escalationResult.escalationProbability >= ESCALATION_THRESHOLDS.ALERT) {
      await this.escalationScoreCalc.createAlert({
        tenantId,
        externalReviewId: reviewId,
        alertType: "external_review_risk",
        probability: escalationResult.escalationProbability,
        title: `${riskLevel} risk external review on ${review.source.platform}`,
        description: `A ${review.source.platform} review rated ${rating}/5 was flagged. Sentiment: ${sentimentResult.label} (${sentimentResult.score}). ${escalationResult.signals.slice(0, 3).join("; ")}`,
        suggestedAction,
      });
    }

    // Record usage meter only for real AI inference (not mock)
    if (!providerExt.isMock) {
      await this.recordUsage(tenantId, promptTokens, completionTokens, config.modelId);
    }

    const cost = providerExt.isMock
      ? 0
      : estimateCost(
          config.modelId as "gpt-4o-2024-05-13" | "gpt-4o-mini-2024-07-18" | "text-embedding-3-small",
          promptTokens,
          completionTokens,
        );

    return {
      id: analysis.id,
      sentiment: sentimentResult,
      intent: intentResult,
      entities: entitiesResult,
      escalation: escalationResult,
      riskLevel,
      suggestedAction,
      confidence,
      tokenUsage: { prompt: promptTokens, completion: completionTokens },
      latencyMs,
      cost,
    };
  }

  // -----------------------------------------------------------------------
  // Quick risk assessment
  // -----------------------------------------------------------------------

  async assessRisk(
    tenantId: string,
    feedbackId: string,
  ): Promise<QuickRiskResult> {
    const feedback = await prisma.feedback.findFirst({
      where: { id: feedbackId, tenantId },
      select: { rating: true, comment: true, customerId: true },
    });

    if (!feedback) {
      throw new Error(`Feedback ${feedbackId} not found`);
    }

    const content = feedback.comment ?? "";
    const rating = feedback.rating ?? 3;

    if (rating > ESCALATION_THRESHOLDS.SKIP_ABOVE_RATING || content.length === 0) {
      return { riskLevel: "LOW", probability: 0.05, confidence: 0.7 };
    }

    const result = await this.escalationPipeline.predict(content, rating);

    return {
      riskLevel: result.riskLevel,
      probability: result.escalationProbability,
      confidence: 0.75,
    };
  }

  // -----------------------------------------------------------------------
  // Batch analysis
  // -----------------------------------------------------------------------

  async batchAnalyze(
    tenantId: string,
    feedbackIds: string[],
  ): Promise<Map<string, FullAnalysisResult>> {
    const results = new Map<string, FullAnalysisResult>();
    const ids = feedbackIds.slice(0, BATCH_CONFIG.MAX_BATCH_SIZE);

    // Process in batches with concurrency limit
    for (let i = 0; i < ids.length; i += BATCH_CONFIG.MAX_CONCURRENCY) {
      const batch = ids.slice(i, i + BATCH_CONFIG.MAX_CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map((id) => this.analyzeFeedback(tenantId, id)),
      );

      batchResults.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          results.set(batch[idx], result.value);
        } else {
          console.error(
            `Failed to analyze feedback ${batch[idx]}:`,
            result.reason,
          );
        }
      });
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // Entity extraction (keyword-based mock)
  // -----------------------------------------------------------------------

  private async extractEntities(content: string): Promise<EntityResult[]> {
    if (!AI_FEATURE_FLAGS.ENTITY_EXTRACTION || !content) return [];

    const entities: EntityResult[] = [];

    // Extract potential person names (capitalized words)
    const nameRegex = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\b/g;
    let match;
    while ((match = nameRegex.exec(content)) !== null) {
      // Filter out common non-names
      const skip = [
        "Thank You",
        "Dear Sir",
        "Dear Madam",
        "Good Morning",
        "Good Evening",
        "Customer Service",
      ];
      if (!skip.some((s) => match![0].includes(s))) {
        entities.push({
          text: match[0],
          type: "person",
          context: this.getContext(content, match.index, match[0].length),
        });
      }
    }

    // Extract product/service mentions
    const productPatterns = [
      { regex: /\b(\w+\s+(?:product|service|plan|package|subscription|membership))\b/gi, type: "product" },
      { regex: /\b((?:basic|premium|pro|enterprise|starter|growth)\s+(?:plan|tier|package))\b/gi, type: "product" },
    ];
    for (const { regex, type } of productPatterns) {
      while ((match = regex.exec(content)) !== null) {
        entities.push({
          text: match[0],
          type,
          context: this.getContext(content, match.index, match[0].length),
        });
      }
    }

    // Extract location mentions
    const locationRegex = /\b(?:at|in|near|on)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,3})\b/g;
    while ((match = locationRegex.exec(content)) !== null) {
      entities.push({
        text: match[1],
        type: "location",
        context: this.getContext(content, match.index, match[0].length),
      });
    }

    // Deduplicate
    const seen = new Set<string>();
    return entities.filter((e) => {
      const key = `${e.type}:${e.text.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private getContext(text: string, start: number, length: number): string {
    const contextSize = 40;
    const from = Math.max(0, start - contextSize);
    const to = Math.min(text.length, start + length + contextSize);
    let ctx = text.slice(from, to).trim();
    if (from > 0) ctx = "..." + ctx;
    if (to < text.length) ctx = ctx + "...";
    return ctx;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private calculateCompositeRisk(
    sentiment: SentimentResult,
    escalation: EscalationPrediction | null,
    rating: number,
  ): RiskLevel {
    // Multiple signals contribute to risk
    let riskScore = 0;

    // Sentiment-based risk
    if (sentiment.score < -0.5) riskScore += 0.3;
    else if (sentiment.score < -0.2) riskScore += 0.15;
    else if (sentiment.score < 0) riskScore += 0.05;

    // Rating-based risk
    if (rating === 1) riskScore += 0.3;
    else if (rating === 2) riskScore += 0.2;
    else if (rating === 3) riskScore += 0.05;

    // Escalation prediction
    if (escalation) {
      riskScore += escalation.escalationProbability * 0.4;
    }

    riskScore = Math.min(1, riskScore);

    if (riskScore >= 0.8) return "CRITICAL";
    if (riskScore >= 0.6) return "HIGH";
    if (riskScore >= 0.35) return "MODERATE";
    return "LOW";
  }

  private generateSuggestedAction(
    riskLevel: RiskLevel,
    intent: IntentResult,
    escalation: EscalationPrediction | null,
  ): string {
    if (riskLevel === "CRITICAL") {
      if (intent.primary === "threat_legal") {
        return "Immediately escalate to legal team. Do not respond without counsel review.";
      }
      if (intent.primary === "threat_social") {
        return "Priority: personal outreach within 1 hour. Offer direct management contact.";
      }
      return "Immediate personal outreach required. Escalate to management.";
    }

    if (riskLevel === "HIGH") {
      if (intent.primary === "request_refund") {
        return "Process refund request promptly. Follow up with service recovery offer.";
      }
      if (intent.primary === "request_callback") {
        return "Schedule callback within 2 hours. Prepare resolution options.";
      }
      return "Assign to senior team member. Respond within 4 hours with personalized message.";
    }

    if (riskLevel === "MODERATE") {
      if (intent.primary === "suggestion") {
        return "Acknowledge feedback and share with product team. Thank customer for input.";
      }
      if (intent.primary === "complaint") {
        return "Send empathetic response within 24 hours. Offer resolution.";
      }
      return "Standard follow-up within 24 hours. Monitor for escalation.";
    }

    // LOW risk
    if (intent.primary === "praise") {
      return "Send thank-you response. Consider requesting public review.";
    }
    if (intent.primary === "question") {
      return "Route to support team for prompt answer.";
    }
    return "Standard acknowledgment. No immediate action required.";
  }

  private buildAlertDescription(
    customerName: string,
    rating: number,
    sentiment: SentimentResult,
    escalation: EscalationPrediction,
    content: string,
  ): string {
    const truncatedContent =
      content.length > 200 ? content.slice(0, 200) + "..." : content;

    const parts = [
      `Customer "${customerName}" submitted feedback with rating ${rating}/5.`,
      `Sentiment: ${sentiment.label} (score: ${sentiment.score}).`,
      `Escalation probability: ${(escalation.escalationProbability * 100).toFixed(0)}%.`,
      `Churn probability: ${(escalation.churnProbability * 100).toFixed(0)}%.`,
    ];

    if (escalation.signals.length > 0) {
      parts.push(`Signals: ${escalation.signals.slice(0, 3).join("; ")}.`);
    }

    parts.push(`Content preview: "${truncatedContent}"`);

    return parts.join(" ");
  }

  private averageConfidence(...values: (number | undefined | null)[]): number {
    const valid = values.filter(
      (v): v is number => v !== undefined && v !== null,
    );
    if (valid.length === 0) return 0.5;
    const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
    return Math.round(avg * 100) / 100;
  }

  private async recordUsage(
    tenantId: string,
    promptTokens: number,
    completionTokens: number,
    modelId: string,
  ): Promise<void> {
    try {
      await prisma.usageMeter.create({
        data: {
          tenantId,
          meterType: "AI_INFERENCE",
          quantity: 1,
          unitCost: estimateCost(
            modelId as "gpt-4o-2024-05-13" | "gpt-4o-mini-2024-07-18" | "text-embedding-3-small",
            promptTokens,
            completionTokens,
          ),
          metadata: {
            modelId,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
          },
        },
      });
    } catch (err) {
      console.error("Failed to record AI usage meter:", err);
    }
  }
}
