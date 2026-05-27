// ---------------------------------------------------------------------------
// Churn Score Calculator
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import type { RiskLevel } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChurnAssessment {
  probability: number; // 0-1
  riskLevel: RiskLevel;
  contributingFactors: string[];
  retentionSuggestions: string[];
}

interface CustomerSignals {
  satisfactionTrend: number; // -1 (declining) to 1 (improving)
  engagementDecay: number; // 0 (active) to 1 (disengaged)
  recoveryOutcomeScore: number; // 0 (poor) to 1 (good)
  competitiveMentions: number; // count
  averageRating: number;
  feedbackCount: number;
  latestRating: number | null;
  daysSinceLastFeedback: number;
  hasOpenTicket: boolean;
  negativeStreak: number; // consecutive negative ratings
}

// ---------------------------------------------------------------------------
// Calculator
// ---------------------------------------------------------------------------

export class ChurnScoreCalculator {
  /**
   * Assess churn probability for a customer within a tenant.
   */
  async assess(tenantId: string, customerId: string): Promise<ChurnAssessment> {
    const signals = await this.gatherSignals(tenantId, customerId);
    return this.calculateFromSignals(signals);
  }

  /**
   * Batch assess churn for multiple customers.
   */
  async batchAssess(
    tenantId: string,
    customerIds: string[],
  ): Promise<Map<string, ChurnAssessment>> {
    const results = new Map<string, ChurnAssessment>();
    // Process in parallel with concurrency limit
    const batchSize = 10;
    for (let i = 0; i < customerIds.length; i += batchSize) {
      const batch = customerIds.slice(i, i + batchSize);
      const assessments = await Promise.all(
        batch.map(async (cid) => ({
          id: cid,
          result: await this.assess(tenantId, cid),
        })),
      );
      for (const a of assessments) {
        results.set(a.id, a.result);
      }
    }
    return results;
  }

  // -----------------------------------------------------------------------
  // Signal gathering
  // -----------------------------------------------------------------------

