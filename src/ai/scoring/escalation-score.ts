// ---------------------------------------------------------------------------
// Escalation Score Calculator – multi-factor escalation scoring
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import type { RiskLevel } from "@/generated/prisma";
import {
  ESCALATION_THRESHOLDS,
  RISK_LEVEL_THRESHOLDS,
} from "@/ai/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EscalationFactors {
  sentimentFactor: number; // 0-1 (higher = more at-risk)
  ratingFactor: number;
  historyFactor: number;
  recencyFactor: number;
  frequencyFactor: number;
  contentFactor: number;
}

export interface CompositeEscalationScore {
  score: number; // 0-1
  riskLevel: RiskLevel;
  factors: EscalationFactors;
  shouldAlert: boolean;
  isCritical: boolean;
}

export interface AlertThresholdConfig {
  alertThreshold: number;
  criticalThreshold: number;
  cooldownMinutes: number;
}

// ---------------------------------------------------------------------------
// Calculator
// ---------------------------------------------------------------------------

export class EscalationScoreCalculator {
  private thresholds: AlertThresholdConfig;

  constructor(thresholds?: Partial<AlertThresholdConfig>) {
    this.thresholds = {
      alertThreshold: thresholds?.alertThreshold ?? ESCALATION_THRESHOLDS.ALERT,
      criticalThreshold:
        thresholds?.criticalThreshold ?? ESCALATION_THRESHOLDS.CRITICAL_ALERT,
      cooldownMinutes: thresholds?.cooldownMinutes ?? 60,
    };
  }

  // -----------------------------------------------------------------------
  // Multi-factor scoring
  // -----------------------------------------------------------------------

  /**
   * Calculate composite escalation score from multiple factors.
   */
  calculateComposite(factors: EscalationFactors): CompositeEscalationScore {
    // Weighted combination
    const weights = {
      sentiment: 0.2,
      rating: 0.2,
      history: 0.15,
      recency: 0.15,
      frequency: 0.15,
      content: 0.15,
    };

    const score = Math.min(
      1,
      factors.sentimentFactor * weights.sentiment +
        factors.ratingFactor * weights.rating +
        factors.historyFactor * weights.history +
        factors.recencyFactor * weights.recency +
        factors.frequencyFactor * weights.frequency +
        factors.contentFactor * weights.content,
    );

    const riskLevel = this.scoreToRiskLevel(score);
    const shouldAlert = score >= this.thresholds.alertThreshold;
    const isCritical = score >= this.thresholds.criticalThreshold;

    return {
      score: Math.round(score * 100) / 100,
      riskLevel,
      factors,
      shouldAlert,
      isCritical,
    };
  }

  // -----------------------------------------------------------------------
  // Customer history weighting
  // -----------------------------------------------------------------------

  /**
   * Calculate history factor based on customer's previous feedback.
   */
  async calculateHistoryFactor(
    tenantId: string,
    customerId: string,
  ): Promise<{ historyFactor: number; frequencyFactor: number; recencyFactor: number }> {
    const feedback = await prisma.feedback.findMany({
      where: {
        tenantId,
        customerId,
        status: "SUBMITTED",
        rating: { not: null },
      },
      orderBy: { submittedAt: "desc" },
      take: 20,
      select: {
        rating: true,
        submittedAt: true,
        createdAt: true,
      },
    });

    if (feedback.length === 0) {
      return { historyFactor: 0.3, frequencyFactor: 0.1, recencyFactor: 0.1 };
    }

    // History factor: based on average of past ratings
    const ratings = feedback
      .map((f) => f.rating)
      .filter((r): r is number => r !== null);
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 3;
    // Map: 1->1.0, 3->0.4, 5->0.0
    const historyFactor = Math.max(0, Math.min(1, (5 - avgRating) / 4));

    // Negative trend factor: increasing negativity over time
    const recentRatings = ratings.slice(0, 3);
    const olderRatings = ratings.slice(3, 6);
    let trendBoost = 0;
    if (recentRatings.length > 0 && olderRatings.length > 0) {
      const recentAvg =
        recentRatings.reduce((a, b) => a + b, 0) / recentRatings.length;
      const olderAvg =
        olderRatings.reduce((a, b) => a + b, 0) / olderRatings.length;
      if (recentAvg < olderAvg) {
        trendBoost = Math.min(0.3, (olderAvg - recentAvg) / 4);
      }
    }

    // Frequency factor: how often they complain
    const negativeCount = ratings.filter((r) => r <= 2).length;
    const frequencyFactor = Math.min(1, negativeCount / 5);

    // Recency factor: how recently did they submit negative feedback
    const recencyFactor = this.calculateRecencyFactor(feedback);

    return {
      historyFactor: Math.min(1, historyFactor + trendBoost),
      frequencyFactor,
      recencyFactor,
    };
  }

