// The purchase archive, Phase 2 (ECHORANK-DATA-ARCHIVE.md): reuse before
// re-buying. A hit inside the endpoint's TTL makes no provider call and is
// metered as the purchase it replaces at $0; outside the TTL it buys; the TTL
// is configurable per endpoint (LLM answers 0). Plus the admin report's merge.
// No real provider or Spaces call: fetch, S3 and the index are fakes.
import { gzipSync } from "node:zlib";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_TTL_DAYS, reuseDataforseo, ttlDaysFor, type ArchivedRow, type ReuseDeps } from "@/lib/purchase-archive/reuse";
import { mergeReport } from "@/lib/purchase-archive/report";
import { endpointSlug, requestHash } from "@/lib/purchase-archive/core";
import type { ObjectStore } from "@/lib/spaces/client";

const NOW = new Date("2026-11-09T12:00:00Z");
const DAY = 86_400_000;
const envelope = { tasks: [{ id: "T-old", status_code: 20000, cost: 0.02, path: ["v3", "backlinks", "summary", "live"], result: [{ rank: 42 }] }] };

function storeWith(objects: Record<string, unknown>): ObjectStore {
  return {
    async put() {},
    async get(key) {
      if (!(key in objects)) throw new Error("NoSuchKey");
      return Readable.from([gzipSync(Buffer.from(JSON.stringify(objects[key])))]);
    },
    async head() {
      return null;
    },
    async deleteKeys() {
      return 0;
    },
    async *list() {},
    async listPrefixes() {
      return [];
    },
    async presignGet() {
      throw new Error("never");
    },
  };
}

