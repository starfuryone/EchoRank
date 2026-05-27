import { prisma } from "@/lib/prisma";
import type { MonitoringPlatform, MonitoringSource, Prisma } from "@/generated/prisma";
import { ReviewNormalizer, type ExternalReviewInput } from "../normalizer";
import { DeduplicationService } from "../deduplication";
import { GoogleAdapter } from "../platforms/google";
import { TrustpilotAdapter } from "../platforms/trustpilot";
import { YelpAdapter } from "../platforms/yelp";
import { RedditAdapter } from "../platforms/reddit";
import { TwitterAdapter } from "../platforms/twitter";
import { FacebookAdapter } from "../platforms/facebook";
import type { PlatformAdapter } from "../platforms/base";

export class IngestionPipeline {
  private normalizer: ReviewNormalizer;
  private deduplication: DeduplicationService;
  private adapters: Map<MonitoringPlatform, PlatformAdapter>;

  constructor() {
    this.normalizer = new ReviewNormalizer();
    this.deduplication = new DeduplicationService();

    this.adapters = new Map<MonitoringPlatform, PlatformAdapter>([
      ["GOOGLE", new GoogleAdapter()],
      ["TRUSTPILOT", new TrustpilotAdapter()],
      ["YELP", new YelpAdapter()],
      ["REDDIT", new RedditAdapter()],
      ["TWITTER", new TwitterAdapter()],
      ["FACEBOOK", new FacebookAdapter()],
    ]);
  }

  /**
   * Ingest reviews from a specific monitoring source.
   * Fetches, normalizes, deduplicates, and stores new reviews.
   * Returns the count of new reviews ingested.
   */
  async ingest(tenantId: string, sourceId: string): Promise<number> {
    // Load the source
    const source = await prisma.monitoringSource.findFirst({
      where: { id: sourceId, tenantId, isActive: true },
    });

    if (!source) {
      throw new Error(`Source ${sourceId} not found or inactive`);
    }

    // Get the platform adapter
    const adapter = this.adapters.get(source.platform);
    if (!adapter) {
      throw new Error(`No adapter registered for platform: ${source.platform}`);
    }

    // Fetch reviews from the platform
    const since = source.lastCheckedAt ?? undefined;
    const rawReviews = await adapter.fetchReviews(source, since);

    if (rawReviews.length === 0) {
      // Record the usage meter even if no reviews found
      await this.recordUsageMeter(tenantId);
      return 0;
    }

    // Normalize all reviews
    const normalized = rawReviews.map((raw) =>
      this.normalizer.normalize(raw, source.platform, tenantId, sourceId)
    );

    // Batch deduplication check
    const deduplicationKeys = normalized.map((r) => r.deduplicationKey);
    const existingKeys = await this.deduplication.findExistingKeys(deduplicationKeys);

    // Filter out duplicates
    const newReviews = normalized.filter(
      (r) => !existingKeys.has(r.deduplicationKey)
    );

    if (newReviews.length === 0) {
      await this.recordUsageMeter(tenantId);
      return 0;
    }

    // Store new reviews in bulk
    const created = await prisma.externalReview.createMany({
      data: newReviews.map((r) => ({
        tenantId: r.tenantId,
        sourceId: r.sourceId,
        platform: r.platform,
        externalId: r.externalId,
        authorName: r.authorName,
        authorUrl: r.authorUrl,
        rating: r.rating,
        content: r.content,
        language: r.language,
        publishedAt: r.publishedAt,
        url: r.url,
        deduplicationKey: r.deduplicationKey,
        metadata: r.metadata,
        isProcessed: false,
      })),
      skipDuplicates: true,
    });

    // Trigger AI processing for each new review
    for (const review of newReviews) {
      await this.processNewReview(tenantId, review);
    }

    // Record usage meter for monitoring check
    await this.recordUsageMeter(tenantId);

    return created.count;
  }

