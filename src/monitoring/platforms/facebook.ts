import type { MonitoringSource } from "@/generated/prisma";
import { PlatformAdapter, type NormalizedReview } from "./base";

const FB_AUTHORS = [
  "Sarah Johnson", "Mark Williams", "Linda Davis", "Tom Anderson",
  "Patricia Brown", "Chris Wilson", "Nancy Taylor", "Brian Martinez",
  "Karen Thomas", "Scott Jackson", "Michelle White", "Paul Harris",
  "Amy Clark", "Jeff Lewis", "Susan Robinson", "Eric Walker",
];

const FB_POSITIVE = [
  "Absolutely love this place! The staff is always so welcoming and professional. Highly recommended to all my friends and family!",
  "Had an incredible experience today. Everything exceeded my expectations. These guys really know what they're doing.",
  "Five stars all the way! Been a customer for over a year now and they have never let me down. Consistency at its finest.",
  "So glad I found this business. Customer service is outstanding and the quality is top notch. Worth every penny!",
];

const FB_NEUTRAL = [
  "Pretty good overall. A few minor things that could be improved but nothing major. Would consider coming back.",
  "Reasonable service at a fair price. Nothing extraordinary but gets the job done. Staff was polite enough.",
  "Average experience. It was fine for what it is. Not my first choice but not the worst option either.",
];

const FB_NEGATIVE = [
  "Very unhappy with my experience. The quality was nowhere near what was advertised. Will not be returning and cannot recommend to others.",
  "Disappointing to say the least. Poor communication, long wait times, and the end result was subpar. Save your money.",
  "Had high hopes based on the Facebook page but reality was a letdown. Tried to resolve with management but they were dismissive.",
];

export class FacebookAdapter extends PlatformAdapter {
  get platformName(): string {
    return "FACEBOOK";
  }

  async fetchReviews(
    source: MonitoringSource,
    since?: Date
  ): Promise<NormalizedReview[]> {
    const seed = `${source.externalId}-fb-${Date.now().toString(36)}`;
    const count = Math.floor(this.seededRandom(seed) * 4); // 0-3 reviews

    const reviews: NormalizedReview[] = [];

    for (let i = 0; i < count; i++) {
      const reviewSeed = `${seed}-${i}`;
      const rand = this.seededRandom(reviewSeed);

      // Facebook uses "recommend" / "don't recommend" but also has star ratings on some pages
      let rating: number;
      let content: string;
      if (rand < 0.15) {
        rating = Math.random() < 0.5 ? 1 : 2;
        content = FB_NEGATIVE[Math.floor(Math.random() * FB_NEGATIVE.length)];
      } else if (rand < 0.35) {
        rating = 3;
        content = FB_NEUTRAL[Math.floor(Math.random() * FB_NEUTRAL.length)];
      } else {
        rating = Math.random() < 0.4 ? 4 : 5;
        content = FB_POSITIVE[Math.floor(Math.random() * FB_POSITIVE.length)];
      }

      const authorName = FB_AUTHORS[Math.floor(Math.random() * FB_AUTHORS.length)];
      const publishedAt = new Date(
        Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
      );

      if (since && publishedAt < since) continue;

      const externalId = `fb_${source.externalId}_${Date.now()}_${i}`;
      const fbUserId = Math.floor(Math.random() * 1e15).toString();

      reviews.push({
        externalId,
        authorName,
        authorUrl: `https://www.facebook.com/profile.php?id=${fbUserId}`,
        rating,
        content,
        language: "en",
        publishedAt,
        url: `https://www.facebook.com/${source.externalId}/reviews/${externalId}`,
        metadata: {
          platform: "facebook",
          pageId: source.externalId,
          recommended: rating >= 4,
          reactions: {
            like: Math.floor(Math.random() * 20),
            love: Math.floor(Math.random() * 5),
            haha: 0,
          },
        },
      });
    }

    return reviews;
  }

  validateCredentials(
    credentials: Record<string, unknown>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!credentials.pageId || typeof credentials.pageId !== "string") {
      errors.push("Facebook Page ID is required");
    }

    if (!credentials.accessToken || typeof credentials.accessToken !== "string") {
      errors.push("Facebook Graph API access token is required");
    }

    return { valid: errors.length === 0, errors };
  }
}
