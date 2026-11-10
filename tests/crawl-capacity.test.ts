// Crawl concurrency: where crawls run, how many at once, and the Postgres
// connections that costs (src/lib/site-crawler/capacity.ts), plus the pm2 app
// that runs them (ecosystem.crawlers.config.js) and the render pool's numbers.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const SIDECAR_RENDER = "/opt/echorank/av-service/render.py";

const cap = await import("@/lib/site-crawler/capacity");
const { RENDER_REQUEST_TIMEOUT_MS, SIDECAR_QUEUE_WAIT_MS } = await import("@/lib/site-crawler/render");

describe("where crawls run", () => {
  it("unset: inside echorank360-workers, CRAWL_MAX_CONCURRENT at a time (6), so a deploy before the pm2 change strands nothing", () => {
    expect(cap.crawlProcesses({})).toBe(0);
    expect(cap.crawlsInOwnProcess({})).toBe(false);
    expect(cap.crawlConcurrencyPerProcess({})).toBe(6);
    expect(cap.crawlConcurrencyPerProcess({ CRAWL_MAX_CONCURRENT: "4" })).toBe(4);
    expect(cap.crawlSlotsConfigured({})).toBe(6);
  });

  it("CRAWL_PROCESSES=4: their own processes, 12 each, 48 at once", () => {
    const env = { CRAWL_PROCESSES: "4" };
    expect(cap.crawlsInOwnProcess(env)).toBe(true);
    expect(cap.crawlConcurrencyPerProcess(env)).toBe(12);
    expect(cap.crawlSlotsConfigured(env)).toBe(48);
    expect(cap.crawlSlotsConfigured({ ...env, CRAWL_CONCURRENCY_PER_PROCESS: "8" })).toBe(32);
    // CRAWL_MAX_CONCURRENT is the old shape's knob only.
    expect(cap.crawlConcurrencyPerProcess({ ...env, CRAWL_MAX_CONCURRENT: "2" })).toBe(12);
  });

  it("bounds and junk", () => {
    expect(cap.crawlProcesses({ CRAWL_PROCESSES: "99" })).toBe(8);
    expect(cap.crawlProcesses({ CRAWL_PROCESSES: "two" })).toBe(0);
    expect(cap.crawlConcurrencyPerProcess({ CRAWL_PROCESSES: "1", CRAWL_CONCURRENCY_PER_PROCESS: "40" })).toBe(16);
    expect(cap.crawlConcurrencyPerProcess({ CRAWL_PROCESSES: "1", CRAWL_CONCURRENCY_PER_PROCESS: "0" })).toBe(1);
  });
});

describe("Postgres connections stay under 60% of max_connections", () => {
  it("at the defaults: web 20 + workers 10 + 4 crawler processes × 7 = 58 < 60 of 100", () => {
    const b = cap.connectionBudget({ CRAWL_PROCESSES: "4" });
    expect(b).toEqual({ maxConnections: 100, budget: 59, web: 20, workers: 10, crawlerProcesses: 4, perCrawler: 7, total: 58 });
    expect(b.total).toBeLessThan(0.6 * b.maxConnections);
  });

  it.each([1, 2, 3, 4, 6, 8])("%i crawler processes still fit", (p) => {
    const b = cap.connectionBudget({ CRAWL_PROCESSES: String(p) });
    expect(b.total).toBeLessThan(0.6 * b.maxConnections);
    expect(b.perCrawler).toBeGreaterThanOrEqual(1);
  });

  it("a larger server gives each crawler process more", () => {
    expect(cap.connectionBudget({ CRAWL_PROCESSES: "4", PG_MAX_CONNECTIONS: "200" }).perCrawler).toBe(22);
  });
});

describe("the pm2 app (printed for root, not applied)", () => {
  const src = readFileSync(new URL("../ecosystem.crawlers.config.js", import.meta.url), "utf8");
  it("runs npm run crawlers, CRAWL_PROCESSES instances, each pool sized by the budget, and waits for a batch on stop", () => {
    expect(src).toContain("name: 'echorank360-crawlers'");
    expect(src).toContain("/usr/bin/npm run crawlers");
    expect(src).toContain("--reuid=echorank");
    expect(src).toMatch(/instances: PROCESSES/);
    expect(src).toMatch(/kill_timeout: 120_?000/);
    expect(src).toContain("DB_POOL_MAX");
  });

  it("the pool it gives each process is the budget's", async () => {
    const mod = (await import("../ecosystem.crawlers.config.js")) as { default?: unknown } & Record<string, unknown>;
    const cfg = (mod.default ?? mod) as { apps: { name: string; instances?: number; env: Record<string, string> }[] };
    const crawlers = cfg.apps.find((a) => a.name === "echorank360-crawlers")!;
    const b = cap.connectionBudget({ CRAWL_PROCESSES: String(crawlers.instances) });
    expect(crawlers.instances).toBe(cap.CRAWL_PROCESSES_DEFAULT);
    expect(Number(crawlers.env.DB_POOL_MAX)).toBe(b.perCrawler);
    expect(crawlers.env.CRAWL_PROCESSES).toBe(String(crawlers.instances));
    expect(Number(crawlers.env.CRAWL_CONCURRENCY_PER_PROCESS)).toBe(cap.CRAWL_CONCURRENCY_PER_PROCESS_DEFAULT);
  });
});

describe("render pool", () => {
  it("6 contexts by default (RENDER_CONTEXTS, the old RENDER_POOL as fallback), 1-12", () => {
    expect(cap.renderContexts({})).toBe(6);
    expect(cap.renderContexts({ RENDER_POOL: "3" })).toBe(3);
    expect(cap.renderContexts({ RENDER_CONTEXTS: "8", RENDER_POOL: "3" })).toBe(8);
    expect(cap.renderContexts({ RENDER_CONTEXTS: "50" })).toBe(12);
  });

  it("a render request waits as long as the sidecar's queue does, plus the render's own budget", () => {
    expect(SIDECAR_QUEUE_WAIT_MS).toBe(120_000);
    expect(RENDER_REQUEST_TIMEOUT_MS).toBeGreaterThan(SIDECAR_QUEUE_WAIT_MS + 20_000);
  });

  // The sidecar is its own repo; on this box it sits beside the app.
  it.skipIf(!existsSync(SIDECAR_RENDER))("av-service render.py waits the same 120 s and defaults to 6 contexts", () => {
    const py = readFileSync(SIDECAR_RENDER, "utf8");
    expect(py).toMatch(/RENDER_QUEUE_WAIT_S"\), 120\.0/);
    expect(py).toMatch(/return 6\n/);
  });
});
