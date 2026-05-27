import type { MonitoringSource } from "@/generated/prisma";
import { PlatformAdapter, type NormalizedReview } from "./base";

const FIRST_NAMES = [
  "Sarah", "Michael", "Jennifer", "David", "Emily",
  "James", "Lisa", "Robert", "Amanda", "Christopher",
  "Jessica", "Daniel", "Ashley", "Matthew", "Stephanie",
  "Andrew", "Nicole", "Joshua", "Megan", "Ryan",
];

const LAST_INITIALS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const POSITIVE_REVIEWS = [
  "Absolutely fantastic experience! The staff were incredibly professional and attentive. Would highly recommend to anyone looking for quality service.",
  "Five stars isn't enough. Every detail was perfect from start to finish. We'll definitely be back.",
  "Outstanding service and great value for money. The team went above and beyond our expectations.",
  "Really impressed with the level of care and attention to detail. Everything was handled seamlessly.",
  "Best experience we've had in years. The whole team was friendly, knowledgeable, and efficient.",
];

const NEUTRAL_REVIEWS = [
  "Decent experience overall. Nothing particularly wrong but also nothing that really stood out.",
  "Service was adequate. Got what we needed but the wait time was longer than expected.",
  "Average experience. The staff were polite but seemed understaffed during our visit.",
  "It was okay. Met expectations but didn't exceed them. Pricing seemed fair for the area.",
];

const NEGATIVE_REVIEWS = [
  "Very disappointed with our visit. Staff seemed disinterested and the wait was unreasonable. Expected much better based on the reviews.",
  "Would not recommend. Multiple issues during our experience and management seemed unwilling to address them.",
  "Terrible experience from start to finish. Rude staff, long waits, and the end result was below average.",
  "Extremely frustrating. We were overcharged, had to wait forever, and nobody seemed to care about fixing the issues.",
];

export class GoogleAdapter extends PlatformAdapter {
  get platformName(): string {
    return "GOOGLE";
  }

  async fetchReviews(
    source: MonitoringSource,
    since?: Date
  ): Promise<NormalizedReview[]> {
    // Mock implementation - simulates Google My Business API
    const seed = `${source.externalId}-${Date.now().toString(36)}`;
    const count = Math.floor(this.seededRandom(seed) * 6); // 0-5 reviews

    const reviews: NormalizedReview[] = [];

    for (let i = 0; i < count; i++) {
      const reviewSeed = `${seed}-${i}`;
      const rand = this.seededRandom(reviewSeed);

      // Weight ratings: 60% positive (4-5), 25% neutral (3), 15% negative (1-2)
      let rating: number;
      let content: string;
      if (rand < 0.15) {
        rating = Math.random() < 0.5 ? 1 : 2;
        content = NEGATIVE_REVIEWS[Math.floor(Math.random() * NEGATIVE_REVIEWS.length)];
      } else if (rand < 0.40) {
        rating = 3;
        content = NEUTRAL_REVIEWS[Math.floor(Math.random() * NEUTRAL_REVIEWS.length)];
      } else {
        rating = Math.random() < 0.5 ? 4 : 5;
        content = POSITIVE_REVIEWS[Math.floor(Math.random() * POSITIVE_REVIEWS.length)];
      }

      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const lastInitial = LAST_INITIALS[Math.floor(Math.random() * LAST_INITIALS.length)];
      const authorName = `${firstName} ${lastInitial}.`;

      const publishedAt = new Date(
        Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
      );

      // Skip reviews older than the since date
      if (since && publishedAt < since) continue;

      const externalId = `goog_${source.externalId}_${Date.now()}_${i}`;

      reviews.push({
        externalId,
        authorName,
        authorUrl: `https://www.google.com/maps/contrib/${Math.floor(Math.random() * 1e12)}`,
        rating,
        content,
        language: "en",
        publishedAt,
        url: `https://www.google.com/maps/reviews/${source.externalId}/${externalId}`,
        metadata: {
          platform: "google",
          placeId: source.externalId,
          reviewType: "ORGANIC",
        },
      });
    }

    return reviews;
  }

  validateCredentials(
    credentials: Record<string, unknown>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!credentials.placeId || typeof credentials.placeId !== "string") {
      errors.push("Google Place ID is required");
    }

    // In production, we'd also validate API key
    if (!credentials.apiKey || typeof credentials.apiKey !== "string") {
      errors.push("Google API key is required");
    }

    return { valid: errors.length === 0, errors };
  }
}
