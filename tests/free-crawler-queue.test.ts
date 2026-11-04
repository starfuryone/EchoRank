// tests/free-crawler-queue.test.ts — the free public crawler's system tenant
// and queue (commit 1): one `free-crawler` tenant (source free) created on
// first use; a free crawl is 100 URLs, spider, raw HTML, no config (so no
// opt-in), queued with FREE_CRAWL_PRIORITY; fair share holds the free tenant
// to exactly one running crawl whatever /admin says; free crawls count toward
// no paid tenant's quota; and, against a real throwaway Redis, BullMQ starts a
// paid crawl before a free one queued earlier.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const tenants: Record<string, Record<string, unknown>> = {};
const running: Record<string, number> = {};
const created: Record<string, unknown>[] = [];
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tenant: {
      upsert: vi.fn(async ({ where, create }: { where: { slug: string }; create: Record<string, unknown> }) => {
        const found = Object.values(tenants).find((t) => t.slug === where.slug);
        if (found) return { id: found.id };
        const id = `t_${where.slug}`;
        tenants[id] = { id, ...create };
        return { id };
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => tenants[where.id] ?? null),
    },
    crawlJob: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: `c${created.length}`, tenantId: data.tenantId };
      }),
      count: vi.fn(async ({ where }: { where: { tenantId: string } }) => running[where.tenantId] ?? 0),
    },
  },
}));
const addJob = vi.fn(async () => ({ id: "j" }));
vi.mock("@/infrastructure/queue/registry", () => ({ addJob: (...a: unknown[]) => addJob(...(a as [])) }));

const freeTenant = await import("@/lib/site-crawler/free-tenant");
const { enqueueFreeCrawl, FREE_CRAWL_URL_CAP } = await import("@/lib/site-crawler/free-crawl");
const { tenantHasCrawlSlot } = await import("@/lib/site-crawler/tenant-caps");

beforeEach(() => {
  for (const k of Object.keys(tenants)) delete tenants[k];
  for (const k of Object.keys(running)) delete running[k];
  created.length = 0;
  addJob.mockClear();
  freeTenant.__resetFreeTenantCache();
});

describe("the system tenant", () => {
  it("is created once, slug free-crawler, source free", async () => {
    const a = await freeTenant.freeTenantId();
    freeTenant.__resetFreeTenantCache();
    const b = await freeTenant.freeTenantId();
    expect(a).toBe(b);
    expect(Object.values(tenants)).toHaveLength(1);
    expect(tenants[a]).toMatchObject({ slug: "free-crawler", source: "free" });
    expect(freeTenant.CUSTOMER_TENANTS).toEqual({ source: "customer" });
  });
});

describe("a free crawl", () => {
  it("is 100 URLs, spider, raw HTML, no config, on the system tenant, behind every paid crawl", async () => {
    const job = await enqueueFreeCrawl("https://example.org/");
    expect(FREE_CRAWL_URL_CAP).toBe(100);
    expect(created[0]).toEqual({
      tenantId: job.tenantId,
      rootUrl: "https://example.org/",
      mode: "spider",
      urlCap: 100,
      renderMode: "none",
      renderCap: 0,
      status: "QUEUED",
    });
    expect(created[0]).not.toHaveProperty("config");
    expect(addJob).toHaveBeenCalledWith("site-crawl", "crawl", { crawlJobId: job.id, tenantId: job.tenantId }, { priority: freeTenant.FREE_CRAWL_PRIORITY });
    expect(freeTenant.FREE_CRAWL_PRIORITY).toBeGreaterThan(0);
  });
});

describe("fair share", () => {
  it("runs exactly one free crawl at a time, whatever the override says", async () => {
    const id = await freeTenant.freeTenantId();
    tenants[id]!.crawlConcurrencyOverride = 5;
    expect(await tenantHasCrawlSlot(id, "c2")).toBe(true);
    running[id] = 1;
    expect(await tenantHasCrawlSlot(id, "c2")).toBe(false);
    // A customer tenant with the same override is not held to one.
    tenants.t_paid = { id: "t_paid", source: "customer", crawlConcurrencyOverride: 5 };
    running.t_paid = 1;
    expect(await tenantHasCrawlSlot("t_paid", "c3")).toBe(true);
  });
});

// ─── BullMQ priority, for real ──────────────────────────────────────────────
//
// A throwaway redis-server on a free port (skipped where none is installed):
// a free crawl queued FIRST with FREE_CRAWL_PRIORITY, then a paid crawl with no
// priority; a one-slot worker picks the paid one first.
const hasRedis = spawnSync("sh", ["-c", "command -v redis-server"]).status === 0;
let server: ChildProcess | null = null;
let dir: string | null = null;
afterAll(() => {
  server?.kill("SIGTERM");
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe.skipIf(!hasRedis)("queue priority (real BullMQ, throwaway Redis)", () => {
  it("a paid crawl starts before a free one queued earlier", async () => {
    const { Queue, Worker } = await vi.importActual<typeof import("bullmq")>("bullmq");
    const IORedis = (await vi.importActual<{ default: new (...a: unknown[]) => { quit(): Promise<unknown> } }>("ioredis")).default;
    const port = 20000 + Math.floor(Math.random() * 20000);
    dir = mkdtempSync(join(tmpdir(), "fc-redis-"));
    server = spawn("redis-server", ["--port", String(port), "--save", "", "--appendonly", "no", "--dir", dir], { stdio: "ignore" });
    const connection = { host: "127.0.0.1", port, maxRetriesPerRequest: null };
    for (let i = 0; i < 50; i++) {
      const probe = new IORedis({ ...connection, lazyConnect: false, retryStrategy: () => null });
      const ok = await (probe as unknown as { ping(): Promise<string> }).ping().then(() => true, () => false);
      await probe.quit().catch(() => undefined);
      if (ok) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const queue = new Queue("site-crawl-priority-test", { connection });
    await queue.add("crawl", { kind: "free" }, { priority: freeTenant.FREE_CRAWL_PRIORITY });
    await queue.add("crawl", { kind: "paid" });
    const order: string[] = [];
    await new Promise<void>((resolve) => {
      const worker = new Worker(
        "site-crawl-priority-test",
        async (job) => {
          order.push((job.data as { kind: string }).kind);
          if (order.length === 2) setTimeout(() => void worker.close().then(() => resolve()), 10);
        },
        { connection, concurrency: 1 },
      );
    });
    await queue.close();
    expect(order).toEqual(["paid", "free"]);
  }, 20_000);
});
