import { prisma } from "@/lib/prisma";

export class DeduplicationService {
  /**
   * Check if a review with the given deduplication key already exists.
   */
  async isDuplicate(deduplicationKey: string): Promise<boolean> {
    const existing = await prisma.externalReview.findUnique({
      where: { deduplicationKey },
      select: { id: true },
    });
    return existing !== null;
  }

  /**
   * Check multiple deduplication keys at once and return the set of keys
   * that already exist in the database.
   */
  async findExistingKeys(keys: string[]): Promise<Set<string>> {
    if (keys.length === 0) return new Set();

    const existing = await prisma.externalReview.findMany({
      where: { deduplicationKey: { in: keys } },
      select: { deduplicationKey: true },
    });

    return new Set(existing.map((r) => r.deduplicationKey));
  }

  /**
   * Mark a review as processed after AI enrichment completes.
   */
  async markProcessed(reviewId: string): Promise<void> {
    await prisma.externalReview.update({
      where: { id: reviewId },
      data: { isProcessed: true },
    });
  }

  /**
   * Get unprocessed reviews for a tenant, ordered by oldest first.
   */
  async getUnprocessed(
    tenantId: string,
    limit: number = 50
  ): Promise<
    Array<{
      id: string;
      platform: string;
      content: string | null;
      rating: number | null;
      authorName: string | null;
      publishedAt: Date | null;
      sourceId: string;
    }>
  > {
    return prisma.externalReview.findMany({
      where: {
        tenantId,
        isProcessed: false,
      },
      select: {
        id: true,
        platform: true,
        content: true,
        rating: true,
        authorName: true,
        publishedAt: true,
        sourceId: true,
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }
}
