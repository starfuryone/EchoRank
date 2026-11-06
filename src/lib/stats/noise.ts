// src/lib/stats/noise.ts
//
// How sure a mention rate is. An engine answers the same question differently
// from one run to the next, so "mentioned in 2 of 3 runs" and "mentioned in 66
// of 100" are both 67% and mean very different things. Everything that reports
// a rate, draws a trend or raises an alert reads it through here.
//
// Dependency-free: imported by server code and by client charts alike.

/** z for a two-sided 90% interval. */
export const Z90 = 1.6448536269514722;

export interface Interval {
  /** The observed rate, 0-1. */
  rate: number;
  low: number;
  high: number;
  n: number;
}

/**
 * Wilson score interval for k successes in n trials (default 90%).
 * Unlike the normal approximation it stays inside [0, 1] and is sensible at
 * the small n a prompt's runs give (n = 3 repetitions, a week of daily runs).
 * n = 0 is "nothing known": [0, 1].
 */
export function wilsonInterval(k: number, n: number, z: number = Z90): Interval {
  if (n <= 0) return { rate: 0, low: 0, high: 1, n: 0 };
  const p = Math.min(1, Math.max(0, k / n));
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { rate: p, low: Math.max(0, centre - half), high: Math.min(1, centre + half), n };
}

/** True when two intervals share any value. */
export function intervalsOverlap(a: Pick<Interval, "low" | "high">, b: Pick<Interval, "low" | "high">): boolean {
  return a.low <= b.high && b.low <= a.high;
}

/**
 * Exponentially weighted moving average, oldest value first. Each new value
 * moves the average by `alpha` of the way: 0.3 lets a real shift show within
 * three or four runs while one odd run moves it by under a third.
 */
export function ewma(values: readonly number[], alpha = 0.3): number | null {
  let acc: number | null = null;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    acc = acc === null ? v : alpha * v + (1 - alpha) * acc;
  }
  return acc;
}

/**
 * A rolling Wilson band over a series of yes/no observations, oldest first:
 * for each point, the interval over it and the `window - 1` before it.
 */
export function rollingWilson(observations: readonly boolean[], window = 7, z: number = Z90): Interval[] {
  return observations.map((_, i) => {
    const slice = observations.slice(Math.max(0, i - window + 1), i + 1);
    return wilsonInterval(slice.filter(Boolean).length, slice.length, z);
  });
}
