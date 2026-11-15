// The memory-add worker (src/infrastructure/queue/workers/memory-add.worker.ts):
// its gates in order, and that every path that spends nothing gives the
// reserved add back. The sidecar call and the plan lookups are stubbed; the
// quota is the real module over an in-memory Redis.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";

const m = vi.hoisted(() => {
  const store = new Map<string, number>();
  const redis = {
    incr: vi.fn(async (k: string) => {
      store.set(k, (store.get(k) ?? 0) + 1);
      return store.get(k)!;
    }),
    incrby: vi.fn(async (k: string, n: number) => {
      store.set(k, (store.get(k) ?? 0) + n);
      return store.get(k)!;
    }),
    decr: vi.fn(async (k: string) => {
      store.set(k, (store.get(k) ?? 0) - 1);
      return store.get(k)!;
    }),
    get: vi.fn(async (k: string) => (store.has(k) ? String(store.get(k)) : null)),
    expire: vi.fn(async () => 1),
  };
  return {
    store,
    redis,
    hasPaidPlan: vi.fn<(...a: unknown[]) => Promise<boolean>>(async () => true),
    tenantPlan: vi.fn<(...a: unknown[]) => Promise<string | null>>(async () => "STARTER"),
    addMemoryNow: vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({
      added: [{ id: "m1", memory: "Tone is plain.", category: "tone" }],
      dropped: 0,
      usage: { input_tokens: 900, output_tokens: 60 },
    })),
  };
});

vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => m.redis,
  getSubscriberConnection: () => m.redis,
}));
vi.mock("@/lib/paid-plan", () => ({ hasPaidPlan: m.hasPaidPlan }));
vi.mock("@/lib/plan-access-server", () => ({ tenantPlan: m.tenantPlan }));
vi.mock("@/lib/memory/client", () => ({ addMemoryNow: m.addMemoryNow }));

import { processMemoryAdd } from "@/infrastructure/queue/workers/memory-add.worker";
import { memoryAddsKey, memoryTokensKey } from "@/lib/memory/quota";
import { getDefaultJobOptions } from "@/infrastructure/queue/registry";

const job = (data: Record<string, unknown>) => ({ data, id: "j1" }) as unknown as Job<never>;
const base = { tenantId: "tA", surface: "marketing_studio", locale: "en", messages: [{ role: "user", content: "Tone is plain." }] };

beforeEach(() => {
  vi.clearAllMocks();
  m.store.clear();
  delete process.env.MEM0_DAILY_TOKEN_BUDGET;
});

describe("processMemoryAdd", () => {
  it("adds, counts the add and the tokens, and passes the plan's maxStored", async () => {
    expect(await processMemoryAdd(job(base))).toBe("added:1");
    expect(m.addMemoryNow).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tA", surface: "marketing_studio", maxStored: 2_000, metadata: { locale: "en" } }),
    );
    expect(m.store.get(memoryAddsKey("tA"))).toBe(1);
    expect(m.store.get(memoryTokensKey())).toBe(960);
  });

  it("skips an unpaid tenant and a plan without memory before any spend", async () => {
    m.hasPaidPlan.mockResolvedValueOnce(false);
    expect(await processMemoryAdd(job(base))).toBe("skipped:unpaid");
    m.tenantPlan.mockResolvedValueOnce("AI_VISIBILITY");
    expect(await processMemoryAdd(job(base))).toBe("skipped:plan");
    expect(m.addMemoryNow).not.toHaveBeenCalled();
    expect(m.redis.incr).not.toHaveBeenCalled();
  });

  it("the daily token budget stops it (kill switch at 0)", async () => {
    process.env.MEM0_DAILY_TOKEN_BUDGET = "0";
    expect(await processMemoryAdd(job(base))).toBe("skipped:budget");
    expect(m.addMemoryNow).not.toHaveBeenCalled();
  });

  it("a tenant over its month is skipped, not thrown (no support@ email per add)", async () => {
    m.store.set(memoryAddsKey("tA"), 500);
    expect(await processMemoryAdd(job(base))).toBe("skipped:quota");
    expect(m.addMemoryNow).not.toHaveBeenCalled();
  });

  it("a sidecar failure gives the add back and throws for a retry", async () => {
    m.addMemoryNow.mockRejectedValueOnce(new Error("Memory is unavailable (502)"));
    await expect(processMemoryAdd(job(base))).rejects.toThrow("502");
    expect(m.store.get(memoryAddsKey("tA"))).toBe(0);
  });

  it("switched off or full in the sidecar: the add is given back", async () => {
    m.addMemoryNow.mockResolvedValueOnce({ added: [], dropped: 0, usage: { input_tokens: 0, output_tokens: 0 }, skipped: "disabled" });
    expect(await processMemoryAdd(job(base))).toBe("skipped:disabled");
    m.addMemoryNow.mockResolvedValueOnce({ added: [], dropped: 0, usage: { input_tokens: 0, output_tokens: 0 }, skipped: "full" });
    expect(await processMemoryAdd(job(base))).toBe("skipped:full");
    expect(m.store.get(memoryAddsKey("tA"))).toBe(0);
  });

  it("ENTERPRISE sends no maxStored ceiling", async () => {
    m.tenantPlan.mockResolvedValueOnce("ENTERPRISE");
    await processMemoryAdd(job({ ...base, tenantId: "tE" }));
    expect(m.addMemoryNow).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tE", maxStored: null }));
  });

  it("the queue keeps a finished job's text no longer than needed", () => {
    expect(getDefaultJobOptions("memory-add")).toMatchObject({ attempts: 3, removeOnComplete: true, removeOnFail: { age: 86_400 } });
  });
});
