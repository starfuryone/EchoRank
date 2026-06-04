import { prisma } from "@/lib/prisma";
import { eventBus } from "@/infrastructure/events/bus";
import { EVENT_TYPES } from "@/infrastructure/events/types";
import { addJob } from "@/infrastructure/queue/registry";
import { JOB_PRIORITY } from "@/infrastructure/queue/jobs/schemas";
import { DeduplicationService } from "@/monitoring/deduplication";
import type { ExternalReviewInput } from "@/monitoring/normalizer";

/**
 * Persist a batch of normalized reviews and dispatch each new one into the
 * real downstream pipeline — exactly mirroring what review-monitoring.worker.ts
 * does per review:
 *
 *   1. batch-dedupe on deduplicationKey
 *   2. createMany (skipDuplicates as a second safety net on the unique index)
 *   3. for every NEW review with content: enqueue ai-processing/analyze-review
 *   4. emit review.published so the reputation + escalation consumers fire
 *
 * This is deliberately the *single* place ingestion sources hand reviews to the
 * engine, so CSV / Excel / Sheets / Airtable / inbound-email all get identical
 * AI analysis, reputation recalculation and escalation detection rather than a
 * parallel processing path. (review-monitoring.worker can be refactored onto
 * this helper later; it is intentionally left untouched for now.)
 */

export interface PersistResult {
  inserted: number;
  duplicates: number;
}

const dedup = new DeduplicationService();

export async function persistAndDispatchReviews(
  tenantId: string,
  reviews: ExternalReviewInput[],
  correlationId: string,
): Promise<PersistResult> {
  if (reviews.length === 0) {
    return { inserted: 0, duplicates: 0 };
  }

  // ── 1. Batch dedup ──────────────────────────────────────────────────────
  const keys = reviews.map((r) => r.deduplicationKey);
  const existing = await dedup.findExistingKeys(keys);

  // De-dupe within the batch itself too (a CSV can contain repeated rows).
  const seen = new Set<string>();
  const newReviews = reviews.filter((r) => {
    if (existing.has(r.deduplicationKey)) return false;
    if (seen.has(r.deduplicationKey)) return false;
    seen.add(r.deduplicationKey);
    return true;
  });

  const duplicates = reviews.length - newReviews.length;

  if (newReviews.length === 0) {
    return { inserted: 0, duplicates };
  }

  // ── 2. Bulk insert ──────────────────────────────────────────────────────
  await prisma.externalReview.createMany({
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

  // Re-read the rows we just created to get their generated ids (createMany
  // does not return rows). We match on the unique deduplicationKey.
  const stored = await prisma.externalReview.findMany({
    where: { deduplicationKey: { in: newReviews.map((r) => r.deduplicationKey) } },
    select: { id: true, deduplicationKey: true, platform: true, rating: true, content: true },
  });

  // ── 3 + 4. Dispatch AI + emit event per new review ──────────────────────
  for (const review of stored) {
    if (review.content && review.content.trim().length > 0) {
      await addJob(
        "ai-processing",
        "analyze-review",
        {
          tenantId,
          externalReviewId: review.id,
          analysisType: "full_analysis" as const,
          content: review.content,
          rating: review.rating ?? undefined,
          correlationId,
        },
        { priority: JOB_PRIORITY.NORMAL },
      );
    }

    const rating = review.rating ?? null;
    const sentiment =
      rating != null ? (rating >= 4 ? "positive" : rating <= 2 ? "negative" : "neutral") : "unknown";

    await eventBus.emit({
      tenantId,
      eventType: EVENT_TYPES.REVIEW_PUBLISHED,
      eventVersion: 1,
      aggregateType: "ExternalReview",
      aggregateId: review.id,
      payload: {
        tenantId,
        correlationId,
        timestamp: new Date().toISOString(),
        version: 1,
        externalReviewId: review.id,
        platform: review.platform,
        rating,
        sentiment,
      },
      correlationId,
    });
  }

  return { inserted: stored.length, duplicates };
}
