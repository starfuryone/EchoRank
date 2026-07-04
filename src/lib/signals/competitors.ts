import { prisma } from './db';
import { ingestSignal } from './ingest';
import { createEvent, CreatedAlert } from './alerts';
import { sendAlertDigest } from './notify';
import { clamp } from './types';

// ── Tunables ────────────────────────────────────────────────────────────────
const MOMENTUM_MIN_REVIEWS_7D = 5;   // competitor must gain at least this many
const MOMENTUM_RATIO = 2;            // …and at least 2× your own 7d review pace
const MAX_COMPETITORS_PER_TENANT = 20;

const PLACES_BASE = 'https://places.googleapis.com/v1';

// ── Google Places v1 provider ───────────────────────────────────────────────

export interface PlaceCandidate {
  placeId: string;
  name: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
}

function placesKey(): string | null {
  return process.env.GOOGLE_PLACES_API_KEY || null;
}

export function placesConfigured(): boolean {
  return !!placesKey();
}

async function fetchPlace(placeId: string): Promise<{ name?: string; rating?: number; reviewCount?: number } | null> {
  const key = placesKey();
  if (!key) return null;
  try {
    const res = await fetch(`${PLACES_BASE}/places/${encodeURIComponent(placeId)}`, {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount',
      },
    });
    if (!res.ok) {
      console.error(`[competitors] places ${res.status} for ${placeId}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const j = (await res.json()) as {
      displayName?: { text?: string };
      rating?: number;
      userRatingCount?: number;
    };
    return { name: j.displayName?.text, rating: j.rating, reviewCount: j.userRatingCount };
  } catch (err) {
    console.error('[competitors] places fetch failed:', (err as Error).message);
    return null;
  }
}

export async function searchPlaces(query: string): Promise<PlaceCandidate[]> {
  const key = placesKey();
  if (!key) return [];
  try {
    const res = await fetch(`${PLACES_BASE}/places:searchText`, {
      method: 'POST',
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ textQuery: query }),
    });
    if (!res.ok) {
      console.error(`[competitors] places search ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return [];
    }
    const j = (await res.json()) as {
      places?: {
        id: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        rating?: number;
        userRatingCount?: number;
      }[];
    };
    return (j.places ?? []).slice(0, 5).map((p) => ({
      placeId: p.id,
      name: p.displayName?.text ?? p.id,
      address: p.formattedAddress,
      rating: p.rating,
      reviewCount: p.userRatingCount,
    }));
  } catch (err) {
    console.error('[competitors] places search failed:', (err as Error).message);
    return [];
  }
}

// ── Snapshots + deltas ──────────────────────────────────────────────────────

function utcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function upsertSnapshot(
  competitorId: string,
  data: { rating?: number | null; reviewCount?: number | null; raw?: unknown },
  day: Date = utcDay(),
) {
  return prisma.competitorSnapshot.upsert({
    where: { competitorId_day: { competitorId, day } },
    create: {
      competitorId,
      day,
      rating: data.rating ?? null,
      reviewCount: data.reviewCount ?? null,
      raw: (data.raw ?? undefined) as never,
    },
    update: {
      rating: data.rating ?? null,
      reviewCount: data.reviewCount ?? null,
      raw: (data.raw ?? undefined) as never,
    },
  });
}

export interface CompetitorDeltas {
  rating: number | null;
  reviewCount: number | null;
  dRating30: number | null;
  dReviews7: number | null;
  dReviews30: number | null;
  lastSnapshotDay: string | null;
}

async function snapshotAtOrBefore(competitorId: string, daysAgo: number) {
  return prisma.competitorSnapshot.findFirst({
    where: { competitorId, day: { lte: new Date(Date.now() - daysAgo * 86_400_000) } },
    orderBy: { day: 'desc' },
    select: { rating: true, reviewCount: true },
  });
}

export async function competitorDeltas(competitorId: string): Promise<CompetitorDeltas> {
  const latest = await prisma.competitorSnapshot.findFirst({
    where: { competitorId },
    orderBy: { day: 'desc' },
    select: { rating: true, reviewCount: true, day: true },
  });
  if (!latest) {
    return { rating: null, reviewCount: null, dRating30: null, dReviews7: null, dReviews30: null, lastSnapshotDay: null };
  }
  const [s7, s30] = await Promise.all([
    snapshotAtOrBefore(competitorId, 7),
    snapshotAtOrBefore(competitorId, 30),
  ]);
  const dNum = (a: number | null, b: number | null) => (a !== null && b !== null ? a - b : null);
  return {
    rating: latest.rating,
    reviewCount: latest.reviewCount,
    dRating30: dNum(latest.rating, s30?.rating ?? null),
    dReviews7: dNum(latest.reviewCount, s7?.reviewCount ?? null),
    dReviews30: dNum(latest.reviewCount, s30?.reviewCount ?? null),
    lastSnapshotDay: latest.day.toISOString().slice(0, 10),
  };
}