  /**
   * Process a single new review through AI enrichment.
   * Assigns sentiment and risk level based on content analysis.
   */
  async processNewReview(
    tenantId: string,
    review: ExternalReviewInput
  ): Promise<void> {
    // Basic sentiment and risk analysis
    // In production, this would call the AI analysis service
    const { sentimentLabel, sentimentScore, riskLevel } =
      this.analyzeReview(review);

    // Update the review with analysis results
    await prisma.externalReview.updateMany({
      where: { deduplicationKey: review.deduplicationKey },
      data: {
        sentimentLabel,
        sentimentScore,
        riskLevel,
      },
    });
  }

  /**
   * Simple rule-based analysis for initial processing.
   * Real implementation would use the AI analysis service.
   */
  private analyzeReview(review: ExternalReviewInput): {
    sentimentLabel: string;
    sentimentScore: number;
    riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  } {
    const content = (review.content ?? "").toLowerCase();
    const rating = review.rating;

    // Risk keywords
    const criticalKeywords = ["lawsuit", "legal", "attorney", "fraud", "scam", "sue"];
    const highRiskKeywords = [
      "terrible", "worst", "awful", "disgusting", "never again",
      "warning", "beware", "dangerous", "unsafe", "hidden fees",
    ];
    const moderateRiskKeywords = [
      "disappointed", "overpriced", "rude", "slow", "mediocre",
      "wouldn't recommend", "not worth", "let down", "gone downhill",
    ];

    // Check for critical risk keywords
    if (criticalKeywords.some((kw) => content.includes(kw))) {
      return { sentimentLabel: "negative", sentimentScore: -0.9, riskLevel: "CRITICAL" };
    }

    // Check for high risk keywords
    if (highRiskKeywords.some((kw) => content.includes(kw))) {
      return { sentimentLabel: "negative", sentimentScore: -0.7, riskLevel: "HIGH" };
    }

    // Rating-based assessment
    if (rating != null) {
      if (rating <= 1) {
        return { sentimentLabel: "negative", sentimentScore: -0.8, riskLevel: "HIGH" };
      }
      if (rating === 2) {
        const hasModerateRisk = moderateRiskKeywords.some((kw) => content.includes(kw));
        return {
          sentimentLabel: "negative",
          sentimentScore: -0.5,
          riskLevel: hasModerateRisk ? "HIGH" : "MODERATE",
        };
      }
      if (rating === 3) {
        return { sentimentLabel: "neutral", sentimentScore: 0.0, riskLevel: "MODERATE" };
      }
      if (rating === 4) {
        return { sentimentLabel: "positive", sentimentScore: 0.5, riskLevel: "LOW" };
      }
      return { sentimentLabel: "positive", sentimentScore: 0.8, riskLevel: "LOW" };
    }

    // Content-only analysis for platforms without ratings (Reddit, Twitter)
    if (moderateRiskKeywords.some((kw) => content.includes(kw))) {
      return { sentimentLabel: "negative", sentimentScore: -0.4, riskLevel: "MODERATE" };
    }

    const positiveKeywords = [
      "amazing", "excellent", "fantastic", "love", "great",
      "recommend", "best", "outstanding", "impressed", "perfect",
    ];

    if (positiveKeywords.some((kw) => content.includes(kw))) {
      return { sentimentLabel: "positive", sentimentScore: 0.6, riskLevel: "LOW" };
    }

    return { sentimentLabel: "neutral", sentimentScore: 0.0, riskLevel: "LOW" };
  }

  /**
   * Record a usage meter event for a monitoring check.
   */
  private async recordUsageMeter(tenantId: string): Promise<void> {
    await prisma.usageMeter.create({
      data: {
        tenantId,
        meterType: "MONITORING_CHECK",
        quantity: 1,
        metadata: { timestamp: new Date().toISOString() } as Prisma.InputJsonValue,
      },
    });
  }
}
