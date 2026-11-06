// The shared answer cache (src/lib/answer-cache.ts) and its three users: the
// scheduled tracker and keyword test (ai-monitor/runner/shared-answers.ts) and
// the free check (snapshot/job.ts askSharedSnapshot).
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/snapshot/store", () => ({}));
vi.mock("@/lib/snapshot/deliver", () => ({ sendReport: vi.fn(), subscribeToList: vi.fn() }));
vi.mock("@/infrastructure/queue/registry", () => ({ addJob: vi.fn() }));
vi.mock("@/infrastructure/observability/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/infrastructure/redis/connection", () => ({
  getRedisConnection: () => {
    throw new Error("tests pass a store explicitly");
  },
}));

import {
  answerCacheKey,
  isBrandSpecific,
  normalizePrompt,
  statsKey,
  withSharedAnswer,
  type AnswerCacheStore,
  type AnswerRequest,
} from "@/lib/answer-cache";
import { trackerAnswerRequest } from "@/lib/ai-monitor/runner/shared-answers";
import { buildPrompts } from "@/lib/snapshot/prompts";
import { runSnapshot, type RunDeps } from "@/lib/snapshot/run";

const NOW = new Date("2026-11-06T10:00:00Z");
const NOENV = {} as NodeJS.ProcessEnv;
const REQ: AnswerRequest = { engine: "CHATGPT", model: "gpt-5", profile: "p1", repetition: 1 };

/** An in-memory stand-in for the Redis client, recording what was written. */
function memoryStore() {
  const data = new Map<string, string>();
  const sets: Array<{ key: string; value: string; seconds: number }> = [];
  const store: AnswerCacheStore = {
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, _mode: "EX", seconds: number) => {
      sets.push({ key, value, seconds });
      if (!data.has(key)) data.set(key, value);
      return "OK";
    }),
    incr: vi.fn(async (key: string) => {
      const n = Number(data.get(key) ?? 0) + 1;
      data.set(key, String(n));
      return n;
    }),
    expire: vi.fn(async () => 1),
  };
  return { store, data, sets };
}

describe("the key", () => {
  it("folds what does not change the question", () => {
    expect(normalizePrompt("  Best CRM   for small AGENCIES?? ")).toBe("best crm for small agencies");
    expect(normalizePrompt("Meilleur café à Montréal ?")).toBe("meilleur cafe a montreal");
    expect(answerCacheKey("Best CRM for agencies?", REQ, NOW)).toBe(answerCacheKey("best crm for agencies", REQ, NOW));
  });

  it("separates everything that shapes the answer", () => {
    const base = answerCacheKey("q", REQ, NOW);
    const variants = [
      answerCacheKey("q", { ...REQ, engine: "GEMINI" }, NOW),
      answerCacheKey("q", { ...REQ, model: "gpt-5-mini" }, NOW),
      answerCacheKey("q", { ...REQ, profile: "p2" }, NOW),
      answerCacheKey("q", { ...REQ, location: "2124:fr" }, NOW),
      answerCacheKey("q", { ...REQ, repetition: 2 }, NOW),
      answerCacheKey("q", REQ, new Date("2026-11-07T00:00:01Z")),
    ];
    for (const v of variants) expect(v).not.toBe(base);
  });

  it("carries the day and a hash, nothing about who asked", () => {
    expect(answerCacheKey("best plumber in Leeds", REQ, NOW)).toMatch(/^echorank:answer-cache:v1:2026-11-06:[0-9a-f]{40}$/);
  });

  it("gives the tracker's repetitions separate keys and the same key across tenants", () => {
    const a = trackerAnswerRequest("CLAUDE", "claude-haiku-5-5", 1, NOENV);
    const b = trackerAnswerRequest("CLAUDE", "claude-haiku-5-5", 1, NOENV);
    expect(answerCacheKey("q", a, NOW)).toBe(answerCacheKey("q", b, NOW));
    expect(answerCacheKey("q", trackerAnswerRequest("CLAUDE", "claude-haiku-5-5", 2, NOENV), NOW)).not.toBe(
      answerCacheKey("q", a, NOW),
    );
    // AI Overviews searches a location; it is part of the key.
    expect(trackerAnswerRequest("GOOGLE_AI_OVERVIEWS", "serp", 1, NOENV).location).toBe("2840:en");
  });
});