/** Tenant's own review pace: spine review signals in the last 7 days. */
export async function ownReviewPace7d(tenantId: string): Promise<number> {
  return prisma.signal.count({
    where: {
      tenantId,
      source: 'review',
      occurredAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
    },
  });
}

// ── Daily sweep ─────────────────────────────────────────────────────────────

function isoWeek(d = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/**
 * Snapshot every active competitor (Places when placeId + key exist; manual
 * snapshots are used as-is), emit spine signals for movement, fire momentum
 * alerts, send digests. Returns tenants processed.
 */
export async function runCompetitorSweep(onlyTenantId?: string): Promise<number> {
  const where = { active: true, ...(onlyTenantId ? { tenantId: onlyTenantId } : {}) };
  const comps = await prisma.competitor.findMany({
    where,
    select: { id: true, tenantId: true, name: true, placeId: true },
  });
  if (!comps.length) return 0;

  const byTenant = new Map<string, typeof comps>();
  for (const c of comps) {
    const list = byTenant.get(c.tenantId) ?? [];
    list.push(c);
    byTenant.set(c.tenantId, list);
  }

  const day = utcDay();
  const dayStr = day.toISOString().slice(0, 10);
  const week = isoWeek();

  for (const [tenantId, list] of byTenant) {
    const own7 = await ownReviewPace7d(tenantId);
    const created: CreatedAlert[] = [];

    for (const comp of list) {
      // 1) automated snapshot when possible
      if (comp.placeId && placesConfigured()) {
        const p = await fetchPlace(comp.placeId);
        if (p) await upsertSnapshot(comp.id, { rating: p.rating ?? null, reviewCount: p.reviewCount ?? null, raw: p }, day);
      }

      // 2) deltas from whatever snapshots exist (automated or manual)
      const d = await competitorDeltas(comp.id);
      if (d.lastSnapshotDay === null) continue;

      const gained = d.dReviews7 ?? 0;
      const ratingMove = d.dRating30 ?? 0;

      // 3) spine signal on movement — informational; source weight 0 keeps it
      //    out of the tenant's own risk score by design
      if (gained > 0 || Math.abs(ratingMove) >= 0.1) {
        const threatRatio = gained / Math.max(MOMENTUM_MIN_REVIEWS_7D, MOMENTUM_RATIO * Math.max(own7, 1));
        await ingestSignal({
          tenantId,
          source: 'competitor',
          externalId: `comp:${comp.id}:${dayStr}`,
          entityType: 'competitor',
          entityId: comp.id,
          occurredAt: new Date(),
          sentiment: -clamp(threatRatio),
          severity: clamp(0.2 + gained / 30, 0.2, 0.8),
          magnitude: 0.5,
          title: `${comp.name}: ${gained > 0 ? `+${gained} reviews (7d)` : ''}${gained > 0 && ratingMove !== 0 ? ', ' : ''}${ratingMove !== 0 ? `rating ${ratingMove > 0 ? '+' : ''}${ratingMove.toFixed(1)} (30d)` : ''}`,
          metadata: { rating: d.rating, reviewCount: d.reviewCount, dReviews7: d.dReviews7, dRating30: d.dRating30 },
        });
      }

      // 4) momentum alert — competitor clearly outpacing you
      if (gained >= MOMENTUM_MIN_REVIEWS_7D && gained >= MOMENTUM_RATIO * Math.max(own7, 1)) {
        const e = await createEvent({
          tenantId,
          kind: 'competitor_momentum',
          severity: 'warning',
          title: `Competitor momentum — ${comp.name}: +${gained} reviews in 7 days (you: ${own7})`,
          body: d.rating !== null ? `Their rating: ${d.rating.toFixed(1)}${d.dRating30 ? ` (${d.dRating30 > 0 ? '+' : ''}${d.dRating30.toFixed(1)} over 30d)` : ''}.` : null,
          dedupeKey: `${tenantId}:compmom:${comp.id}:${week}`,
          payload: { competitorId: comp.id, dReviews7: gained, own7 },
        });
        if (e) created.push(e);
      }
    }

    if (created.length) await sendAlertDigest(tenantId, created);
  }

  console.log(`[competitors] sweep done — ${byTenant.size} tenant(s), ${comps.length} competitor(s)`);
  return byTenant.size;
}

export const COMPETITOR_LIMITS = { maxPerTenant: MAX_COMPETITORS_PER_TENANT };
