// src/lib/ai-monitor/runner/scheduler.ts
//
// When each tenant's next checkup is due, and how many calls may be in flight
// at one provider while it runs.
//
// PURE, INCLUDING THE LIMITER. Every function takes its clock as an argument
// and the limiter is built on promises rather than timers, so the concurrency
// behaviour can be asserted deterministically instead of by sleeping and
// hoping. A scheduler whose tests can only say "roughly a week later" is a
// scheduler whose off-by-one-day bug ships — the same reasoning ../schedule.ts
// was written under.
//
// DISTINCT FROM ../schedule.ts, which answers the per-PROMPT question ("when is
// this question next asked"). This file answers the per-TENANT one ("when does
// this brand's next whole checkup fire"). Both exist because a prompt whose
// answers turn out volatile is sampled more often than the tier's headline
// cadence, and collapsing the two would either freeze that or multiply
// everyone's spend.
//
// JITTER IS DETERMINISTIC AND PER TENANT. Every tenant on `weekly` would
// otherwise fire at the same instant — midnight after a deploy — which is one
// thundering herd against every provider at once, and the shape of traffic that
// earns a rate limit or a 429 storm. Hashing the tenant id spreads them across
// the interval; hashing rather than randomising means a restart, a retry or a
// second worker computes the SAME slot, so a tenant does not drift a few
// minutes later on every cycle and a crash mid-sweep does not re-roll everyone.

import type { CheckupFrequency } from "@/lib/plan-config";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Days between checkups for each tier cadence.
 *
 * `twice_weekly` is 3.5 days rather than "Monday and Thursday": an exact half
 * week keeps the gap even, and a fixed pair of weekdays would bunch every
 * GROWTH tenant onto two days and leave five idle.
 */
export const CHECKUP_INTERVAL_DAYS: Readonly<Record<CheckupFrequency, number | null>> = {
  none: null,
  weekly: 7,
  twice_weekly: 3.5,
  daily: 1,
  /** ENTERPRISE, whose cadence is a contract term. Weekly until one is set. */
  custom: 7,
};

/**
 * How far a tenant's start is spread from the nominal slot.
 *
 * A whole interval would be wrong: a `daily` tenant jittered by up to 24h could
 * be asked twice in one calendar day and not at all the next. Capping the
 * window at a quarter of the interval keeps the cadence recognisable while
 * still turning a simultaneous start into a spread one.
 */
export const MAX_JITTER_FRACTION = 0.25;

/**
 * FNV-1a over the tenant id.
 *
 * Any stable hash would do; what matters is that it is stable. Math.random()
 * here would re-roll every tenant's slot on every restart, and this box
 * restarts several times a day.
 */
