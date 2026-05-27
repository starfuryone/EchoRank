import type { MonitoringPlatform, Prisma } from "@/generated/prisma";
import type { NormalizedReview } from "./platforms/base";

export interface ExternalReviewInput {
  tenantId: string;
  sourceId: string;
  platform: MonitoringPlatform;
  externalId: string;
  authorName?: string;
  authorUrl?: string;
  rating?: number;
  content?: string;
  language?: string;
  publishedAt?: Date;
  url?: string;
  deduplicationKey: string;
  metadata: Prisma.InputJsonValue;
}

export class ReviewNormalizer {
  /**
   * Convert a platform-specific review to the ExternalReview format
   * ready for database insertion.
   */
  normalize(
    rawReview: NormalizedReview,
    platform: MonitoringPlatform,
    tenantId: string,
    sourceId: string
  ): ExternalReviewInput {
    return {
      tenantId,
      sourceId,
      platform,
      externalId: rawReview.externalId,
      authorName: rawReview.authorName ?? undefined,
      authorUrl: rawReview.authorUrl ?? undefined,
      rating: rawReview.rating != null ? this.clampRating(rawReview.rating) : undefined,
      content: rawReview.content ?? undefined,
      language: rawReview.content
        ? this.detectLanguage(rawReview.content)
        : undefined,
      publishedAt: rawReview.publishedAt ?? undefined,
      url: rawReview.url ?? undefined,
      deduplicationKey: this.generateDeduplicationKey(platform, rawReview.externalId),
      metadata: (rawReview.metadata ?? {}) as Prisma.InputJsonValue,
    };
  }

  /**
   * Create a unique deduplication key from platform + external ID.
   */
  generateDeduplicationKey(platform: MonitoringPlatform, externalId: string): string {
    return `${platform}:${externalId}`;
  }

  /**
   * Basic language detection. In production, this would use a proper NLP library
   * or API (e.g., Google Cloud Translation, franc, etc.).
   * Defaults to "en" if detection is inconclusive.
   */
  detectLanguage(content: string): string {
    if (!content || content.trim().length === 0) return "en";

    const text = content.toLowerCase();

    // Simple heuristic based on common words in major languages
    const langPatterns: Record<string, RegExp[]> = {
      es: [/\b(muy|pero|como|para|esta|tiene|mejor|peor|servicio)\b/g],
      fr: [/\b(tres|mais|comme|pour|cette|avoir|meilleur|pire|service)\b/g],
      de: [/\b(sehr|aber|wie|dieses|haben|besser|schlecht|dienst)\b/g],
      pt: [/\b(muito|mas|como|para|esta|tem|melhor|pior|servico)\b/g],
      it: [/\b(molto|pero|come|questo|avere|migliore|peggiore|servizio)\b/g],
    };

    for (const [lang, patterns] of Object.entries(langPatterns)) {
      const matchCount = patterns.reduce((count, pattern) => {
        const matches = text.match(pattern);
        return count + (matches ? matches.length : 0);
      }, 0);

      // If we find 3+ words from a language, assume that language
      if (matchCount >= 3) return lang;
    }

    return "en";
  }

  /**
   * Clamp rating to valid range (1-5).
   */
  private clampRating(rating: number): number {
    return Math.max(1, Math.min(5, Math.round(rating)));
  }
}
