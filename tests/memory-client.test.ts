// AI memory, the app side (src/lib/memory/): the sidecar client's failure
// postures, the PII scrub, the plan allowances, the Redis counters and the
// recall/remember helpers. fetch and Redis are stubbed; nothing reaches the
// real sidecar on :4500.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  return { store, redis, addJob: vi.fn<(...a: unknown[]) => Promise<{ id: string }>>(async () => ({ id: "j1" })) };
});

vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => m.redis,
  getSubscriberConnection: () => m.redis,
}));
vi.mock("@/infrastructure/queue/registry", () => ({ addJob: m.addJob }));

import { PLAN_CONFIGS } from "@/lib/plan-config";
import { areaForApi, areaForPage, planAllowsArea } from "@/lib/plan-access";
import {
  deleteMemory,
  getMemorySettings,
  MemoryUnavailableError,
  purgeTenantMemory,
  searchMemories,
} from "@/lib/memory/client";
import { memoryAllowance, memoryDailyTokenBudget, planHasMemory, MEMORY_SEARCH_TIMEOUT_MS } from "@/lib/memory/limits";
import {
  memoryAddsKey,
  memoryBudgetExhausted,
  memoryTokensKey,
  MemoryQuotaUnavailableError,
  recordMemoryTokens,
  releaseMemoryAdd,
  reserveMemoryAdd,
} from "@/lib/memory/quota";
import { knownFactsBlock, recallForPrompt, rememberLater } from "@/lib/memory/recall";
import { scrubForMemory } from "@/lib/memory/scrub";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  m.store.clear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
const sentBody = (i = 0) => JSON.parse(String((fetchMock.mock.calls[i][1] as RequestInit).body));
const sentUrl = (i = 0) => String(fetchMock.mock.calls[i][0]);

describe("plan allowances (plan-config.ts)", () => {
  it("are the proposed numbers, and 0 where neither surface exists", () => {
    expect(PLAN_CONFIGS.STARTER.memory).toEqual({ addsPerMonth: 500, maxStored: 2_000 });
    expect(PLAN_CONFIGS.GROWTH.memory).toEqual({ addsPerMonth: 2_000, maxStored: 10_000 });
    expect(PLAN_CONFIGS.AGENCY.memory).toEqual({ addsPerMonth: 10_000, maxStored: 50_000 });
    expect(PLAN_CONFIGS.ENTERPRISE.memory).toEqual({ addsPerMonth: null, maxStored: null });
    expect(planHasMemory("AI_VISIBILITY")).toBe(false);
    expect(planHasMemory("NOSY_BAT")).toBe(false);
    expect(planHasMemory("STARTER")).toBe(true);
    expect(planHasMemory(null)).toBe(false);
    expect(memoryAllowance(undefined)).toEqual({ addsPerMonth: 0, maxStored: 0 });
  });

  it("the settings page and API are reachable exactly on the plans that have memory", () => {
    expect(areaForPage("/settings/memory")).toBe("marketing_studio");
    expect(areaForApi("/api/account/memory")).toBe("marketing_studio");
    expect(areaForApi("/api/account/memory/0f8c1a52-7d0e-4f63-9a45-2f1d4c8b9e10")).toBe("marketing_studio");
    expect(areaForApi("/api/account/deletion")).toBe("account");
    for (const plan of Object.keys(PLAN_CONFIGS) as (keyof typeof PLAN_CONFIGS)[]) {
      expect(planAllowsArea(plan, "marketing_studio"), plan).toBe(planHasMemory(plan));
    }
  });

  it("the daily token budget: default 2M, 0 is the kill switch, junk falls back", () => {
    expect(memoryDailyTokenBudget({})).toBe(2_000_000);
    expect(memoryDailyTokenBudget({ MEM0_DAILY_TOKEN_BUDGET: "0" })).toBe(0);
    expect(memoryDailyTokenBudget({ MEM0_DAILY_TOKEN_BUDGET: "5000" })).toBe(5000);
    expect(memoryDailyTokenBudget({ MEM0_DAILY_TOKEN_BUDGET: "lots" })).toBe(2_000_000);
    expect(memoryDailyTokenBudget({ MEM0_DAILY_TOKEN_BUDGET: "-1" })).toBe(2_000_000);
  });
});

describe("scrubForMemory (mirrors av-service memory/scrub.py)", () => {
  it.each([
    ["write to jo.martin@example.co.uk today", "jo.martin@example.co.uk"],
    ["call +41 79 123 45 67 after 5", "79 123 45 67"],
    ["tel. 01 42 68 53 00", "42 68 53 00"],
    ["see https://shop.example.com/menu?email=a%40b.c&utm=x", "?email"],
    ["card 4111 1111 1111 1111 on file", "4111 1111 1111 1111"],
  ])("removes %s", (raw, gone) => {
    expect(scrubForMemory(raw)).not.toContain(gone);
  });
  it.each([
    "Dropped the loyalty card on 2026-11-15.",
    "Opening hours change on 15.11.2026.",
    "Seasonal menu 2024-2026, prices from $12.50 to $1,200.",
    "See https://shop.example.com/menu for the menu.",
  ])("keeps %s", (keep) => {
    expect(scrubForMemory(keep)).toBe(keep);
  });
});

