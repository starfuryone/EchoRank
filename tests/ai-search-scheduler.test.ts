// tests/ai-search-scheduler.test.ts
//
// When a tenant's next checkup fires, and how many calls may be in flight at
// one provider.
//
// THE JITTER TESTS ARE ABOUT DETERMINISM AS MUCH AS SPREAD. Randomised jitter
// would also spread the herd, and would also pass a "they do not all fire at
// once" assertion — and would then re-roll every tenant's slot on every restart
// of a box that restarts several times a day, so a weekly checkup could fire
// twice in one week and not at all the next. The assertions below pin BOTH
// properties, because only one of them is obvious.
//
// THE LIMITER IS TESTED WITHOUT TIMERS. Work is handed in as promises the test
// resolves by hand, so "the third call waits" is an exact statement rather than
// a race against a sleep.

import { describe, expect, it } from "vitest";
import type { CheckupFrequency } from "@/lib/plan-config";
import {
  CHECKUP_INTERVAL_DAYS,
  DEFAULT_PROVIDER_CONCURRENCY,
  MAX_JITTER_FRACTION,
  concurrencyFor,
  createProviderLimiter,
  dueBrands,
  hashTenant,
  nextCheckupAt,
  tenantJitterMs,
  type SchedulableBrand,
} from "@/lib/ai-monitor/runner/scheduler";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-08-10T09:00:00Z");

/**
 * Let every pending microtask settle.
 *
 * Admitting a queued call takes several ticks — resolve the waiter, resume its
 * `await`, enter the work function — and counting them by hand makes the test
 * fail when an implementation detail adds one. A macrotask boundary drains them
 * all without becoming a sleep.
 */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("tier cadence", () => {
  it("maps every frequency the plan config can hold", () => {
    // A frequency with no interval would silently never schedule.
    const frequencies: CheckupFrequency[] = ["none", "weekly", "twice_weekly", "daily", "custom"];
    for (const frequency of frequencies) {
      expect(CHECKUP_INTERVAL_DAYS[frequency]).not.toBeUndefined();
    }
    expect(CHECKUP_INTERVAL_DAYS.none).toBeNull();
    expect(CHECKUP_INTERVAL_DAYS.weekly).toBe(7);
    expect(CHECKUP_INTERVAL_DAYS.twice_weekly).toBe(3.5);
    expect(CHECKUP_INTERVAL_DAYS.daily).toBe(1);
  });

  it("never schedules a tier that runs no checkups", () => {
    expect(nextCheckupAt("none", "t1", null, NOW)).toBeNull();
  });

  it("measures from the last checkup, not from now", () => {
    // Anchoring to `now` lets a queue backlog walk the whole schedule later
    // every cycle.
    const lastWeek = new Date(NOW.getTime() - 3 * DAY_MS);
    const due = nextCheckupAt("weekly", "t1", lastWeek, NOW)!;
    const expected = lastWeek.getTime() + 7 * DAY_MS + tenantJitterMs("t1", 7 * DAY_MS);
    expect(due.getTime()).toBe(expected);
  });

  it("returns now for a brand resumed after a long pause", () => {
    // Not a time in the past, and not one slot per missed interval — a project
    // resumed after a month runs once and rejoins the cadence.
    const longAgo = new Date(NOW.getTime() - 90 * DAY_MS);
    expect(nextCheckupAt("weekly", "t1", longAgo, NOW)!.getTime()).toBe(NOW.getTime());
  });
});

