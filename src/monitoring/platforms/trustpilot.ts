import type { MonitoringSource } from "@/generated/prisma";
import { PlatformAdapter, type NormalizedReview } from "./base";

const AUTHOR_NAMES = [
  "Alex Thompson", "Maria Garcia", "John Smith", "Wei Chen", "Priya Patel",
  "Thomas Mueller", "Sophie Martin", "Kenji Tanaka", "Elena Volkov", "Carlos Mendoza",
  "Anna Kowalski", "Liam O'Brien", "Fatima Hassan", "Henrik Larsson", "Isabella Romano",
];

const TRUSTPILOT_POSITIVE = [
  "Exceeded all my expectations. The customer support team was responsive and truly helpful. Will be using this service again.",
  "I was initially hesitant but I'm so glad I chose this company. Professional, reliable, and great communication throughout.",
  "Trustpilot brought me here and I'm not disappointed. Top-notch quality and fair pricing. Highly recommend!",
  "From initial inquiry to final delivery, everything was smooth and professional. A rare find these days.",
];

const TRUSTPILOT_NEUTRAL = [
  "Good service overall. Took a bit longer than expected but the end result was satisfactory.",
  "Nothing wrong with the service but nothing exceptional either. Fairly standard experience.",
  "Product was as described. Delivery was a day late but customer service apologized promptly.",
];

const TRUSTPILOT_NEGATIVE = [
  "Extremely poor communication. Had to chase for updates multiple times. The final result was mediocre at best.",
  "Don't believe the positive reviews. My experience was frustrating from start to finish. Save yourself the trouble.",
  "Overpriced for what you get. I've found much better alternatives since. Very disappointed overall.",
];

export class TrustpilotAdapter extends PlatformAdapter {
  get platformName(): string {
    return "TRUSTPILOT";
  }

  async fetchReviews(
    source: MonitoringSource,
    since?: Date
  ): Promise<NormalizedReview[]> {
    const seed = `${source.externalId}-tp-${Date.now().toString(36)}`;
    const count = Math.floor(this.seededRandom(seed) * 5); // 0-4 reviews

    const reviews: NormalizedReview[] = [];

    for (let i = 0; i < count; i++) {
      const reviewSeed = `${seed}-${i}`;
      const rand = this.seededRandom(reviewSeed);

      let rating: number;
      let content: string;
      if (rand < 0.2) {
        rating = Math.random() < 0.5 ? 1 : 2;
        content = TRUSTPILOT_NEGATIVE[Math.floor(Math.random() * TRUSTPILOT_NEGATIVE.length)];
      } else if (rand < 0.4) {
        rating = 3;
        content = TRUSTPILOT_NEUTRAL[Math.floor(Math.random() * TRUSTPILOT_NEUTRAL.length)];
      } else {
        rating = Math.random() < 0.4 ? 4 : 5;
        content = TRUSTPILOT_POSITIVE[Math.floor(Math.random() * TRUSTPILOT_POSITIVE.length)];
      }

      const authorName = AUTHOR_NAMES[Math.floor(Math.random() * AUTHOR_NAMES.length)];
      const publishedAt = new Date(
        Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
      );

      if (since && publishedAt < since) continue;

      const externalId = `tp_${source.externalId}_${Date.now()}_${i}`;

      reviews.push({
        externalId,
        authorName,
        authorUrl: `https://www.trustpilot.com/users/${externalId}`,
        rating,
        content,
        language: "en",
        publishedAt,
        url: `https://www.trustpilot.com/reviews/${source.externalId}#${externalId}`,
        metadata: {
          platform: "trustpilot",
          businessUnitId: source.externalId,
          verified: Math.random() > 0.3,
        },
      });
    }

    return reviews;
  }

  validateCredentials(
    credentials: Record<string, unknown>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!credentials.businessUnitId || typeof credentials.businessUnitId !== "string") {
      errors.push("Trustpilot Business Unit ID is required");
    }

    if (!credentials.apiKey || typeof credentials.apiKey !== "string") {
      errors.push("Trustpilot API key is required");
    }

    return { valid: errors.length === 0, errors };
  }
}
