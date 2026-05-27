import type { MonitoringSource } from "@/generated/prisma";
import { PlatformAdapter, type NormalizedReview } from "./base";

const TWITTER_AUTHORS = [
  "@satisfied_customer", "@local_reviewer", "@honest_opinion1",
  "@consumer_rights_now", "@quality_check_", "@service_watch",
  "@real_talk_reviews", "@no_filter_review", "@trusted_voice",
  "@community_feedback", "@brand_check", "@customer_first_",
];

const TWITTER_MENTIONS = [
  "Just had the worst experience at {name}. Waited 45 minutes, staff were rude, and the quality was terrible. Never going back. #badservice #disappointed",
  "Shoutout to {name} for absolutely amazing service today! The team went above and beyond. This is how you do it! #greatservice #recommended",
  "Can someone tell me if {name} is actually good? The reviews online are all over the place and I can't decide if it's worth trying.",
  "Update on my {name} complaint: they reached out, apologized, and made it right. Respect for businesses that own their mistakes. #goodcustomerservice",
  "Tried {name} for the first time today. Honestly? Pretty mid. Not bad enough to complain but not good enough to go back. 3/5",
  "WARNING: {name} has been caught charging for services not rendered. Several people in our neighborhood have reported the same issue. Beware! #scam #consumeralert",
  "My family has been going to {name} for years and they never disappoint. Consistency is key and they've got it. #loyalcustomer",
  "Anyone know what happened to {name}? Quality has dropped significantly in the last few months. Used to be my go-to but now I'm looking elsewhere.",
  "Pleasantly surprised by {name} today. Read some negative reviews and was skeptical, but my experience was nothing but positive. Don't always believe what you read online!",
];

export class TwitterAdapter extends PlatformAdapter {
  get platformName(): string {
    return "TWITTER";
  }

  async fetchReviews(
    source: MonitoringSource,
    since?: Date
  ): Promise<NormalizedReview[]> {
    // Twitter returns mentions - no structured rating
    const seed = `${source.externalId}-twitter-${Date.now().toString(36)}`;
    const count = Math.floor(this.seededRandom(seed) * 5); // 0-4 mentions

    const reviews: NormalizedReview[] = [];

    for (let i = 0; i < count; i++) {
      const authorHandle = TWITTER_AUTHORS[Math.floor(Math.random() * TWITTER_AUTHORS.length)];
      const template = TWITTER_MENTIONS[Math.floor(Math.random() * TWITTER_MENTIONS.length)];
      const content = template.replace(/\{name\}/g, source.name);

      const publishedAt = new Date(
        Date.now() - Math.floor(Math.random() * 3 * 24 * 60 * 60 * 1000) // More recent for Twitter
      );

      if (since && publishedAt < since) continue;

      const externalId = `tw_${source.externalId}_${Date.now()}_${i}`;
      const tweetId = Math.floor(Math.random() * 1e18).toString();

      reviews.push({
        externalId,
        authorName: authorHandle,
        authorUrl: `https://x.com/${authorHandle.replace("@", "")}`,
        // No structured rating for tweets
        content,
        language: "en",
        publishedAt,
        url: `https://x.com/${authorHandle.replace("@", "")}/status/${tweetId}`,
        metadata: {
          platform: "twitter",
          tweetId,
          postType: "mention",
          likes: Math.floor(Math.random() * 200),
          retweets: Math.floor(Math.random() * 50),
          replies: Math.floor(Math.random() * 20),
          impressions: Math.floor(Math.random() * 5000),
          searchTerm: source.name,
        },
      });
    }

    return reviews;
  }

  validateCredentials(
    credentials: Record<string, unknown>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!credentials.bearerToken || typeof credentials.bearerToken !== "string") {
      errors.push("X/Twitter API bearer token is required");
    }

    if (!credentials.searchTerms || !Array.isArray(credentials.searchTerms)) {
      errors.push("At least one search term is required for X/Twitter monitoring");
    }

    return { valid: errors.length === 0, errors };
  }
}