describe("per-tenant jitter", () => {
  it("is deterministic across calls", () => {
    // A restart must compute the same slot; this box restarts several times a
    // day, and a re-rolled offset would drift every tenant's cadence.
    expect(tenantJitterMs("tenant_abc", 7 * DAY_MS)).toBe(tenantJitterMs("tenant_abc", 7 * DAY_MS));
    expect(hashTenant("tenant_abc")).toBe(hashTenant("tenant_abc"));
  });

  it("spreads different tenants across the window", () => {
    const offsets = Array.from({ length: 60 }, (_, i) =>
      tenantJitterMs(`tenant_${i}`, 7 * DAY_MS),
    );
    // Not all the same instant, which is the thundering herd this exists to
    // prevent.
    expect(new Set(offsets).size).toBeGreaterThan(50);
    // And spread across the window rather than clustered at one end.
    const window = 7 * DAY_MS * MAX_JITTER_FRACTION;
    expect(Math.min(...offsets)).toBeLessThan(window * 0.25);
    expect(Math.max(...offsets)).toBeGreaterThan(window * 0.75);
  });

  it("stays inside a quarter of the interval", () => {
    // A daily tenant jittered by a whole day could be asked twice on one date
    // and not at all the next.
    for (const tenant of ["a", "b", "tenant_long_identifier", "9"]) {
      const jitter = tenantJitterMs(tenant, DAY_MS);
      expect(jitter).toBeGreaterThanOrEqual(0);
      expect(jitter).toBeLessThan(DAY_MS * MAX_JITTER_FRACTION);
    }
  });

  it("gives two tenants on the same cadence different slots", () => {
    // The RECURRING case, which is the herd jitter exists to break up: two
    // tenants that last ran at the same instant must not come due together.
    const lastRun = new Date(NOW.getTime() - 2 * DAY_MS);
    const a = nextCheckupAt("weekly", "tenant_a", lastRun, NOW)!;
    const b = nextCheckupAt("weekly", "tenant_b", lastRun, NOW)!;
    expect(a.getTime()).not.toBe(b.getTime());
  });

  it("does not jitter a brand's very first checkup", () => {
    // Jittering from `now` would be a slot that never arrives: every sweep
    // recomputes now + offset, so it walks forward by the sweep interval
    // forever and the first checkup never fires.
    expect(nextCheckupAt("weekly", "tenant_a", null, NOW)!.getTime()).toBe(NOW.getTime());
    expect(nextCheckupAt("weekly", "tenant_b", null, NOW)!.getTime()).toBe(NOW.getTime());
  });

  it("handles a zero or negative interval without dividing by it", () => {
    expect(tenantJitterMs("t1", 0)).toBe(0);
    expect(tenantJitterMs("t1", -5)).toBe(0);
  });
});

describe("selecting what is due", () => {
  const brand = (over: Partial<SchedulableBrand>): SchedulableBrand => ({
    brandProfileId: "b1",
    tenantId: "t1",
    frequency: "weekly",
    lastCheckupAt: new Date(NOW.getTime() - 30 * DAY_MS),
    trackingActive: true,
    ...over,
  });

  it("returns brands whose slot has passed", () => {
    expect(dueBrands([brand({})], NOW)).toHaveLength(1);
  });

  it("skips a brand whose setup wizard is unfinished", () => {
    // trackingActive is the flag /visibility reads; scheduling an unconfigured
    // brand would spend money on prompts nobody approved.
    expect(dueBrands([brand({ trackingActive: false })], NOW)).toHaveLength(0);
  });

  it("skips a tier that runs no checkups", () => {
    expect(dueBrands([brand({ frequency: "none" })], NOW)).toHaveLength(0);
  });

  it("skips a brand checked recently", () => {
    expect(dueBrands([brand({ lastCheckupAt: NOW })], NOW)).toHaveLength(0);
  });

  it("drains the oldest first so a backlog cannot starve one brand", () => {
    const older = brand({
      brandProfileId: "old",
      tenantId: "t_old",
      lastCheckupAt: new Date(NOW.getTime() - 90 * DAY_MS),
    });
    const newer = brand({
      brandProfileId: "new",
      tenantId: "t_new",
      lastCheckupAt: new Date(NOW.getTime() - 8 * DAY_MS),
    });
    const order = dueBrands([newer, older], NOW).map((b) => b.brandProfileId);
    expect(order).toEqual(["old", "new"]);
  });

  it("schedules a brand that has never run, on the first sweep that sees it", () => {
    expect(dueBrands([brand({ lastCheckupAt: null })], NOW)).toHaveLength(1);
    // And still on the next sweep, had it not run — the regression here is a
    // first slot that recedes by exactly the sweep interval each time.
    const later = new Date(NOW.getTime() + 15 * 60_000);
    expect(dueBrands([brand({ lastCheckupAt: null })], later)).toHaveLength(1);
  });
});

