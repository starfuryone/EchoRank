// ---------------------------------------------------------------------------
// Risk Scoring Pipeline – Calculates comprehensive reputation scores
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import { REPUTATION_WEIGHTS } from "@/ai/config";
import type { RiskLevel } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReputationScoreResult {
  overallScore: number;
  sentimentScore: number;
  responseRateScore: number;
  recoveryScore: number;
  reviewVelocityScore: number;
  volatilityIndex: number;
  riskLevel: RiskLevel;
  trendDirection: "improving" | "stable" | "declining";
  sampleSize: number;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export class RiskScoringPipeline {
  /**
   * Calculate a comprehensive reputation score for a tenant over a given period.
   */
  async calculateReputationScore(
    tenantId: string,
    location?: string,
    periodDays = 30,
  ): Promise<ReputationScoreResult> {
    const now = new Date();
    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(
      periodStart.getTime() - periodDays * 24 * 60 * 60 * 1000,
    );

    // Fetch data in parallel
    const [
      feedbackData,
      recoveryData,
      reviewRequestData,
      externalReviewData,
      previousFeedbackData,
      previousExternalData,
    ] = await Promise.all([
      this.fetchFeedback(tenantId, periodStart, now, location),
      this.fetchRecoveryTickets(tenantId, periodStart, now),
      this.fetchReviewRequests(tenantId, periodStart, now),
      this.fetchExternalReviews(tenantId, periodStart, now, location),
      this.fetchFeedback(tenantId, previousPeriodStart, periodStart, location),
      this.fetchExternalReviews(tenantId, previousPeriodStart, periodStart, location),
    ]);

    // 1. Sentiment Score (0-100)
    const sentimentScore = this.calculateSentimentScore(
      feedbackData,
      externalReviewData,
    );

    // 2. Response Rate Score (0-100)
    const responseRateScore = this.calculateResponseRateScore(
      feedbackData.totalSent,
      feedbackData.totalSubmitted,
    );

    // 3. Recovery Score (0-100)
    const recoveryScore = this.calculateRecoveryScore(recoveryData);

    // 4. Review Velocity Score (0-100)
    const reviewVelocityScore = this.calculateReviewVelocityScore(
      reviewRequestData,
      externalReviewData,
      periodDays,
    );

    // 5. Volatility Index (0-100, higher = more volatile = riskier)
    const volatilityIndex = this.calculateVolatilityIndex(
      feedbackData.dailyRatings,
    );

    // Overall Score (weighted average)
    const overallScore = Math.round(
      sentimentScore * REPUTATION_WEIGHTS.SENTIMENT +
        responseRateScore * REPUTATION_WEIGHTS.RESPONSE_RATE +
        recoveryScore * REPUTATION_WEIGHTS.RECOVERY +
        reviewVelocityScore * REPUTATION_WEIGHTS.REVIEW_VELOCITY +
        (100 - volatilityIndex) * REPUTATION_WEIGHTS.INVERSE_VOLATILITY,
    );

    // Trend direction
    const previousSentiment = this.calculateSentimentScore(
      previousFeedbackData,
      previousExternalData,
    );
    const trendDirection = this.detectTrend(sentimentScore, previousSentiment);

    // Risk Level
    const riskLevel = this.scoreToRiskLevel(overallScore);

    // Sample size & confidence
    const sampleSize =
      feedbackData.totalSubmitted + externalReviewData.totalReviews;
    const confidence = this.calculateConfidence(sampleSize, periodDays);

    // Store in database
    const result: ReputationScoreResult = {
      overallScore,
      sentimentScore,
      responseRateScore,
      recoveryScore,
      reviewVelocityScore,
      volatilityIndex,
      riskLevel,
      trendDirection,
      sampleSize,
      confidence,
    };

    await this.storeScore(tenantId, result, location, periodStart, now);

    return result;
  }

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  private async fetchFeedback(
    tenantId: string,
    start: Date,
    end: Date,
    location?: string,
  ) {
    const baseWhere: Record<string, unknown> = {
      tenantId,
      createdAt: { gte: start, lte: end },
    };

    const submittedWhere: Record<string, unknown> = {
      ...baseWhere,
      status: "SUBMITTED",
      rating: { not: null },
    };

    if (location) {
      baseWhere.customer = { location };
      submittedWhere.customer = { location };
    }

    const [totalSent, submittedList] = await Promise.all([
      prisma.feedback.count({ where: baseWhere }),
      prisma.feedback.findMany({
        where: submittedWhere,
        select: {
          rating: true,
          submittedAt: true,
          createdAt: true,
        },
      }),
    ]);

    // Build daily ratings map
    const dailyRatings: Record<string, number[]> = {};
    for (const f of submittedList) {
      if (f.rating === null) continue;
      const day = (f.submittedAt ?? f.createdAt).toISOString().slice(0, 10);
      if (!dailyRatings[day]) dailyRatings[day] = [];
      dailyRatings[day].push(f.rating);
    }

    const ratings = submittedList
      .map((f) => f.rating)
      .filter((r): r is number => r !== null);
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;

    return {
      totalSent,
      totalSubmitted: submittedList.length,
      avgRating,
      ratings,
      dailyRatings,
    };
  }

  private async fetchRecoveryTickets(
    tenantId: string,
    start: Date,
    end: Date,
  ) {
    const [total, resolved] = await Promise.all([
      prisma.recoveryTicket.count({
        where: { tenantId, createdAt: { gte: start, lte: end } },
      }),
      prisma.recoveryTicket.count({
        where: {
          tenantId,
          createdAt: { gte: start, lte: end },
          status: { in: ["RESOLVED", "CLOSED"] },
        },
      }),
    ]);

    return { total, resolved };
  }

  private async fetchReviewRequests(
    tenantId: string,
    start: Date,
    end: Date,
  ) {
    const [total, clicked] = await Promise.all([
      prisma.reviewRequest.count({
        where: {
          sentAt: { gte: start, lte: end },
          feedback: { tenantId },
        },
      }),
      prisma.reviewRequest.count({
        where: {
          sentAt: { gte: start, lte: end },
          feedback: { tenantId },
          clicked: true,
        },
      }),
    ]);

    return { total, clicked };
  }

  private async fetchExternalReviews(
    tenantId: string,
    start: Date,
    end: Date,
    _location?: string,
  ) {
    const where: Record<string, unknown> = {
      tenantId,
      createdAt: { gte: start, lte: end },
    };

    const reviews = await prisma.externalReview.findMany({
      where,
      select: {
        rating: true,
        sentimentScore: true,
        createdAt: true,
      },
    });

    const ratings = reviews
      .map((r) => r.rating)
      .filter((r): r is number => r !== null);
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;

    const positiveCount = ratings.filter((r) => r >= 4).length;

    return {
      totalReviews: reviews.length,
      avgRating,
      ratings,
      positiveCount,
    };
  }

  // -----------------------------------------------------------------------
  // Score calculations
  // -----------------------------------------------------------------------

  private calculateSentimentScore(
    feedbackData: { avgRating: number; totalSubmitted: number },
    externalData: { avgRating: number; totalReviews: number },
  ): number {
    const totalItems = feedbackData.totalSubmitted + externalData.totalReviews;
    if (totalItems === 0) return 50; // neutral default

    // Weighted average of internal and external ratings, normalized to 0-100
    const feedbackWeight = feedbackData.totalSubmitted;
    const externalWeight = externalData.totalReviews;
    const totalWeight = feedbackWeight + externalWeight;

    // Normalize ratings from 1-5 scale to 0-100
    const feedbackNorm = feedbackData.avgRating > 0 ? ((feedbackData.avgRating - 1) / 4) * 100 : 0;
    const externalNorm = externalData.avgRating > 0 ? ((externalData.avgRating - 1) / 4) * 100 : 0;

    const score =
      totalWeight > 0
        ? (feedbackNorm * feedbackWeight + externalNorm * externalWeight) /
          totalWeight
        : 50;

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  private calculateResponseRateScore(
    totalSent: number,
    totalSubmitted: number,
  ): number {
    if (totalSent === 0) return 50; // no data
    const rate = totalSubmitted / totalSent;
    // Map: 0% -> 0, 25% -> 50, 50%+ -> 100
    return Math.round(Math.max(0, Math.min(100, rate * 200)));
  }

  private calculateRecoveryScore(data: {
    total: number;
    resolved: number;
  }): number {
    if (data.total === 0) return 75; // no tickets = decent default
    const rate = data.resolved / data.total;
    return Math.round(rate * 100);
  }

  private calculateReviewVelocityScore(
    reviewRequests: { total: number; clicked: number },
    externalData: { positiveCount: number; totalReviews: number },
    periodDays: number,
  ): number {
    // Click-through rate of review requests
    const ctr =
      reviewRequests.total > 0
        ? reviewRequests.clicked / reviewRequests.total
        : 0;

    // Positive external review ratio
    const positiveRatio =
      externalData.totalReviews > 0
        ? externalData.positiveCount / externalData.totalReviews
        : 0;

    // Reviews per week
    const weeks = Math.max(1, periodDays / 7);
    const velocityPerWeek = externalData.totalReviews / weeks;
    // Normalize: 0 reviews/week -> 0, 5+/week -> 100
    const velocityNorm = Math.min(1, velocityPerWeek / 5);

    // Weighted combination
    const score = ctr * 30 + positiveRatio * 40 + velocityNorm * 30;
    return Math.round(Math.max(0, Math.min(100, score * 100)));
  }

  private calculateVolatilityIndex(
    dailyRatings: Record<string, number[]>,
  ): number {
    const days = Object.keys(dailyRatings);
    if (days.length < 2) return 10; // low volatility default

    // Calculate daily average ratings
    const dailyAverages = days.map((day) => {
      const ratings = dailyRatings[day];
      return ratings.reduce((a, b) => a + b, 0) / ratings.length;
    });

    // Standard deviation
    const mean =
      dailyAverages.reduce((a, b) => a + b, 0) / dailyAverages.length;
    const variance =
      dailyAverages.reduce((sum, val) => sum + (val - mean) ** 2, 0) /
      dailyAverages.length;
    const stdDev = Math.sqrt(variance);

    // Normalize stdDev to 0-100 scale (stdDev of 0 -> 0, stdDev of 2+ -> 100)
    return Math.round(Math.max(0, Math.min(100, (stdDev / 2) * 100)));
  }

  private detectTrend(
    current: number,
    previous: number,
  ): "improving" | "stable" | "declining" {
    const diff = current - previous;
    if (diff > 5) return "improving";
    if (diff < -5) return "declining";
    return "stable";
  }

  private scoreToRiskLevel(overallScore: number): RiskLevel {
    if (overallScore > 80) return "LOW";
    if (overallScore > 60) return "MODERATE";
    if (overallScore > 40) return "HIGH";
    return "CRITICAL";
  }

  private calculateConfidence(sampleSize: number, periodDays: number): number {
    // Confidence increases with sample size, with diminishing returns
    let confidence = 0;
    if (sampleSize >= 100) confidence = 0.95;
    else if (sampleSize >= 50) confidence = 0.85;
    else if (sampleSize >= 20) confidence = 0.7;
    else if (sampleSize >= 10) confidence = 0.55;
    else if (sampleSize >= 5) confidence = 0.4;
    else if (sampleSize > 0) confidence = 0.25;
    else confidence = 0.1;

    // Longer periods are slightly more reliable
    if (periodDays >= 90) confidence = Math.min(1, confidence + 0.05);

    return Math.round(confidence * 100) / 100;
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private async storeScore(
    tenantId: string,
    result: ReputationScoreResult,
    location: string | undefined,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<void> {
    await prisma.reputationScore.create({
      data: {
        tenantId,
        location: location ?? null,
        overallScore: result.overallScore,
        sentimentScore: result.sentimentScore,
        responseRateScore: result.responseRateScore,
        recoveryScore: result.recoveryScore,
        reviewVelocityScore: result.reviewVelocityScore,
        volatilityIndex: result.volatilityIndex,
        riskLevel: result.riskLevel,
        trendDirection: result.trendDirection,
        periodStart,
        periodEnd,
        sampleSize: result.sampleSize,
        confidence: result.confidence,
      },
    });
  }
}
