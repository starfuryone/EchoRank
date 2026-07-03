import { clamp, RawSignalInput } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// THE ONLY FILE THAT NEEDS MAPPING TO YOUR SCHEMA.
// Each mapper takes a row shaped like your Prisma model. Adjust the *Like
// interfaces to your actual field names, keep the math.
// ═══════════════════════════════════════════════════════════════════════════

// ── Reviews ─────────────────────────────────────────────────────────────────
export interface ReviewLike {
  id: string;
  tenantId: string;          // ← your tenant FK
  rating: number;            // 1..5
  content?: string | null;   // ← review text field
  authorName?: string | null;
  platform?: string | null;  // google | yelp | …
  url?: string | null;
  locationId?: string | null;
  createdAt: Date;           // ← or publishedAt if you store it
}

export function mapReview(r: ReviewLike): RawSignalInput {
  const rating = clamp(r.rating, 1, 5);
  const text = r.content ?? '';
  const severityByRating: Record<number, number> = { 1: 0.9, 2: 0.65, 3: 0.35, 4: 0.15, 5: 0.1 };
  return {
    tenantId: r.tenantId,
    source: 'review',
    externalId: `review:${r.id}`,
    entityType: r.locationId ? 'location' : null,
    entityId: r.locationId ?? null,
    occurredAt: r.createdAt,
    sentiment: (rating - 3) / 2,                       // 1★ → -1, 3★ → 0, 5★ → 1
    severity: severityByRating[Math.round(rating)] ?? 0.35,
    magnitude: 0.4 + 0.6 * clamp(text.length / 400),   // longer reviews carry more weight
    title: `${'★'.repeat(Math.round(rating))} ${r.platform ?? 'review'}${r.authorName ? ` — ${r.authorName}` : ''}`,
    body: text || null,
    url: r.url ?? null,
    metadata: { rating, platform: r.platform ?? null },
  };
}

// ── Private feedback ────────────────────────────────────────────────────────
export interface FeedbackLike {
  id: string;
  tenantId: string;
  rating?: number | null;    // 1..5 if you collect one; else derive below
  message?: string | null;
  createdAt: Date;
}

export function mapFeedback(f: FeedbackLike): RawSignalInput {
  const rating = f.rating != null ? clamp(f.rating, 1, 5) : 2; // no rating on private feedback usually = complaint
  return {
    tenantId: f.tenantId,
    source: 'feedback',
    externalId: `feedback:${f.id}`,
    occurredAt: f.createdAt,
    sentiment: (rating - 3) / 2,
    severity: rating <= 2 ? 0.7 : rating === 3 ? 0.35 : 0.1,
    magnitude: 0.4 + 0.6 * clamp((f.message ?? '').length / 400),
    title: `Private feedback${f.rating != null ? ` (${rating}/5)` : ''}`,
    body: f.message ?? null,
    metadata: { rating: f.rating ?? null },
  };
}

// ── AI visibility audits (sidecar on :4500) ────────────────────────────────
export interface VisibilityAuditLike {
  id: string;
  tenantId: string;
  score: number;             // 0..100
  gradeLabel?: string | null;
  domain?: string | null;
  createdAt: Date;
}

export function mapVisibilityAudit(a: VisibilityAuditLike): RawSignalInput {
  const score = clamp(a.score, 0, 100);
  return {
    tenantId: a.tenantId,
    source: 'visibility',
    externalId: `visibility:${a.id}`,
    occurredAt: a.createdAt,
    sentiment: (score - 50) / 50,
    severity: score >= 70 ? 0.1 : clamp((70 - score) / 70, 0.1, 1),
    magnitude: 0.8,
    title: `AI visibility audit — ${score}/100${a.gradeLabel ? ` (${a.gradeLabel})` : ''}${a.domain ? ` · ${a.domain}` : ''}`,
    metadata: { score, domain: a.domain ?? null },
  };
}

// ── External reviews (monitoring pipeline) ─────────────────────────────────
export interface ExternalReviewLike {
  id: string; tenantId: string; sourceId: string; platform: unknown;
  rating: number | null; content: string | null; authorName: string | null;
  url: string | null; publishedAt: Date | null; sentimentScore: number | null;
  riskLevel: unknown; createdAt: Date;
}

const SEV_BY_RATING: Record<number, number> = { 1: 0.9, 2: 0.65, 3: 0.35, 4: 0.15, 5: 0.1 };

export function mapExternalReview(r: ExternalReviewLike): RawSignalInput {
  const rating = r.rating != null ? clamp(r.rating, 1, 5) : null;
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
    sentiment, severity,
    magnitude: 0.4 + 0.6 * clamp(text.length / 400),
    title: `${rating != null ? '★'.repeat(Math.round(rating)) + ' ' : ''}${String(r.platform).toLowerCase()}${r.authorName ? ` — ${r.authorName}` : ''}`,
    body: text || null,
    url: r.url,
    metadata: { rating, platform: String(r.platform), riskLevel: risk },
  };
}