/** An index with one stored object `ageDays` old for this exact request. */
function deps(ageDays: number, over: Partial<ReuseDeps> = {}) {
  const hits: Array<{ row: ArchivedRow; tenantId: string | null; purpose: string }> = [];
  const finds: Array<{ since: Date }> = [];
  const row: ArchivedRow & { createdAt: Date; requestHash: string; endpoint: string } = {
    id: "pa1",
    s3Key: "v1/echorank/dataforseo/backlinks-summary-live/2026/11/01/h-1.json.gz",
    costUsd: 0.02,
    provider: "dataforseo",
    endpoint: endpointSlug("v3/backlinks/summary/live"),
    requestHash: requestHash({ target: "a.com", include_subdomains: true }),
    createdAt: new Date(NOW.getTime() - ageDays * DAY),
  };
  const d: ReuseDeps = {
    enabled: () => true,
    async find(q) {
      finds.push({ since: q.since });
      return q.provider === row.provider && q.endpoint === row.endpoint && q.requestHash === row.requestHash && row.createdAt >= q.since ? row : null;
    },
    store: async () => storeWith({ [row.s3Key]: { v: 1, response: envelope } }),
    recordHit: async (h) => {
      hits.push(h);
    },
    now: () => NOW,
    ...over,
  };
  return { d, hits, finds };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("freshness per endpoint", () => {
  it("defaults: SERP 1 day, Labs and Keywords Data 30, Backlinks 7, LLM answers 0", () => {
    expect(ttlDaysFor("dataforseo", "v3/serp/google/organic/live/advanced", {} as NodeJS.ProcessEnv)).toBe(1);
    expect(ttlDaysFor("dataforseo", "v3/dataforseo_labs/google/ranked_keywords/live", {} as NodeJS.ProcessEnv)).toBe(30);
    expect(ttlDaysFor("dataforseo", "v3/keywords_data/google_ads/search_volume/live", {} as NodeJS.ProcessEnv)).toBe(30);
    expect(ttlDaysFor("dataforseo", "v3/backlinks/summary/live", {} as NodeJS.ProcessEnv)).toBe(7);
    expect(ttlDaysFor("dataforseo", "v3/ai_optimization/llm_mentions/search/live", {} as NodeJS.ProcessEnv)).toBe(0);
    expect(ttlDaysFor("openai", "responses", {} as NodeJS.ProcessEnv)).toBe(0);
    // Anything the brief gives no number for is never reused.
    expect(ttlDaysFor("dataforseo", "v3/content_analysis/search/live", {} as NodeJS.ProcessEnv)).toBe(0);
    expect(DEFAULT_TTL_DAYS.dataforseo).toBeDefined();
  });

  it("is configurable per endpoint", () => {
    const env = { PURCHASE_ARCHIVE_TTL_DAYS_JSON: JSON.stringify({ dataforseo: { "backlinks-summary-": 2, "serp-": 0 } }) } as unknown as NodeJS.ProcessEnv;
    expect(ttlDaysFor("dataforseo", "v3/backlinks/summary/live", env)).toBe(2);
    expect(ttlDaysFor("dataforseo", "v3/backlinks/anchors/live", env)).toBe(7);
    expect(ttlDaysFor("dataforseo", "v3/serp/google/organic/live/advanced", env)).toBe(0);
    expect(ttlDaysFor("dataforseo", "v3/backlinks/summary/live", { PURCHASE_ARCHIVE_TTL_DAYS_JSON: "{not json" } as unknown as NodeJS.ProcessEnv)).toBe(7);
  });
});

describe("reuseDataforseo", () => {
  const task = { target: "a.com", include_subdomains: true };

  it("inside the TTL: the archived envelope, and the hit is recorded with what it saved", async () => {
    const { d, hits } = deps(3);
    const out = await reuseDataforseo("v3/backlinks/summary/live", task, { tenantId: "t1", purpose: "backlinks" }, d);
    expect(out?.envelope).toEqual(envelope);
    expect(hits).toEqual([{ row: expect.objectContaining({ id: "pa1", costUsd: 0.02 }), tenantId: "t1", purpose: "backlinks" }]);
  });

  it("outside the TTL: a miss", async () => {
    const { d, hits, finds } = deps(8);
    expect(await reuseDataforseo("v3/backlinks/summary/live", task, { tenantId: "t1", purpose: "backlinks" }, d)).toBeNull();
    expect(finds[0]!.since.getTime()).toBe(NOW.getTime() - 7 * DAY);
    expect(hits).toHaveLength(0);
  });

  it("a different request: a miss", async () => {
    const { d } = deps(1);
    expect(await reuseDataforseo("v3/backlinks/summary/live", { ...task, target: "b.com" }, { tenantId: null, purpose: "x" }, d)).toBeNull();
  });

  it("TTL 0, archive off, or a store failure: never reused, never thrown", async () => {
    const a = deps(0);
    expect(await reuseDataforseo("v3/ai_optimization/llm_mentions/search/live", task, { tenantId: null, purpose: "x" }, a.d)).toBeNull();
    expect(a.finds).toHaveLength(0);
    const b = deps(1, { enabled: () => false });
    expect(await reuseDataforseo("v3/backlinks/summary/live", task, { tenantId: null, purpose: "x" }, b.d)).toBeNull();
    const c = deps(1, { store: async () => storeWith({}) });
    expect(await reuseDataforseo("v3/backlinks/summary/live", task, { tenantId: null, purpose: "x" }, c.d)).toBeNull();
  });
});

describe("the metered call: a hit makes no provider call; a miss buys", () => {
  async function meteredWith(reused: unknown) {
    vi.doMock("@/lib/purchase-archive/reuse", () => ({ reuseDataforseo: async () => reused }));
    vi.doMock("@/lib/purchase-archive/dataforseo", () => ({ archiveDataforseoResponse: () => {} }));
    vi.stubEnv("DATAFORSEO_LOGIN", "l");
    vi.stubEnv("DATAFORSEO_PASSWORD", "p");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ tasks: [{ id: "T-new", status_code: 20000, cost: 0.02, path: ["v3", "backlinks", "summary", "live"], result: [{ rank: 7 }] }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const rows: Array<{ costUsd: number; ok: boolean; feature: string }> = [];
    const { meteredCallResult } = await import("@/lib/dataforseo/client");
    const result = await meteredCallResult(
      { tenantId: "t1", monthlyCapUsd: 25 },
      "v3/backlinks/summary/live",
      { target: "a.com" },
      { spentThisMonth: async () => 0, record: async (r) => void rows.push(r) },
    );
    return { result, rows, fetchMock };
  }

  it("hit: the archived data, no fetch, one metering row at $0 that counts like the purchase", async () => {
    const { result, rows, fetchMock } = await meteredWith({ envelope, row: { id: "pa1" } });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.data).toEqual([{ rank: 42 }]);
    expect(result.billing.costUsd).toBe(0);
    expect(rows).toEqual([expect.objectContaining({ costUsd: 0, ok: true, feature: "backlinks" })]);
  });

  it("miss: one purchase at its real cost", async () => {
    const { result, rows, fetchMock } = await meteredWith(null);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual([{ rank: 7 }]);
    expect(rows).toEqual([expect.objectContaining({ costUsd: 0.02, ok: true })]);
  });

  it("the USD cap is checked first, exactly as before", async () => {
    vi.doMock("@/lib/purchase-archive/reuse", () => ({ reuseDataforseo: async () => ({ envelope, row: { id: "pa1" } }) }));
    const { meteredCallResult } = await import("@/lib/dataforseo/client");
    await expect(
      meteredCallResult({ tenantId: "t1", monthlyCapUsd: 1 }, "v3/backlinks/summary/live", { target: "a.com" }, { spentThisMonth: async () => 5, record: async () => {} }),
    ).rejects.toThrow(/budget/);
  });
});

describe("admin report", () => {
  it("one row per day and provider, purchases beside hits and savings, newest first", () => {
    const rows = mergeReport(
      [
        { day: new Date("2026-11-08T00:00:00Z"), provider: "dataforseo", n: 10, usd: 0.2 },
        { day: new Date("2026-11-09T00:00:00Z"), provider: "dataforseo", n: 4, usd: 0.08 },
        { day: new Date("2026-11-09T00:00:00Z"), provider: "openai", n: 2, usd: 0.5 },
      ],
      [{ day: new Date("2026-11-09T00:00:00Z"), provider: "dataforseo", n: 3, usd: 0.06 }],
    );
    expect(rows).toEqual([
      { day: "2026-11-09", provider: "dataforseo", purchases: 4, purchasedUsd: 0.08, hits: 3, savedUsd: 0.06 },
      { day: "2026-11-09", provider: "openai", purchases: 2, purchasedUsd: 0.5, hits: 0, savedUsd: 0 },
      { day: "2026-11-08", provider: "dataforseo", purchases: 10, purchasedUsd: 0.2, hits: 0, savedUsd: 0 },
    ]);
  });
});
