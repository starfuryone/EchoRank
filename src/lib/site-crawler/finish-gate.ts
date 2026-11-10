// src/lib/site-crawler/finish-gate.ts
//
// Two guards for the end of a crawl, where every crawl of a process can land
// in the same second (same-sized sites, same 2 req/s pace):
//
// - FinishGate: a first-come semaphore around the link graph + aggregation,
//   crawlFinalizeConcurrency() at a time per process (capacity.ts). Without it
//   12 aggregations share a 7-connection pool and the queries at the back wait
//   past pg-pool's 5 s connect timeout.
// - withRetries: the terminal status write, retried with backoff. It is the
//   one write that must land: a row left RUNNING is a crawl the UI polls
//   forever.
//
// Dependency-free so the tests drive it with fake timers.

export class FinishGate {
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  /** Runs `fn` once a slot is free, in arrival order. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.limit) await new Promise<void>((resolve) => this.waiting.push(resolve));
    else this.running++;
    try {
      return await fn();
    } finally {
      const next = this.waiting.shift();
      // The slot passes straight to the next in line; `running` only drops when nobody waits.
      if (next) next();
      else this.running--;
    }
  }

  get stats(): { running: number; waiting: number; limit: number } {
    return { running: this.running, waiting: this.waiting.length, limit: this.limit };
  }
}

export const TERMINAL_WRITE_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const;

/**
 * `fn`, retried after each delay in `delaysMs` (31 s in all by default); the
 * last error is thrown. `onRetry` hears each failure that will be retried.
 */
export async function withRetries<T>(
  fn: () => Promise<T>,
  {
    delaysMs = TERMINAL_WRITE_DELAYS_MS,
    sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
    onRetry,
  }: { delaysMs?: readonly number[]; sleep?: (ms: number) => Promise<void>; onRetry?: (err: unknown, attempt: number) => void } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= delaysMs.length) throw err;
      onRetry?.(err, attempt + 1);
      await sleep(delaysMs[attempt]);
    }
  }
}