describe("searchMemories fails open", () => {
  it("gives up after 800 ms and returns no memories", async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
    );
    const started = Date.now();
    const r = await searchMemories({ tenantId: "tA", query: "tone" });
    const took = Date.now() - started;
    expect(r).toEqual({ ok: false, results: [] });
    expect(took).toBeGreaterThanOrEqual(MEMORY_SEARCH_TIMEOUT_MS - 50);
    expect(took).toBeLessThan(MEMORY_SEARCH_TIMEOUT_MS + 700);
  });

  it("a sidecar error, a 503 and bad JSON are all just 'no memories'", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect(await searchMemories({ tenantId: "tA", query: "x" })).toEqual({ ok: false, results: [] });
    fetchMock.mockReturnValueOnce(json(503, { detail: "memory store unavailable" }));
    expect(await searchMemories({ tenantId: "tA", query: "x" })).toEqual({ ok: false, results: [] });
    fetchMock.mockReturnValueOnce(Promise.resolve(new Response("<html>", { status: 200 })));
    expect(await searchMemories({ tenantId: "tA", query: "x" })).toEqual({ ok: false, results: [] });
  });

  it("sends the tenant it was given, the secret header, and caps the limit at 10", async () => {
    process.env.INTERNAL_API_SECRET = "s3cret-test";
    fetchMock.mockReturnValueOnce(json(200, { results: [{ id: "1", memory: "Tone is plain.", score: 0.4, created_at: null, surface: "mcp" }] }));
    const r = await searchMemories({ tenantId: "tA", query: "tone", limit: 50 });
    expect(r.ok).toBe(true);
    expect(r.results.map((x) => x.memory)).toEqual(["Tone is plain."]);
    expect(sentUrl()).toMatch(/\/memory\/search$/);
    expect(sentBody()).toMatchObject({ tenantId: "tA", query: "tone", limit: 10 });
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ "X-Internal-Secret": "s3cret-test" });
  });
});

describe("the writes throw, so a retry or a FAILED deletion follows", () => {
  it("settings and item delete", async () => {
    fetchMock.mockReturnValueOnce(json(503, { detail: "memory store unavailable" }));
    await expect(getMemorySettings("tA")).rejects.toBeInstanceOf(MemoryUnavailableError);
    fetchMock.mockReturnValueOnce(json(404, { detail: "memory not found" }));
    expect(await deleteMemory("tA", "0f8c1a52-7d0e-4f63-9a45-2f1d4c8b9e10")).toBe(false);
    fetchMock.mockReturnValueOnce(json(200, { deleted: "x" }));
    expect(await deleteMemory("tA", "0f8c1a52-7d0e-4f63-9a45-2f1d4c8b9e10")).toBe(true);
    expect(sentUrl(1)).toContain("tenantId=tA");
  });

  it("purge: an unconfigured store is null; leftovers or an outage throw", async () => {
    fetchMock.mockReturnValueOnce(json(503, { detail: "memory not configured: MEM0_PG_PASSWORD is not set" }));
    expect(await purgeTenantMemory("tA", { forgetSettings: true })).toBeNull();
    expect(sentUrl(0)).toMatch(/\/memory\/tenant\/tA\?forgetSettings=true$/);
    fetchMock.mockReturnValueOnce(json(200, { purged: { memories: 3 }, remaining: 1 }));
    await expect(purgeTenantMemory("tA")).rejects.toBeInstanceOf(MemoryUnavailableError);
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(purgeTenantMemory("tA")).rejects.toBeInstanceOf(MemoryUnavailableError);
    fetchMock.mockReturnValueOnce(json(200, { purged: { memories: 3 }, remaining: 0 }));
    expect(await purgeTenantMemory("tA")).toEqual({ purged: { memories: 3 }, remaining: 0 });
  });
});