export function hashTenant(tenantId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < tenantId.length; i++) {
    hash ^= tenantId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** This tenant's offset into the jitter window, in milliseconds. */
export function tenantJitterMs(tenantId: string, intervalMs: number): number {
  if (intervalMs <= 0) return 0;
  const window = Math.floor(intervalMs * MAX_JITTER_FRACTION);
  if (window <= 0) return 0;
  return hashTenant(tenantId) % window;
}

/**
 * The instant this tenant's next checkup is nominally scheduled for.
 *
 * MAY BE IN THE PAST — that is the point. How far in the past is how overdue a
 * brand is, which is what drains a backlog in the right order. `nextCheckupAt`
 * clamps this to now for callers that want a future time to sleep until;
 * clamping before sorting would collapse every overdue brand onto the same
 * instant and make "oldest first" a no-op.
 *
 * Null for a tier that runs no checkups.
 */
export function scheduledCheckupAt(
  frequency: CheckupFrequency,
  tenantId: string,
  lastCheckupAt: Date | null,
  now: Date = new Date(),
): Date | null {
  const days = CHECKUP_INTERVAL_DAYS[frequency];
  if (days === null) return null;

  // A brand that has never run is due IMMEDIATELY, with no jitter.
  //
  // Jittering from `now` here would be a bug that never fires: every sweep
  // recomputes `now + offset`, so the slot walks forward by exactly as long as
  // the sweep interval and the first checkup never arrives. The herd this file
  // exists to break up is the RECURRING one — brands created at different
  // moments do not share a first slot anyway, and onboarding already staggers
  // their prompts (see ../schedule.ts staggeredStart).
  if (!lastCheckupAt) return now;

  const intervalMs = days * DAY_MS;
  return new Date(lastCheckupAt.getTime() + intervalMs + tenantJitterMs(tenantId, intervalMs));
}

/**
 * When this tenant's next checkup is due, never in the past.
 *
 * Measured from the LAST checkup rather than from now, so a queue backlog
 * cannot walk the whole schedule later every cycle; but clamped to now, so a
 * project resumed after a pause runs once and rejoins the cadence instead of
 * firing every missed slot.
 */
export function nextCheckupAt(
  frequency: CheckupFrequency,
  tenantId: string,
  lastCheckupAt: Date | null,
  now: Date = new Date(),
): Date | null {
  const due = scheduledCheckupAt(frequency, tenantId, lastCheckupAt, now);
  if (due === null) return null;
  return due.getTime() <= now.getTime() ? now : due;
}

export interface SchedulableBrand {
  brandProfileId: string;
  tenantId: string;
  frequency: CheckupFrequency;
  lastCheckupAt: Date | null;
  /** False while the setup wizard is unfinished. */
  trackingActive: boolean;
}

/**
 * The brands whose next checkup has come due.
 *
 * Ordered by how overdue they are, so a backlog drains oldest-first rather than
 * letting a brand at the end of the list starve behind newly-due ones.
 */
export function dueBrands(
  brands: readonly SchedulableBrand[],
  now: Date = new Date(),
): SchedulableBrand[] {
  return brands
    .filter((brand) => brand.trackingActive)
    .map((brand) => ({
      brand,
      // The UNCLAMPED time, so the sort below can tell a brand three months
      // overdue from one that came due a minute ago.
      due: scheduledCheckupAt(brand.frequency, brand.tenantId, brand.lastCheckupAt, now),
    }))
    .filter((entry) => entry.due !== null && entry.due.getTime() <= now.getTime())
    .sort((a, b) => (a.due as Date).getTime() - (b.due as Date).getTime())
    .map((entry) => entry.brand);
}

/**
 * In-flight calls allowed per provider.
 *
 * Conservative by default and per PROVIDER rather than global: the limit exists
 * to respect somebody else's rate limit, and those are counted per vendor. One
 * slow provider must not throttle calls to a different one, which is what a
 * single global limit would do.
 */
export const DEFAULT_PROVIDER_CONCURRENCY = 2;

/** `AI_CONCURRENCY_<PROVIDER>=4` raises one vendor without a deploy. */
export function concurrencyFor(
  provider: string,
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env[`AI_CONCURRENCY_${provider}`];
  const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_PROVIDER_CONCURRENCY;
  return parsed;
}

export interface ProviderLimiter {
  /** Run `fn` when this provider has a free slot. */
  run: <T>(provider: string, fn: () => Promise<T>) => Promise<T>;
  /** How many calls are running at this provider right now. */
  inFlight: (provider: string) => number;
}

/**
 * A per-provider semaphore.
 *
 * Queued rather than rejecting: a checkup that hits the limit should wait its
 * turn, not lose the slot. Built on promise resolution alone — no timers, no
 * polling — so a test can advance it by resolving the work it handed in and
 * assert exactly how many were let through.
 */
export function createProviderLimiter(
  limitFor: (provider: string) => number = (provider) => concurrencyFor(provider),
): ProviderLimiter {
  const running = new Map<string, number>();
  const waiting = new Map<string, (() => void)[]>();

  const current = (provider: string) => running.get(provider) ?? 0;

  const release = (provider: string) => {
    running.set(provider, Math.max(0, current(provider) - 1));
    const queue = waiting.get(provider);
    const next = queue?.shift();
    if (next) next();
  };

  const acquire = async (provider: string): Promise<void> => {
    if (current(provider) < limitFor(provider)) {
      running.set(provider, current(provider) + 1);
      return;
    }
    await new Promise<void>((resolve) => {
      const queue = waiting.get(provider) ?? [];
      queue.push(() => {
        running.set(provider, current(provider) + 1);
        resolve();
      });
      waiting.set(provider, queue);
    });
  };

  return {
    async run<T>(provider: string, fn: () => Promise<T>): Promise<T> {
      await acquire(provider);
      try {
        return await fn();
      } finally {
        release(provider);
      }
    },
    inFlight: current,
  };
}
