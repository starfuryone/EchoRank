import { prisma } from './db';
import { ingestSignals } from './ingest';
import { mapExternalReview, mapFeedback, mapVisibilityAudit } from './adapters';

/** Fold rows touched in the last N hours into the spine. Idempotent. */
export async function syncRecentSignals(hours = 2): Promise<number> {
  const since = new Date(Date.now() - hours * 3_600_000);
  let total = 0;

  const reviews = await prisma.externalReview.findMany({
    where: { updatedAt: { gte: since } },
    select: {
      id: true, tenantId: true, sourceId: true, platform: true, rating: true,
      content: true, authorName: true, url: true, publishedAt: true,
      sentimentScore: true, riskLevel: true, createdAt: true,
    },
  });
  total += await ingestSignals(reviews.map(mapExternalReview), { recompute: false });

  const feedback = await prisma.feedback.findMany({
    where: { status: 'SUBMITTED', deletedAt: null, updatedAt: { gte: since } },
    select: { id: true, tenantId: true, rating: true, comment: true, submittedAt: true, createdAt: true },
  });
  total += await ingestSignals(
    feedback.map((f) => mapFeedback({
      id: f.id, tenantId: f.tenantId, rating: f.rating,
      message: f.comment, createdAt: f.submittedAt ?? f.createdAt,
    })),
    { recompute: false },
  );

  const audits = await prisma.visibilityAudit.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, tenantId: true, score: true, grade: true, url: true, createdAt: true },
  });
  total += await ingestSignals(
    audits.map((a) => mapVisibilityAudit({
      id: a.id, tenantId: a.tenantId, score: a.score,
      gradeLabel: a.grade, domain: a.url, createdAt: a.createdAt,
    })),
    { recompute: false },
  );

  return total;
}