describe("brand-specific prompts", () => {
  const terms = { names: ["Acme Plumbing", "Acmé", "Pipeworks Ltd"], domains: ["https://www.acmeplumbing.co.uk/"] };

  it("are the ones naming the brand, an alias, a competitor or the domain", () => {
    expect(isBrandSpecific("Is Acme Plumbing any good?", terms)).toBe(true);
    expect(isBrandSpecific("Reviews of ACME's service", terms)).toBe(true); // alias, accent and case folded
    expect(isBrandSpecific("Pipeworks Ltd vs others", terms)).toBe(true);
    expect(isBrandSpecific("what does acmeplumbing.co.uk offer", terms)).toBe(true);
    expect(isBrandSpecific("is acmeplumbing reliable", terms)).toBe(true);
  });

  it("leave generic questions shareable", () => {
    expect(isBrandSpecific("best emergency plumber in Leeds", terms)).toBe(false);
    expect(isBrandSpecific("how much does a plumber cost", terms)).toBe(false);
  });

  it("splits the free check's ten prompts into eight shared and two direct", () => {
    const prompts = buildPrompts({ brand: "Acme Plumbing", domain: "acmeplumbing.co.uk", category: "emergency plumber", location: "Leeds" });
    const specific = prompts.filter((p) => isBrandSpecific(p.text, { names: ["Acme Plumbing"], domains: ["acmeplumbing.co.uk"] }));
    expect(prompts).toHaveLength(10);
    expect(specific).toHaveLength(2);
  });
});

describe("withSharedAnswer", () => {
  const toShared = (v: { text: string }) => (v.text ? { answer: v.text, sources: [], model: "gpt-5" } : null);

  it("asks once, then serves the day's answer without calling the engine", async () => {
    const { store, sets } = memoryStore();
    const ask = vi.fn(async () => ({ text: "Try Acme or Globex.", tenantId: "t_secret" }));

    const first = await withSharedAnswer({ promptText: "best plumber", request: REQ, brandSpecific: false, now: NOW, store }, ask, toShared);
    const second = await withSharedAnswer({ promptText: "Best plumber?", request: REQ, brandSpecific: false, now: NOW, store }, ask, toShared);

    expect(first.hit).toBe(false);
    expect(second.hit).toBe(true);
    expect(second.shared?.answer).toBe("Try Acme or Globex.");
    expect(ask).toHaveBeenCalledTimes(1);
    // Stored once, NX, until past the end of the UTC day; no tenant in it.
    expect(sets).toHaveLength(1);
    expect(sets[0].seconds).toBe(14 * 3600 + 3600);
    expect(Object.keys(JSON.parse(sets[0].value)).sort()).toEqual(["answer", "model", "sources"]);
    expect(sets[0].value).not.toContain("t_secret");
    expect(store.set).toHaveBeenCalledWith(expect.any(String), expect.any(String), "EX", expect.any(Number), "NX");
  });

  it("never reads or writes the cache for a brand-specific prompt", async () => {
    const { store } = memoryStore();
    const ask = vi.fn(async () => ({ text: "answer" }));
    await withSharedAnswer({ promptText: "is Acme good", request: REQ, brandSpecific: true, now: NOW, store }, ask, toShared);
    await withSharedAnswer({ promptText: "is Acme good", request: REQ, brandSpecific: true, now: NOW, store }, ask, toShared);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(store.get).not.toHaveBeenCalled();
    expect(store.set).not.toHaveBeenCalled();
  });

  it("does not share an empty answer", async () => {
    const { store } = memoryStore();
    await withSharedAnswer({ promptText: "q", request: REQ, brandSpecific: false, now: NOW, store }, async () => ({ text: "" }), toShared);
    expect(store.set).not.toHaveBeenCalled();
  });

  it("fails open when Redis does", async () => {
    const store: AnswerCacheStore = {
      get: vi.fn(async () => {
        throw new Error("redis down");
      }),
      set: vi.fn(async () => {
        throw new Error("redis down");
      }),
    };
    const out = await withSharedAnswer({ promptText: "q", request: REQ, brandSpecific: false, now: NOW, store }, async () => ({ text: "a" }), toShared);
    expect(out).toMatchObject({ hit: false, value: { text: "a" } });
  });

  it("counts hits, misses and skips per UTC day, and nothing else", async () => {
    const { store, data } = memoryStore();
    const ask = async () => ({ text: "a" });
    await withSharedAnswer({ promptText: "q", request: REQ, brandSpecific: false, now: NOW, store }, ask, toShared);
    await withSharedAnswer({ promptText: "q", request: REQ, brandSpecific: false, now: NOW, store }, ask, toShared);
    await withSharedAnswer({ promptText: "Acme?", request: REQ, brandSpecific: true, now: NOW, store }, ask, toShared);
    expect(data.get(statsKey("2026-11-06", "miss"))).toBe("1");
    expect(data.get(statsKey("2026-11-06", "hit"))).toBe("1");
    expect(data.get(statsKey("2026-11-06", "skip"))).toBe("1");
  });
});

