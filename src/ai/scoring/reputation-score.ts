// ---------------------------------------------------------------------------
// Reputation Score Calculator – core scoring algorithms
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import type { RiskLevel } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreBreakdown {
  raw: number;
  normalized: number;
  weight: number;
  weighted: number;
}

export interface NormalizedScores {
  sentiment: ScoreBreakdown;
  responseRate: ScoreBreakdown;
  recovery: ScoreBreakdown;
  reviewVelocity: ScoreBreakdown;
  inverseVolatility: ScoreBreakdown;
  overall: number;
}

export interface TrendResult {
  direction: "improving" | "stable" | "declining";
  currentScore: number;
  previousScore: number;
  delta: number;
  percentChange: number;
}

export interface LocationComparison {
  location: string;
  overallScore: number;
  sentimentScore: number;
  riskLevel: RiskLevel;
  trendDirection: string;
  sampleSize: number;
}

// ---------------------------------------------------------------------------
// Calculator
// ---------------------------------------------------------------------------

export class ReputationScoreCalculator {
  // -----------------------------------------------------------------------
  // Score normalization
  // -----------------------------------------------------------------------

  /**
   * Normalize a raw value to 0-100 given expected min/max.
   */
  static normalize(
    value: number,
    min: number,
    max: number,
    clamp = true,
  ): number {
    if (max === min) return 50;
    let normalized = ((value - min) / (max - min)) * 100;
    if (clamp) {
      normalized = Math.max(0, Math.min(100, normalized));
    }
    return Math.round(normalized * 100) / 100;
  }

  /**
   * Normalize a rating on 1-5 scale to 0-100.
   */
  static normalizeRating(rating: number): number {
    return ReputationScoreCalculator.normalize(rating, 1, 5);
  }

  /**
   * Normalize a percentage (0-1 ratio) to 0-100.
   */
  static normalizePercentage(ratio: number): number {
    return Math.round(Math.max(0, Math.min(100, ratio * 100)) * 100) / 100;
  }

  // -----------------------------------------------------------------------
  // Confidence calculation based on sample size
  // -----------------------------------------------------------------------

  /**
   * Calculate a confidence value (0-1) based on sample size.
   * Uses a logarithmic curve: confidence = 1 - 1/(1 + ln(1 + n/k))
   * where k controls steepness (default 10).
   */
  static calculateConfidence(sampleSize: number, k = 10): number {
    if (sampleSize <= 0) return 0.05;
    const raw = 1 - 1 / (1 + Math.log(1 + sampleSize / k));
    return Math.round(Math.max(0.05, Math.min(0.99, raw)) * 100) / 100;
  }

  // -----------------------------------------------------------------------
  // Trend detection
  // -----------------------------------------------------------------------

  /**
   * Detect trend by comparing current vs previous score.
   */
  static detectTrend(currentScore: number, previousScore: number): TrendResult {
    const delta = currentScore - previousScore;
    const percentChange =
      previousScore !== 0
        ? Math.round((delta / previousScore) * 100 * 10) / 10
        : 0;

    let direction: TrendResult["direction"];
    if (delta > 5) direction = "improving";
    else if (delta < -5) direction = "declining";
    else direction = "stable";

    return { direction, currentScore, previousScore, delta, percentChange };
  }

  /**
   * Detect trend from an array of scores over time using linear regression.
   */
  static detectTrendFromSeries(
    scores: { date: Date; score: number }[],
  ): TrendResult["direction"] {
    if (scores.length < 2) return "stable";

    // Simple linear regression on index vs score
    const n = scores.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += scores[i].score;
      sumXY += i * scores[i].score;
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    if (slope > 0.5) return "improving";
    if (slope < -0.5) return "declining";
    return "stable";
  }

  // -----------------------------------------------------------------------
  // Location comparison
  // -----------------------------------------------------------------------

  /**
   * Retrieve latest reputation scores per location for comparison.
   */
  static async getLocationComparison(
    tenantId: string,
  ): Promise<LocationComparison[]> {
    // Fetch the latest score per distinct location
    const scores = await prisma.reputationScore.findMany({
      where: { tenantId, location: { not: null } },
      orderBy: { createdAt: "desc" },
      distinct: ["location"],
      select: {
        location: true,
        overallScore: true,
        sentimentScore: true,
        riskLevel: true,
        trendDirection: true,
        sampleSize: true,
      },
    });

    return scores.map((s) => ({
      location: s.location!,
      overallScore: s.overallScore,
      sentimentScore: s.sentimentScore,
      riskLevel: s.riskLevel,
      trendDirection: s.trendDirection,
      sampleSize: s.sampleSize,
    }));
  }

  // -----------------------------------------------------------------------
  // Historical score retrieval
  // -----------------------------------------------------------------------

  /**
   * Get historical reputation scores for charting.
   */
  static async getHistoricalScores(
    tenantId: string,
    options?: {
      location?: string;
      limit?: number;
      since?: Date;
    },
  ) {
    const where: Record<string, unknown> = { tenantId };
    if (options?.location) where.location = options.location;
    else where.location = null; // global scores only

    if (options?.since) {
      where.createdAt = { gte: options.since };
    }

    return prisma.reputationScore.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit ?? 30,
      select: {
        overallScore: true,
        sentimentScore: true,
        responseRateScore: true,
        recoveryScore: true,
        reviewVelocityScore: true,
        volatilityIndex: true,
        riskLevel: true,
        trendDirection: true,
        periodStart: true,
        periodEnd: true,
        sampleSize: true,
        confidence: true,
        createdAt: true,
      },
    });
  }

  /**
   * Get the most recent reputation score for a tenant (and optionally location).
   */
  static async getLatestScore(tenantId: string, location?: string) {
    return prisma.reputationScore.findFirst({
      where: {
        tenantId,
        location: location ?? null,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // -----------------------------------------------------------------------
  // Risk level utilities
  // -----------------------------------------------------------------------

  static scoreToRiskLevel(score: number): RiskLevel {
    if (score > 80) return "LOW";
    if (score > 60) return "MODERATE";
    if (score > 40) return "HIGH";
    return "CRITICAL";
  }

  static riskLevelToNumeric(level: RiskLevel): number {
    switch (level) {
      case "LOW":
        return 1;
      case "MODERATE":
        return 2;
      case "HIGH":
        return 3;
      case "CRITICAL":
        return 4;
    }
  }

  static riskLevelFromNumeric(n: number): RiskLevel {
    if (n <= 1) return "LOW";
    if (n <= 2) return "MODERATE";
    if (n <= 3) return "HIGH";
    return "CRITICAL";
  }
}
