import { prisma } from './db';
import {
  clamp,
  RiskComponents,
  RiskDriver,
  RiskGrade,
  RiskResult,
  SignalSource,
} from './types';

// ── Tunables ────────────────────────────────────────────────────────────────
const WINDOW_DAYS = 90;          // scoring lookback
const HALF_LIFE_DAYS = 14;       // a negative signal loses half its weight every 14d
const CRITICAL_SEVERITY = 0.8;
const CRITICAL_WINDOW_DAYS = 30;
const NEG_THRESHOLD = 0.15;      // negativity above this counts toward velocity

/** How much each source moves the needle on the tenant's own risk. */
const SOURCE_WEIGHT: Record<SignalSource, number> = {
  news: 1.2,
  review: 1.0,
  social: 0.9,
  visibility: 0.8,
  feedback: 0.7,
  support: 0.6,
  manual: 0.5,
  competitor: 0.0, // competitor signals inform their dashboards, not your risk
};

const COMPONENT_WEIGHTS = {
  negativePressure: 0.40,
  velocity: 0.25,
  criticalRecent: 0.15,
  visibility: 0.15,
  stagnation: 0.05,
} as const;

// ── Engine ──────────────────────────────────────────────────────────────────

type Row = {
  id: string;
  source: string;
  occurredAt: Date;
  sentiment: number;
  severity: number;
  magnitude: number;
  title: string | null;
  metadata: unknown;
};

function negativity(r: Row): number {
  return Math.max(0, -r.sentiment) * r.severity; // 0..1
}

function decay(ageDays: number): number {
  return Math.pow(0.5, Math.max(0, ageDays) / HALF_LIFE_DAYS);
}

function grade(score: number): RiskGrade {
  if (score < 20) return 'A';
  if (score < 40) return 'B';
  if (score < 60) return 'C';
  if (score < 80) return 'D';
  return 'F';
}

export async function computeRisk(tenantId: string, now = new Date()): Promise<RiskResult> {
  const from = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);

  const rows: Row[] = await prisma.signal.findMany({
    where: { tenantId, occurredAt: { gte: from, lte: now } },
    select: {
      id: true, source: true, occurredAt: true, sentiment: true,
      severity: true, magnitude: true, title: true, metadata: true,
    },
    orderBy: { occurredAt: 'desc' },
    take: 5000,
  });

  const scored = rows.filter((r) => (SOURCE_WEIGHT[r.source as SignalSource] ?? 0) > 0);
  const ageDays = (r: Row) => (now.getTime() - r.occurredAt.getTime()) / 86_400_000;

  // 1) Negative pressure — decayed, source- and magnitude-weighted mean negativity
  let num = 0;
  let den = 0;
  const contributions: { row: Row; c: number }[] = [];
  for (const r of scored) {
    const w =
      decay(ageDays(r)) *
      (SOURCE_WEIGHT[r.source as SignalSource] ?? 0) *
      (0.5 + 0.5 * clamp(r.magnitude));
    const c = w * negativity(r);
    num += c;
    den += w;
    if (c > 0) contributions.push({ row: r, c });
  }
  const negativePressure = den > 0 ? clamp(num / den) : 0;

  // 2) Velocity — negative signals this week vs weekly baseline of prior 4 weeks
  const neg7 = scored.filter((r) => ageDays(r) <= 7 && negativity(r) >= NEG_THRESHOLD).length;
  const negBaseline =
    scored.filter((r) => ageDays(r) > 7 && ageDays(r) <= 35 && negativity(r) >= NEG_THRESHOLD).length / 4;
  const ratio = neg7 / Math.max(negBaseline, 0.5);
  const velocity = clamp((ratio - 1) / 3); // 1x baseline → 0, 4x baseline → 1

  // 3) Recent criticals
  const criticals = scored.filter(
    (r) => ageDays(r) <= CRITICAL_WINDOW_DAYS && r.severity >= CRITICAL_SEVERITY && r.sentiment < 0,
  ).length;
  const criticalRecent = clamp(criticals / 5);

  // 4) Visibility — latest audit score within 60d, inverted
  const latestAudit = rows.find(
    (r) => r.source === 'visibility' && ageDays(r) <= 60 &&
      typeof (r.metadata as { score?: unknown })?.score === 'number',
  );
  const visibility = latestAudit
    ? clamp((100 - (latestAudit.metadata as { score: number }).score) / 100)
    : null;

  // 5) Stagnation — no data is a blind spot, not safety
  const recent30 = scored.filter((r) => ageDays(r) <= 30).length;
  const stagnation = recent30 === 0 ? 0.5 : recent30 < 3 ? 0.3 : recent30 < 6 ? 0.15 : 0;

  // Blend (renormalize when visibility is unavailable)
  const parts: [number, number][] = [
    [negativePressure, COMPONENT_WEIGHTS.negativePressure],
    [velocity, COMPONENT_WEIGHTS.velocity],
    [criticalRecent, COMPONENT_WEIGHTS.criticalRecent],
    [stagnation, COMPONENT_WEIGHTS.stagnation],
  ];
  if (visibility !== null) parts.push([visibility, COMPONENT_WEIGHTS.visibility]);
  const wSum = parts.reduce((a, [, w]) => a + w, 0);
  const blended = parts.reduce((a, [v, w]) => a + v * w, 0) / wSum;

  const score = Math.round(100 * clamp(blended));

  // Drivers — top negative contributors, normalized shares
  contributions.sort((a, b) => b.c - a.c);
  const top = contributions.slice(0, 5);
  const cSum = top.reduce((a, x) => a + x.c, 0) || 1;
  const drivers: RiskDriver[] = top.map(({ row, c }) => ({
    signalId: row.id,
    source: row.source as SignalSource,
    title: row.title ?? `${row.source} signal`,
    occurredAt: row.occurredAt.toISOString(),
    sentiment: row.sentiment,
    severity: row.severity,
    contribution: Number((c / cSum).toFixed(3)),
  }));

  const components: RiskComponents = {
    negativePressure: Number(negativePressure.toFixed(3)),
    velocity: Number(velocity.toFixed(3)),
    criticalRecent: Number(criticalRecent.toFixed(3)),
    visibility: visibility === null ? null : Number(visibility.toFixed(3)),
    stagnation: Number(stagnation.toFixed(3)),
  };

  return {
    score,
    grade: grade(score),
    components,
    drivers,
    signalCount: rows.length,
    window: { from: from.toISOString(), to: now.toISOString() },
  };
}