describe("the free check through the cache", () => {
  it("serves a visitor's generic prompts from an earlier check that day, at no cost", async () => {
    const { askSharedSnapshot } = await import("@/lib/snapshot/job");
    const { store } = memoryStore();
    // askSharedSnapshot uses the default store; point the Redis connection at
    // the in-memory one.
    const cfg = { engine: "openai" as const, model: "gpt-4.1-mini", apiKey: "k" };
    const ask = vi.fn(async () => ({
      text: "Leeds Pipes and Acme are both good.",
      sourceUrls: ["https://yell.com/x"],
      usage: { inputTokens: 100, outputTokens: 100 },
      model: "gpt-4.1-mini",
    }));
    const redis = await import("@/infrastructure/redis/connection");
    vi.spyOn(redis, "getRedisConnection").mockReturnValue(store as never);

    const first = await askSharedSnapshot(cfg, "best emergency plumber in Leeds", { brand: "Acme", domain: "acme.com" }, ask);
    const second = await askSharedSnapshot(cfg, "best emergency plumber in Leeds", { brand: "Other Co", domain: "other.com" }, ask);
    expect(first.shared).toBeUndefined();
    expect(second).toMatchObject({ shared: true, sourceUrls: ["https://yell.com/x"], usage: { inputTokens: 0, outputTokens: 0 } });
    expect(ask).toHaveBeenCalledTimes(1);

    // A direct prompt naming the brand is asked fresh.
    await askSharedSnapshot(cfg, "What do you know about Acme?", { brand: "Acme", domain: "acme.com" }, ask);
    await askSharedSnapshot(cfg, "What do you know about Acme?", { brand: "Acme", domain: "acme.com" }, ask);
    expect(ask).toHaveBeenCalledTimes(3);
  });

  it("charges a shared answer nothing against the run's cap", async () => {
    const prompts = buildPrompts({ brand: "Acme Plumbing", domain: "acmeplumbing.co.uk", category: "emergency plumber", location: "Leeds" });
    const deps: RunDeps = {
      engines: [{ engine: "openai", model: "gpt-4.1-mini", apiKey: "k" }],
      capUsd: 1,
      ask: vi.fn(async () => ({
        text: "Pipeworks Ltd.",
        sourceUrls: [],
        usage: { inputTokens: 0, outputTokens: 0 },
        model: "gpt-4.1-mini",
        shared: true,
      })),
      askJson: vi.fn(async () => ({ value: { answers: [], domains: [] }, usage: { inputTokens: 0, outputTokens: 0 } })),
      cost: (_e, _m, _u, searched) => (searched ? 0.01 : 0),
      estimate: (_e, _m, searched) => (searched ? 0.01 : 0),
      loadAnswers: async () => [],
      saveAnswer: async () => undefined,
      saveAnalysis: async () => undefined,
      now: () => NOW,
    };
    const r = await runSnapshot(
      { id: "s", brand: "Acme Plumbing", domain: "acmeplumbing.co.uk", category: "emergency plumber", location: "Leeds", prompts },
      deps,
    );
    expect(r.costUsd).toBe(0);
  });
});
