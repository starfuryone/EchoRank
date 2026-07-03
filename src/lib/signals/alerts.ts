import { prisma } from './db';
import { sendAlertDigest } from './notify';
import type { RiskResult } from './types';

// ── Tunables ────────────────────────────────────────────────────────────────
const THRESHOLD_WARNING = 60;  // grade D boundary
const THRESHOLD_CRITICAL = 80; // grade F boundary
const SPIKE_D7 = 15;           // 7-day risk jump that triggers a spike alert
const CRITICAL_SEVERITY = 0.8;
const CRITICAL_LOOKBACK_H = 2; // matches sweep cadence + sync window

export interface CreatedAlert {
  id: string;
  kind: string;
  severity: 'warning' | 'critical';
  title: string;
  body: string | null;
}

function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Score being replaced by the current recompute — today's hourly snapshot if
 * one exists, else the most recent prior day. Call BEFORE computeAndPersist.
 */
export async function previousScore(tenantId: string): Promise<number | null> {
  const snap = await prisma.riskSnapshot.findFirst({
    where: { tenantId },
    orderBy: { day: 'desc' },
    select: { score: true },
  });
  return snap?.score ?? null;
}

async function scoreDaysAgo(tenantId: string, days: number): Promise<number | null> {
  const snap = await prisma.riskSnapshot.findFirst({
    where: { tenantId, day: { lte: new Date(Date.now() - days * 86_400_000) } },
    orderBy: { day: 'desc' },
    select: { score: true },
  });
  return snap?.score ?? null;
}

/** Create unless dedupeKey exists. Returns the event or null on duplicate. */
async function createEvent(e: {
  tenantId: string;
  kind: string;
  severity: 'warning' | 'critical';
  title: string;
  body?: string | null;
  dedupeKey: string;
  payload?: Record<string, unknown>;
}): Promise<CreatedAlert | null> {
  try {
    const row = await prisma.alertEvent.create({
      data: {
        tenantId: e.tenantId,
        kind: e.kind,
        severity: e.severity,
        title: e.title,
        body: e.body ?? null,
        dedupeKey: e.dedupeKey,
        payload: (e.payload ?? undefined) as never,
      },
      select: { id: true, kind: true, severity: true, title: true, body: true },
    });
    return row as CreatedAlert;
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return null; // already fired
    throw err;
  }
}

/**
 * Edge-triggered evaluation, called right after computeAndPersist.
 * `prev` is the pre-recompute score (null on first-ever run).
 */
export async function evaluateAlerts(
  tenantId: string,
  result: RiskResult,
  prev: number | null,
): Promise<void> {
  const created: CreatedAlert[] = [];
  const day = utcDay();
  const cur = result.score;

  // 1) Threshold crossings — fire on the way up only
  if (cur >= THRESHOLD_CRITICAL && (prev === null || prev < THRESHOLD_CRITICAL)) {
    const e = await createEvent({
      tenantId,
      kind: 'risk_threshold',
      severity: 'critical',
      title: `Risk score ${cur} — grade F territory`,
      body: `Reputation risk crossed ${THRESHOLD_CRITICAL} (was ${prev ?? 'n/a'}). Top driver: ${result.drivers[0]?.title ?? 'n/a'}.`,
      dedupeKey: `${tenantId}:threshold${THRESHOLD_CRITICAL}:${day}`,
      payload: { score: cur, prev, grade: result.grade },
    });
    if (e) created.push(e);
  } else if (cur >= THRESHOLD_WARNING && (prev === null || prev < THRESHOLD_WARNING)) {
    const e = await createEvent({
      tenantId,
      kind: 'risk_threshold',
      severity: 'warning',
      title: `Risk score ${cur} — crossed into grade D`,
      body: `Reputation risk crossed ${THRESHOLD_WARNING} (was ${prev ?? 'n/a'}). Top driver: ${result.drivers[0]?.title ?? 'n/a'}.`,
      dedupeKey: `${tenantId}:threshold${THRESHOLD_WARNING}:${day}`,
      payload: { score: cur, prev, grade: result.grade },
    });
    if (e) created.push(e);
  }

  // 2) 7-day spike — once per day
  const d7 = await scoreDaysAgo(tenantId, 7);
  if (d7 !== null && cur - d7 >= SPIKE_D7) {
    const e = await createEvent({
      tenantId,
      kind: 'risk_spike',
      severity: cur - d7 >= SPIKE_D7 * 2 ? 'critical' : 'warning',
      title: `Risk up ${cur - d7} points in 7 days (${d7} → ${cur})`,
      body: `Velocity component: ${Math.round(result.components.velocity * 100)}. Negative pressure: ${Math.round(result.components.negativePressure * 100)}.`,
      dedupeKey: `${tenantId}:spike:${day}`,
      payload: { score: cur, d7Ago: d7, delta: cur - d7 },
    });
    if (e) created.push(e);
  }

  // 3) New critical signals — one alert per signal, dedupe on signal id
  const crits = await prisma.signal.findMany({
    where: {
      tenantId,
      severity: { gte: CRITICAL_SEVERITY },
      sentiment: { lt: 0 },
      ingestedAt: { gte: new Date(Date.now() - CRITICAL_LOOKBACK_H * 3_600_000) },
    },
    select: { id: true, source: true, title: true, url: true, severity: true },
    take: 20,
  });
  for (const s of crits) {
    const e = await createEvent({
      tenantId,
      kind: 'critical_signal',
      severity: 'critical',
      title: `Critical ${s.source}: ${s.title ?? 'new signal'}`,
      body: s.url ?? null,
      dedupeKey: `${tenantId}:crit:${s.id}`,
      payload: { signalId: s.id, severity: s.severity },
    });
    if (e) created.push(e);
  }

  if (created.length) {
    await sendAlertDigest(tenantId, created);
  }
}

/** Retry digests that failed to send, up to 24h back. Called once per sweep. */
export async function flushUnnotified(): Promise<void> {
  const stale = await prisma.alertEvent.findMany({
    where: {
      notifiedAt: null,
      createdAt: { gte: new Date(Date.now() - 24 * 3_600_000) },
    },
    select: { id: true, tenantId: true, kind: true, severity: true, title: true, body: true },
    take: 100,
  });
  if (!stale.length) return;

  const byTenant = new Map<string, CreatedAlert[]>();
  for (const e of stale) {
    const list = byTenant.get(e.tenantId) ?? [];
    list.push(e as CreatedAlert);
    byTenant.set(e.tenantId, list);
  }
  for (const [tenantId, events] of byTenant) {
    await sendAlertDigest(tenantId, events);
  }
}
