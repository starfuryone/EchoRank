import type { MonitoringSource } from "@/generated/prisma";
import { PlatformAdapter, type NormalizedReview } from "./base";

const REDDIT_AUTHORS = [
  "u/helpful_reviewer42", "u/honest_customer", "u/local_guide_2024",
  "u/consumer_advocate", "u/real_feedback_here", "u/throwaway_review99",
  "u/citylife_observer", "u/quality_matters01", "u/neighborhoodwatch",
  "u/fair_assessment", "u/budget_shopper", "u/picky_consumer",
];

const REDDIT_MENTIONS = [
  "Has anyone else had issues with {name}? I went there last week and the experience was pretty bad. Long wait, staff seemed overwhelmed, and the quality wasn't what I expected based on their reputation.",
  "Just wanted to give a shoutout to {name}. Had an amazing experience there today. Everything was perfect and the team was super helpful. Definitely recommend checking them out.",
  "PSA about {name}: they've really stepped up their game recently. Went back after a so-so experience last year and was pleasantly surprised. Major improvements all around.",
  "Looking for alternatives to {name}. Their service has gone downhill over the past few months. Anyone have suggestions for similar businesses in the area?",
  "Honest review of {name} - it's... fine. Nothing special but nothing terrible. If you're in the area and need something quick, it'll do the job.",
  "{name} just lost a long-time customer. After years of good experiences, my last three visits have been disappointing. Quality has dropped significantly while prices keep going up.",
  "I keep seeing mixed reviews about {name} on here. I'll add my two cents - had a great experience last week. Staff was friendly, wait was reasonable, and the result exceeded expectations.",
  "Can we talk about how {name} handles complaints? I had an issue and they resolved it within 24 hours with a full apology and correction. That's how you keep customers.",
  "Warning about {name} - they've been charging hidden fees that aren't mentioned upfront. Read the fine print before committing to anything.",
  "Moved to the area recently and tried {name} on a neighbor's recommendation. Not disappointed at all. Professional, fair pricing, and great communication throughout.",
];

const SUBREDDITS = [
  "r/localreviews", "r/smallbusiness", "r/consumerreviews",
  "r/servicereviews", "r/cityname", "r/recommendations",
];

export class RedditAdapter extends PlatformAdapter {
  get platformName(): string {
    return "REDDIT";
  }

  async fetchReviews(
    source: MonitoringSource,
    since?: Date
  ): Promise<NormalizedReview[]> {
    // Reddit returns mentions rather than structured reviews (no rating)
    const seed = `${source.externalId}-reddit-${Date.now().toString(36)}`;
    const count = Math.floor(this.seededRandom(seed) * 4); // 0-3 mentions

    const reviews: NormalizedReview[] = [];

    for (let i = 0; i < count; i++) {
      const authorName = REDDIT_AUTHORS[Math.floor(Math.random() * REDDIT_AUTHORS.length)];
      const template = REDDIT_MENTIONS[Math.floor(Math.random() * REDDIT_MENTIONS.length)];
      const content = template.replace(/\{name\}/g, source.name);
      const subreddit = SUBREDDITS[Math.floor(Math.random() * SUBREDDITS.length)];

      const publishedAt = new Date(
        Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
      );

      if (since && publishedAt < since) continue;

      const externalId = `reddit_${source.externalId}_${Date.now()}_${i}`;
      const postId = Math.random().toString(36).substring(2, 8);

      reviews.push({
        externalId,
        authorName,
        authorUrl: `https://www.reddit.com/${authorName}`,
        // No rating for Reddit mentions - sentiment is derived from content
        content,
        language: "en",
        publishedAt,
        url: `https://www.reddit.com/${subreddit}/comments/${postId}`,
        metadata: {
          platform: "reddit",
          subreddit,
          postType: "mention",
          upvotes: Math.floor(Math.random() * 150),
          commentCount: Math.floor(Math.random() * 30),
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

    if (!credentials.searchTerms || !Array.isArray(credentials.searchTerms)) {
      errors.push("At least one search term is required for Reddit monitoring");
    }

    // Reddit API requires client ID and secret
    if (!credentials.clientId || typeof credentials.clientId !== "string") {
      errors.push("Reddit API client ID is required");
    }

    if (!credentials.clientSecret || typeof credentials.clientSecret !== "string") {
      errors.push("Reddit API client secret is required");
    }

    return { valid: errors.length === 0, errors };
  }
}