/** UTC midnight for snapshot bucketing. */
function utcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function computeAndPersist(tenantId: string, now = new Date()): Promise<RiskResult> {
  const result = await computeRisk(tenantId, now);
  const day = utcDay(now);
  await prisma.riskSnapshot.upsert({
    where: { tenantId_day: { tenantId, day } },
    create: {
      tenantId, day,
      score: result.score,
      grade: result.grade,
      components: result.components as never,
      drivers: result.drivers as never,
      signalCount: result.signalCount,
    },
    update: {
      score: result.score,
      grade: result.grade,
      components: result.components as never,
      drivers: result.drivers as never,
      signalCount: result.signalCount,
    },
  });
  return result;
}

export interface RiskOverview {
  current: RiskResult;
  deltas: { d7: number | null; d30: number | null }; // positive = risk increased
  history: { day: string; score: number; grade: string }[];
  computedAt: string;
}

export async function riskOverview(tenantId: string, opts?: { refresh?: boolean }): Promise<RiskOverview> {
  const now = new Date();
  const day = utcDay(now);

  const todaySnap = await prisma.riskSnapshot.findUnique({
    where: { tenantId_day: { tenantId, day } },
  });

  const fresh =
    !opts?.refresh &&
    todaySnap &&
    now.getTime() - todaySnap.updatedAt.getTime() < 15 * 60_000;

  const current: RiskResult = fresh
    ? {
        score: todaySnap.score,
        grade: todaySnap.grade as RiskGrade,
        components: todaySnap.components as unknown as RiskComponents,
        drivers: todaySnap.drivers as unknown as RiskDriver[],
        signalCount: todaySnap.signalCount,
        window: { from: '', to: todaySnap.updatedAt.toISOString() },
      }
    : await computeAndPersist(tenantId, now);

  const history = await prisma.riskSnapshot.findMany({
    where: { tenantId, day: { gte: new Date(now.getTime() - 90 * 86_400_000) } },
    orderBy: { day: 'asc' },
    select: { day: true, score: true, grade: true },
  });

  const at = (daysAgo: number): number | null => {
    const target = utcDay(new Date(now.getTime() - daysAgo * 86_400_000)).getTime();
    let best: { day: Date; score: number } | null = null;
    for (const h of history) {
      const t = h.day.getTime();
      if (t <= target && (!best || t > best.day.getTime())) best = h;
    }
    return best ? best.score : null;
  };

  const s7 = at(7);
  const s30 = at(30);

  return {
    current,
    deltas: {
      d7: s7 === null ? null : current.score - s7,
      d30: s30 === null ? null : current.score - s30,
    },
    history: history.map((h) => ({
      day: h.day.toISOString().slice(0, 10),
      score: h.score,
      grade: h.grade,
    })),
    computedAt: new Date().toISOString(),
  };
}
