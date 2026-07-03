import { prisma } from '../lib/signals/db';
import { ingestSignals } from '../lib/signals/ingest';
import { mapFeedback, mapVisibilityAudit } from '../lib/signals/adapters';
import { computeAndPersist } from '../lib/signals/scoring';
import { clamp, RawSignalInput } from '../lib/signals/types';

const SINCE = new Date(Date.now() - 365 * 86_400_000);
const SEV_BY_RATING: Record<number, number> = { 1: 0.9, 2: 0.65, 3: 0.35, 4: 0.15, 5: 0.1 };

async function main() {
  // 1. External reviews — primary signal source
  {
    const rows = await prisma.externalReview.findMany({
      where: { createdAt: { gte: SINCE } },
      select: {
        id: true, tenantId: true, sourceId: true, platform: true, rating: true,
        content: true, authorName: true, url: true, publishedAt: true,
        sentimentScore: true, riskLevel: true, createdAt: true,
      },
    });
    const signals: RawSignalInput[] = rows.map((r) => {
      const rating = r.rating != null ? clamp(r.rating, 1, 5) : null;
      // rating primary; sentimentScore fallback assumes -1..1 scale
      const sentiment = rating != null ? (rating - 3) / 2 : clamp(r.sentimentScore ?? 0, -1, 1);
      let severity = rating != null
        ? SEV_BY_RATING[Math.round(rating)] ?? 0.35
        : sentiment < 0 ? 0.6 : 0.15;
      const risk = String(r.riskLevel);
      if (risk === 'CRITICAL') severity = Math.max(severity, 0.9);
      else if (risk === 'HIGH') severity = Math.max(severity, 0.75);
      const text = r.content ?? '';
      return {
        tenantId: r.tenantId,
        source: 'review',
        externalId: `extreview:${r.id}`,
        entityType: 'source',
        entityId: r.sourceId,
        occurredAt: r.publishedAt ?? r.createdAt,
        sentiment,
        severity,
        magnitude: 0.4 + 0.6 * clamp(text.length / 400),
        title: `${rating != null ? '★'.repeat(Math.round(rating)) + ' ' : ''}${String(r.platform).toLowerCase()}${r.authorName ? ` — ${r.authorName}` : ''}`,
        body: text || null,
        url: r.url,
        metadata: { rating, platform: String(r.platform), riskLevel: risk },
      };
    });
    const n = await ingestSignals(signals, { recompute: false });
    console.log(`external reviews -> ${n} signals`);
  }

  // 2. Private feedback — submitted, not soft-deleted
  {
    const rows = await prisma.feedback.findMany({
      where: { status: 'SUBMITTED', deletedAt: null, createdAt: { gte: SINCE } },
      select: { id: true, tenantId: true, rating: true, comment: true, submittedAt: true, createdAt: true },
    });
    const n = await ingestSignals(
      rows.map((f) => mapFeedback({
        id: f.id, tenantId: f.tenantId, rating: f.rating,
        message: f.comment, createdAt: f.submittedAt ?? f.createdAt,
      })),
      { recompute: false },
    );
    console.log(`feedback -> ${n} signals`);
  }

  // 3. AI visibility audits
  {
    const rows = await prisma.visibilityAudit.findMany({
      where: { createdAt: { gte: SINCE } },
      select: { id: true, tenantId: true, score: true, grade: true, url: true, createdAt: true },
    });
    const n = await ingestSignals(
      rows.map((a) => mapVisibilityAudit({
        id: a.id, tenantId: a.tenantId, score: a.score,
        gradeLabel: a.grade, domain: a.url, createdAt: a.createdAt,
      })),
      { recompute: false },
    );
    console.log(`visibility audits -> ${n} signals`);
  }

  // 4. Snapshot every tenant with signals
  const tenants = await prisma.signal.findMany({ distinct: ['tenantId'], select: { tenantId: true } });
  for (const { tenantId } of tenants) {
    const r = await computeAndPersist(tenantId);
    console.log(`${tenantId} -> risk ${r.score} (${r.grade}) - ${r.signalCount} signals`);
  }
  console.log('backfill done');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