  // -----------------------------------------------------------------------
  // Temporal risk factors
  // -----------------------------------------------------------------------

  /**
   * Recency: more recent negative events increase risk.
   */
  private calculateRecencyFactor(
    feedback: { rating: number | null; submittedAt: Date | null; createdAt: Date }[],
  ): number {
    const now = Date.now();
    const negativeFeedback = feedback.filter(
      (f) => f.rating !== null && f.rating <= 2,
    );

    if (negativeFeedback.length === 0) return 0;

    // Most recent negative feedback
    const mostRecent = negativeFeedback[0];
    const ts = mostRecent.submittedAt ?? mostRecent.createdAt;
    const daysSince = (now - ts.getTime()) / (1000 * 60 * 60 * 24);

    // Decay: very recent -> 1.0, 30 days ago -> ~0.3, 90+ days -> ~0
    if (daysSince <= 1) return 1.0;
    if (daysSince <= 7) return 0.8;
    if (daysSince <= 14) return 0.6;
    if (daysSince <= 30) return 0.4;
    if (daysSince <= 60) return 0.2;
    return 0.1;
  }

  /**
   * Rating factor: converts 1-5 rating to risk score 0-1.
   */
  static ratingToFactor(rating: number): number {
    switch (rating) {
      case 1:
        return 1.0;
      case 2:
        return 0.75;
      case 3:
        return 0.4;
      case 4:
        return 0.15;
      case 5:
        return 0.0;
      default:
        return 0.5;
    }
  }

  /**
   * Sentiment score to factor: converts -1..1 sentiment to 0..1 risk.
   */
  static sentimentToFactor(sentimentScore: number): number {
    // -1 -> 1.0, 0 -> 0.5, 1 -> 0.0
    return Math.max(0, Math.min(1, (1 - sentimentScore) / 2));
  }

  // -----------------------------------------------------------------------
  // Alert threshold management
  // -----------------------------------------------------------------------

  /**
   * Check whether an alert should be created (respects cooldown).
   */
  async shouldCreateAlert(
    tenantId: string,
    feedbackId: string,
    score: number,
  ): Promise<boolean> {
    if (score < this.thresholds.alertThreshold) return false;

    // Check cooldown: don't create duplicate alerts for the same feedback
    const existing = await prisma.escalationAlert.findFirst({
      where: {
        tenantId,
        feedbackId,
        createdAt: {
          gte: new Date(Date.now() - this.thresholds.cooldownMinutes * 60 * 1000),
        },
      },
    });

    return !existing;
  }

  /**
   * Create an escalation alert.
   */
  async createAlert(params: {
    tenantId: string;
    customerId?: string;
    feedbackId?: string;
    externalReviewId?: string;
    alertType: string;
    probability: number;
    title: string;
    description: string;
    suggestedAction?: string;
  }): Promise<void> {
    const riskLevel = this.scoreToRiskLevel(params.probability);

    await prisma.escalationAlert.create({
      data: {
        tenantId: params.tenantId,
        customerId: params.customerId,
        feedbackId: params.feedbackId,
        externalReviewId: params.externalReviewId,
        alertType: params.alertType,
        riskLevel,
        probability: params.probability,
        title: params.title,
        description: params.description,
        suggestedAction: params.suggestedAction,
      },
    });
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private scoreToRiskLevel(score: number): RiskLevel {
    if (score >= RISK_LEVEL_THRESHOLDS.CRITICAL) return "CRITICAL";
    if (score >= RISK_LEVEL_THRESHOLDS.HIGH) return "HIGH";
    if (score >= RISK_LEVEL_THRESHOLDS.MODERATE) return "MODERATE";
    return "LOW";
  }
}
