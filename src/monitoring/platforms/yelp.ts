import type { MonitoringSource } from "@/generated/prisma";
import { PlatformAdapter, type NormalizedReview } from "./base";

const YELP_AUTHORS = [
  "Mike R.", "Jenny L.", "Bob K.", "Samantha P.", "Dave T.",
  "Christine M.", "Greg H.", "Laura S.", "Kevin W.", "Rachel D.",
  "Steve B.", "Diana F.", "Marcus J.", "Olivia N.", "Tony C.",
];

const YELP_POSITIVE = [
  "Hidden gem! We stumbled upon this place and were blown away. The quality is phenomenal and the prices are very reasonable. We'll be regulars from now on.",
  "Can't say enough good things. The attention to detail is remarkable and the staff clearly takes pride in what they do.",
  "This place deserves every star. Consistent quality every single time we visit. Friends and family all love it too.",
  "After trying many places in the area, this is hands down the best. Worth every penny.",
];

const YELP_NEUTRAL = [
  "It's alright. Not the best I've experienced but certainly not the worst. Location is convenient which is a plus.",
  "Mixed feelings. Some aspects were great but others fell short. The potential is definitely there.",
  "Decent for the price point. Nothing to write home about but gets the job done.",
];

const YELP_NEGATIVE = [
  "Really let down by this place. The online photos look nothing like reality. Staff were dismissive when I raised concerns.",
  "Completely overrated. Long wait times, mediocre quality, and the manager couldn't care less about customer satisfaction.",
  "One star is generous. Would give zero if I could. Complete waste of time and money.",
];

export class YelpAdapter extends PlatformAdapter {
  get platformName(): string {
    return "YELP";
  }

  async fetchReviews(
    source: MonitoringSource,
    since?: Date
  ): Promise<NormalizedReview[]> {
    const seed = `${source.externalId}-yelp-${Date.now().toString(36)}`;
    const count = Math.floor(this.seededRandom(seed) * 4); // 0-3 reviews

    const reviews: NormalizedReview[] = [];

    for (let i = 0; i < count; i++) {
      const reviewSeed = `${seed}-${i}`;
      const rand = this.seededRandom(reviewSeed);

      let rating: number;
      let content: string;
      if (rand < 0.2) {
        rating = Math.random() < 0.5 ? 1 : 2;
        content = YELP_NEGATIVE[Math.floor(Math.random() * YELP_NEGATIVE.length)];
      } else if (rand < 0.45) {
        rating = 3;
        content = YELP_NEUTRAL[Math.floor(Math.random() * YELP_NEUTRAL.length)];
      } else {
        rating = Math.random() < 0.5 ? 4 : 5;
        content = YELP_POSITIVE[Math.floor(Math.random() * YELP_POSITIVE.length)];
      }

      const authorName = YELP_AUTHORS[Math.floor(Math.random() * YELP_AUTHORS.length)];
      const publishedAt = new Date(
        Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
      );

      if (since && publishedAt < since) continue;

      const externalId = `yelp_${source.externalId}_${Date.now()}_${i}`;

      reviews.push({
        externalId,
        authorName,
        authorUrl: `https://www.yelp.com/user_details?userid=${externalId}`,
        rating,
        content,
        language: "en",
        publishedAt,
        url: `https://www.yelp.com/biz/${source.externalId}?hrid=${externalId}`,
        metadata: {
          platform: "yelp",
          businessId: source.externalId,
          useful: Math.floor(Math.random() * 10),
          funny: Math.floor(Math.random() * 5),
          cool: Math.floor(Math.random() * 5),
        },
      });
    }

    return reviews;
  }

  validateCredentials(
    credentials: Record<string, unknown>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!credentials.businessId || typeof credentials.businessId !== "string") {
      errors.push("Yelp Business ID is required");
    }

    if (!credentials.apiKey || typeof credentials.apiKey !== "string") {
      errors.push("Yelp Fusion API key is required");
    }

    return { valid: errors.length === 0, errors };
  }
}