describe("per-provider concurrency", () => {
  it("defaults conservatively and reads an env override", () => {
    expect(concurrencyFor("CLAUDE", {} as NodeJS.ProcessEnv)).toBe(DEFAULT_PROVIDER_CONCURRENCY);
    expect(concurrencyFor("CLAUDE", { AI_CONCURRENCY_CLAUDE: "5" } as unknown as NodeJS.ProcessEnv)).toBe(5);
    // Nonsense falls back rather than throttling to zero, which would stall the
    // queue silently.
    expect(concurrencyFor("CLAUDE", { AI_CONCURRENCY_CLAUDE: "0" } as unknown as NodeJS.ProcessEnv)).toBe(
      DEFAULT_PROVIDER_CONCURRENCY,
    );
    expect(concurrencyFor("CLAUDE", { AI_CONCURRENCY_CLAUDE: "abc" } as unknown as NodeJS.ProcessEnv)).toBe(
      DEFAULT_PROVIDER_CONCURRENCY,
    );
  });

  it("lets the limit through and queues the rest", async () => {
    const limiter = createProviderLimiter(() => 2);
    const release: (() => void)[] = [];
    const started: number[] = [];

    const work = (id: number) =>
      limiter.run("CLAUDE", async () => {
        started.push(id);
        await new Promise<void>((resolve) => release.push(resolve));
        return id;
      });

    const all = [work(1), work(2), work(3)];
    await flush();

    expect(started).toEqual([1, 2]);
    expect(limiter.inFlight("CLAUDE")).toBe(2);

    // Finishing one admits exactly one more.
    release.shift()!();
    await flush();
    expect(started).toEqual([1, 2, 3]);

    release.forEach((fn) => fn());
    await expect(Promise.all(all)).resolves.toEqual([1, 2, 3]);
    expect(limiter.inFlight("CLAUDE")).toBe(0);
  });

  it("counts each provider separately", async () => {
    // A slow vendor must not throttle calls to a different one, which is what a
    // single global limit would do.
    const limiter = createProviderLimiter(() => 1);
    const release: (() => void)[] = [];
    const started: string[] = [];

    const work = (provider: string) =>
      limiter.run(provider, async () => {
        started.push(provider);
        await new Promise<void>((resolve) => release.push(resolve));
      });

    const all = [work("CLAUDE"), work("GEMINI")];
    await flush();

    expect(started.sort()).toEqual(["CLAUDE", "GEMINI"]);
    release.forEach((fn) => fn());
    await Promise.all(all);
  });

  it("frees the slot when the work throws", async () => {
    // A limiter that leaks a permit on failure deadlocks the queue after enough
    // provider errors — and provider errors are routine.
    const limiter = createProviderLimiter(() => 1);
    await expect(
      limiter.run("CLAUDE", async () => {
        throw new Error("upstream 503");
      }),
    ).rejects.toThrow("upstream 503");

    expect(limiter.inFlight("CLAUDE")).toBe(0);
    await expect(limiter.run("CLAUDE", async () => "ok")).resolves.toBe("ok");
  });

  it("runs queued work in the order it arrived", async () => {
    const limiter = createProviderLimiter(() => 1);
    const release: (() => void)[] = [];
    const started: number[] = [];
    const work = (id: number) =>
      limiter.run("CLAUDE", async () => {
        started.push(id);
        await new Promise<void>((resolve) => release.push(resolve));
      });

    const all = [work(1), work(2), work(3)];
    for (let i = 0; i < 4; i++) {
      release.shift()?.();
      await flush();
    }
    release.forEach((fn) => fn());
    await Promise.all(all);
    expect(started).toEqual([1, 2, 3]);
  });
});
