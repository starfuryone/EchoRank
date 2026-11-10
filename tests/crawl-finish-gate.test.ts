// The end of a crawl under load (finish-gate.ts): finalisations take turns,
// the terminal write is retried. (The worker's backstop, failOrphanedCrawl,
// is in site-crawler-tenant-caps.test.ts with the worker's other fakes.) The
// load test of 2026-11-10 lost 18 of 48 terminal writes to pool timeouts
// before these existed.
import { describe, expect, it, vi } from "vitest";
import { FinishGate, withRetries, TERMINAL_WRITE_DELAYS_MS } from "@/lib/site-crawler/finish-gate";
import { crawlFinalizeConcurrency } from "@/lib/site-crawler/capacity";

describe("FinishGate", () => {
  it("runs at most `limit` at once, the rest in arrival order", async () => {
    const gate = new FinishGate(2);
    const started: number[] = [];
    const release: (() => void)[] = [];
    let peak = 0;
    const runs = [0, 1, 2, 3, 4].map((i) =>
      gate.run(async () => {
        started.push(i);
        peak = Math.max(peak, gate.stats.running);
        await new Promise<void>((r) => release.push(r));
        return i;
      }),
    );
    await Promise.resolve();
    expect(started).toEqual([0, 1]);
    expect(gate.stats).toEqual({ running: 2, waiting: 3, limit: 2 });
    for (let k = 0; k < 5; k++) {
      while (release.length === 0) await new Promise((r) => setTimeout(r, 0));
      release.shift()!();
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(await Promise.all(runs)).toEqual([0, 1, 2, 3, 4]);
    expect(started).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
    expect(gate.stats).toEqual({ running: 0, waiting: 0, limit: 2 });
  });

  it("a finalisation that throws frees its slot", async () => {
    const gate = new FinishGate(1);
    await expect(gate.run(async () => { throw new Error("aggregation failed"); })).rejects.toThrow("aggregation failed");
    expect(await gate.run(async () => "next")).toBe("next");
    expect(gate.stats.running).toBe(0);
  });

  it("sized from the process's pool: one per 7 connections, at least 1", () => {
    const fin = crawlFinalizeConcurrency;
    expect(fin({ DB_POOL_MAX: "7" })).toBe(1);
    expect(fin({ DB_POOL_MAX: "3" })).toBe(1);
    expect(fin({})).toBe(2); // the old shape, pool 20
    expect(fin({ DB_POOL_MAX: "7", CRAWL_FINALIZE_CONCURRENCY: "3" })).toBe(3);
    expect(fin({ CRAWL_FINALIZE_CONCURRENCY: "99" })).toBe(8);
  });
});

describe("withRetries", () => {
  it("retries after each delay, then succeeds", async () => {
    const sleep = vi.fn(async () => {});
    const onRetry = vi.fn();
    let n = 0;
    const fn = vi.fn(async () => {
      if (++n < 3) throw new Error("timeout exceeded when trying to connect");
      return "written";
    });
    expect(await withRetries(fn, { sleep, onRetry })).toBe("written");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[1_000], [2_000]]);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("gives up after the last delay with the last error (31 s by default)", async () => {
    const sleep = vi.fn(async () => {});
    const fn = vi.fn(async () => { throw new Error("still down"); });
    await expect(withRetries(fn, { sleep })).rejects.toThrow("still down");
    expect(fn).toHaveBeenCalledTimes(TERMINAL_WRITE_DELAYS_MS.length + 1);
    expect(TERMINAL_WRITE_DELAYS_MS.reduce((a, b) => a + b, 0)).toBe(31_000);
  });
});