describe("quota (Redis, month-keyed)", () => {
  const now = new Date("2026-11-15T10:00:00Z");

  it("STARTER: 500 adds, then refused with the counter rolled back", async () => {
    m.store.set(memoryAddsKey("tA", now), 499);
    expect(await reserveMemoryAdd("tA", "STARTER", now)).toEqual({ allowed: true, used: 500, limit: 500 });
    expect(await reserveMemoryAdd("tA", "STARTER", now)).toEqual({ allowed: false, used: 500, limit: 500 });
    expect(m.store.get(memoryAddsKey("tA", now))).toBe(500);
    // Another tenant's counter is its own.
    expect((await reserveMemoryAdd("tB", "STARTER", now)).allowed).toBe(true);
    await releaseMemoryAdd("tA", now);
    expect(m.store.get(memoryAddsKey("tA", now))).toBe(499);
  });

  it("a plan without memory is refused without touching Redis; ENTERPRISE has no ceiling", async () => {
    expect(await reserveMemoryAdd("tA", "AI_VISIBILITY", now)).toEqual({ allowed: false, used: 0, limit: 0 });
    expect(m.redis.incr).not.toHaveBeenCalled();
    m.store.set(memoryAddsKey("tE", now), 1_000_000);
    expect(await reserveMemoryAdd("tE", "ENTERPRISE", now)).toMatchObject({ allowed: true, limit: null });
  });

  it("fails closed when Redis is down", async () => {
    m.redis.incr.mockRejectedValueOnce(new Error("down"));
    await expect(reserveMemoryAdd("tA", "GROWTH", now)).rejects.toBeInstanceOf(MemoryQuotaUnavailableError);
    m.redis.get.mockRejectedValueOnce(new Error("down"));
    expect(await memoryBudgetExhausted(now, {})).toBe(true);
  });

  it("the daily token budget is shared across tenants and 0 stops everything", async () => {
    expect(await memoryBudgetExhausted(now, { MEM0_DAILY_TOKEN_BUDGET: "1000" })).toBe(false);
    await recordMemoryTokens(600, now);
    await recordMemoryTokens(400, now);
    expect(m.store.get(memoryTokensKey(now))).toBe(1000);
    expect(await memoryBudgetExhausted(now, { MEM0_DAILY_TOKEN_BUDGET: "1000" })).toBe(true);
    expect(await memoryBudgetExhausted(now, { MEM0_DAILY_TOKEN_BUDGET: "0" })).toBe(true);
  });
});

describe("recall and remember", () => {
  it("recallForPrompt: nothing for a plan without memory, and no call made", async () => {
    expect(await recallForPrompt({ tenantId: "tA", plan: "AI_VISIBILITY", query: "tone" })).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("recallForPrompt: top memories, trimmed, and [] when the sidecar is slow", async () => {
    fetchMock.mockReturnValueOnce(
      json(200, { results: [{ id: "1", memory: `  Tone is plain. ${"x".repeat(400)}`, score: 0.5, created_at: null, surface: "mcp" }] }),
    );
    const facts = await recallForPrompt({ tenantId: "tA", plan: "GROWTH", query: "tone" });
    expect(facts).toHaveLength(1);
    expect(facts[0].startsWith("Tone is plain.")).toBe(true);
    expect(facts[0].length).toBe(300);
    expect(sentBody()).toMatchObject({ tenantId: "tA", limit: 5 });
    fetchMock.mockRejectedValueOnce(new Error("timeout"));
    expect(await recallForPrompt({ tenantId: "tA", plan: "GROWTH", query: "tone" })).toEqual([]);
  });

  it("knownFactsBlock: null when empty, a bulleted block otherwise", () => {
    expect(knownFactsBlock([])).toBeNull();
    const b = knownFactsBlock(["Tone is plain.", "Competitor: Dupont."])!;
    expect(b).toMatch(/^Known about this business/);
    expect(b).toContain("the brief wins");
    expect(b.split("\n").slice(1)).toEqual(["- Tone is plain.", "- Competitor: Dupont."]);
  });

  it("rememberLater: queues scrubbed text on memory-add", async () => {
    const ok = await rememberLater({
      tenantId: "tA",
      plan: "STARTER",
      surface: "marketing_studio",
      locale: "fr",
      messages: [{ role: "user", content: "Ton chaleureux. Écrivez-moi à jo@example.com ou au +41 79 123 45 67." }],
      userId: "u1",
    });
    expect(ok).toBe(true);
    const [queue, name, job] = m.addJob.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(queue).toBe("memory-add");
    expect(name).toBe("add");
    expect(job).toMatchObject({ tenantId: "tA", surface: "marketing_studio", locale: "fr", userId: "u1" });
    const content = (job.messages as { content: string }[])[0].content;
    expect(content).toContain("Ton chaleureux.");
    expect(content).not.toContain("jo@example.com");
    expect(content).not.toContain("79 123 45 67");
  });

  it("rememberLater never throws, and does nothing for a plan without memory", async () => {
    m.addJob.mockRejectedValueOnce(new Error("redis down"));
    await expect(rememberLater({ tenantId: "tA", plan: "GROWTH", surface: "mcp", locale: "en", text: "Tone is plain." })).resolves.toBe(false);
    expect(await rememberLater({ tenantId: "tA", plan: "NOSY_BAT", surface: "mcp", locale: "en", text: "x y z" })).toBe(false);
    expect(await rememberLater({ tenantId: "tA", plan: "GROWTH", surface: "mcp", locale: "en", text: "   " })).toBe(false);
    expect(m.addJob).toHaveBeenCalledTimes(1);
  });
});