  private async gatherSignals(
    tenantId: string,
    customerId: string,
  ): Promise<CustomerSignals> {
    const [feedback, openTickets, recoveryTickets] = await Promise.all([
      prisma.feedback.findMany({
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
          comment: true,
          submittedAt: true,
          createdAt: true,
        },
      }),
      prisma.recoveryTicket.count({
        where: { tenantId, customerId, status: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
      prisma.recoveryTicket.findMany({
        where: { tenantId, customerId },
        select: { status: true },
      }),
    ]);

    const ratings = feedback
      .map((f) => f.rating)
      .filter((r): r is number => r !== null);
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0;

    // Satisfaction trend: compare first half vs second half
    let satisfactionTrend = 0;
    if (ratings.length >= 4) {
      const mid = Math.floor(ratings.length / 2);
      const recentHalf = ratings.slice(0, mid);
      const olderHalf = ratings.slice(mid);
      const recentAvg =
        recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
      const olderAvg =
        olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;
      satisfactionTrend = (recentAvg - olderAvg) / 4; // normalize to -1..1
    }

    // Engagement decay: days since last feedback
    const latestFeedback = feedback[0];
    let daysSinceLastFeedback = 365;
    if (latestFeedback) {
      const ts = latestFeedback.submittedAt ?? latestFeedback.createdAt;
      daysSinceLastFeedback = Math.floor(
        (Date.now() - ts.getTime()) / (1000 * 60 * 60 * 24),
      );
    }
    // Normalize: 0 days -> 0, 90+ days -> 1
    const engagementDecay = Math.min(1, daysSinceLastFeedback / 90);

    // Recovery outcome score
    const resolvedTickets = recoveryTickets.filter(
      (t) => t.status === "RESOLVED" || t.status === "CLOSED",
    ).length;
    const totalTickets = recoveryTickets.length;
    const recoveryOutcomeScore =
      totalTickets > 0 ? resolvedTickets / totalTickets : 0.5;

    // Competitive mentions in feedback comments
    const competitorRegex =
      /\b(competitor|alternative|switching|switched|other company|better option)\b/gi;
    let competitiveMentions = 0;
    for (const f of feedback) {
      if (f.comment) {
        const matches = f.comment.match(competitorRegex);
        if (matches) competitiveMentions += matches.length;
      }
    }

    // Negative streak
    let negativeStreak = 0;
    for (const r of ratings) {
      if (r <= 2) negativeStreak++;
      else break;
    }

    return {
      satisfactionTrend,
      engagementDecay,
      recoveryOutcomeScore,
      competitiveMentions,
      averageRating: avgRating,
      feedbackCount: ratings.length,
      latestRating: ratings.length > 0 ? ratings[0] : null,
      daysSinceLastFeedback,
      hasOpenTicket: openTickets > 0,
      negativeStreak,
    };
  }

  // -----------------------------------------------------------------------
  // Calculation from signals
  // -----------------------------------------------------------------------

  private calculateFromSignals(signals: CustomerSignals): ChurnAssessment {
    let probability = 0;
    const factors: string[] = [];
    const suggestions: string[] = [];

    // 1. Satisfaction history (weight: 25%)
    if (signals.averageRating > 0) {
      // Map avg rating: 1->0.25, 2->0.2, 3->0.1, 4->0.05, 5->0
      const satFactor = Math.max(0, (5 - signals.averageRating) / 4) * 0.25;
      probability += satFactor;
      if (signals.averageRating <= 2.5) {
        factors.push(
          `Low average satisfaction (${signals.averageRating.toFixed(1)}/5)`,
        );
        suggestions.push("Schedule personal outreach to understand concerns");
      }
    }

    // 2. Satisfaction trend (weight: 15%)
    if (signals.satisfactionTrend < -0.1) {
      const trendFactor = Math.min(0.15, Math.abs(signals.satisfactionTrend) * 0.15);
      probability += trendFactor;
      factors.push("Declining satisfaction trend");
      suggestions.push("Investigate recent experience changes");
    }

    // 3. Engagement decay (weight: 20%)
    if (signals.engagementDecay > 0.3) {
      probability += signals.engagementDecay * 0.2;
      if (signals.daysSinceLastFeedback > 60) {
        factors.push(
          `No engagement for ${signals.daysSinceLastFeedback} days`,
        );
        suggestions.push("Send re-engagement campaign");
      } else if (signals.daysSinceLastFeedback > 30) {
        factors.push("Declining engagement frequency");
        suggestions.push("Send check-in message");
      }
    }

    // 4. Recovery outcomes (weight: 15%)
    if (signals.recoveryOutcomeScore < 0.5 && signals.feedbackCount > 0) {
      const recoveryFactor = (1 - signals.recoveryOutcomeScore) * 0.15;
      probability += recoveryFactor;
      factors.push("Poor recovery ticket outcomes");
      suggestions.push("Review recovery process and assign senior staff");
    }

    // 5. Competitive mentions (weight: 10%)
    if (signals.competitiveMentions > 0) {
      const compFactor = Math.min(0.1, signals.competitiveMentions * 0.03);
      probability += compFactor;
      factors.push(
        `${signals.competitiveMentions} competitive mention(s) detected`,
      );
      suggestions.push("Prepare competitive retention offer");
    }

    // 6. Latest rating severity (weight: 10%)
    if (signals.latestRating !== null && signals.latestRating <= 2) {
      probability += signals.latestRating === 1 ? 0.1 : 0.06;
      factors.push(`Most recent rating: ${signals.latestRating}/5`);
      suggestions.push("Immediate personal follow-up on latest experience");
    }

    // 7. Negative streak bonus
    if (signals.negativeStreak >= 3) {
      probability += 0.1;
      factors.push(`${signals.negativeStreak} consecutive negative ratings`);
      suggestions.push("Escalate to customer success manager");
    } else if (signals.negativeStreak === 2) {
      probability += 0.05;
      factors.push("Two consecutive negative ratings");
    }

    // 8. Open ticket
    if (signals.hasOpenTicket) {
      probability += 0.05;
      factors.push("Has unresolved recovery ticket");
      suggestions.push("Prioritize resolution of open ticket");
    }

    // Cap
    probability = Math.min(0.95, Math.max(0, probability));

    // Default factors/suggestions if none
    if (factors.length === 0) {
      factors.push("No significant churn signals detected");
    }
    if (suggestions.length === 0) {
      suggestions.push("Continue standard engagement");
    }

    const riskLevel = this.probabilityToRiskLevel(probability);

    return {
      probability: Math.round(probability * 100) / 100,
      riskLevel,
      contributingFactors: factors,
      retentionSuggestions: suggestions,
    };
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private probabilityToRiskLevel(probability: number): RiskLevel {
    if (probability >= 0.8) return "CRITICAL";
    if (probability >= 0.6) return "HIGH";
    if (probability >= 0.35) return "MODERATE";
    return "LOW";
  }
}
