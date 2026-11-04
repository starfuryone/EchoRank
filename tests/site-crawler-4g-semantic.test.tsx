// @vitest-environment jsdom
//
// tests/site-crawler-4g-semantic.test.tsx — Phase 4g semantic duplicates:
// the 1 KB Float32 bytea, the cosine / centroid analysis over typed arrays,
// the OpenAI embeddings call (the tenant's key in a header, 256 dims, no
// error body kept), the config checks and estimate, the start-card section in
// every dashboard locale, the public line and row.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { EMBEDDING_DIMS, EmbeddingError, analyse, embedBatch, embeddingEstimate, fromBytes, toBytes } from "@/lib/site-crawler/semantic";
import { CrawlConfigInputSchema, checkCrawlConfig } from "@/lib/site-crawler/crawl-config";
import { needsMetrics } from "@/lib/site-crawler/metrics-runner";
import { SITE_CRAWLER_COPY } from "@/lib/i18n/dashboard";
import { SemanticSection, semanticConfirmLine, semanticEstimate, semanticStatusText } from "@/components/seo-tools/site-crawler-semantic";
import { problemText } from "@/components/seo-tools/site-crawler-config";
import { FLAGS } from "@/lib/flags";
import { PLAN_CONFIGS } from "@/lib/plan-config";
import { CRAWL_CAPABILITIES, CRAWL_FEATURE_ROWS, capabilityBody, featureCells, visibleCapabilities } from "@/lib/site-crawler/marketing-copy";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const int = new Intl.NumberFormat("en-US");

/** A unit vector along axis a, nudged by e along axis b. */
const vec = (a: number, b = (a + 1) % EMBEDDING_DIMS, e = 0) => {
  const v = new Float32Array(EMBEDDING_DIMS);
  v[a] = 1;
  v[b] += e;
  return v;
};
const flat = (vs: Float32Array[]) => {
  const out = new Float32Array(vs.length * EMBEDDING_DIMS);
  vs.forEach((v, i) => out.set(v, i * EMBEDDING_DIMS));
  return out;
};

describe("storage", () => {
  it("round-trips a vector through the 1 KB bytea", () => {
    const v = Float32Array.from({ length: EMBEDDING_DIMS }, (_, i) => Math.sin(i) / 3);
    const b = toBytes(v);
    expect(b.length).toBe(1024);
    expect(Array.from(fromBytes(b)!)).toEqual(Array.from(v));
    expect(fromBytes(new Uint8Array(0))).toBeNull();
  });
});

describe("analyse", () => {
  it("pairs near-identical pages (cosine ≥ 0.95) and finds the off-topic 5 %", () => {
    // 20 pages on topic 0 with small spreads, one exact pair, one far away.
    const vs = [vec(0, 1, 0.01), vec(0, 1, 0.012), ...Array.from({ length: 17 }, (_, i) => vec(0, 2 + i, 0.5)), vec(200)];
    const out = analyse(flat(vs), vs.length);
    expect(out[0]).toMatchObject({ nearest: 1 });
    expect(out[0]!.nearestScore).toBeGreaterThanOrEqual(0.95);
    expect(out.filter((o) => o.offTopic).map((_, i, a) => a.length)).toEqual([1]);
    expect(out[vs.length - 1]!.offTopic).toBe(true);
  });
  it("flags nothing off-topic under 20 pages", () => {
    const out = analyse(flat([vec(0), vec(1), vec(200)]), 3);
    expect(out.some((o) => o.offTopic)).toBe(false);
  });
  it("compares 1,000 pages pairwise in well under a second or two", () => {
    const n = 1_000;
    const vs = Float32Array.from({ length: n * EMBEDDING_DIMS }, (_, i) => Math.sin(i * 0.37));
    const t = performance.now();
    expect(analyse(vs, n)).toHaveLength(n);
    expect(performance.now() - t).toBeLessThan(3_000);
  });
});

describe("embedBatch", () => {
  const KEY = "sk-tenant-" + "e".repeat(30);
  it("POSTs 256-dim text-embedding-3-small with the key in a header, and reads usage", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const f = vi.fn(async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ data: [{ index: 1, embedding: Array(256).fill(0.1) }, { index: 0, embedding: Array(256).fill(0.2) }], usage: { total_tokens: 3000 } }), { status: 200 });
    });
    const r = await embedBatch(KEY, ["a", "b".repeat(9000)], f as never);
    expect(seen!.url).toBe("https://api.openai.com/v1/embeddings");
    expect(seen!.url).not.toContain(KEY);
    expect((seen!.init.headers as Record<string, string>).authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(seen!.init.body as string);
    expect(body).toMatchObject({ model: "text-embedding-3-small", dimensions: 256 });
    expect(body.input[1]).toHaveLength(6000);
    expect(r.tokens).toBe(3000);
    expect(r.vectors[0]![0]).toBeCloseTo(0.2);
  });
  it("keeps no error body (it can echo the input)", async () => {
    const f = vi.fn(async () => new Response(`{"error":"bad key ${KEY}"}`, { status: 401 }));
    const err = await embedBatch(KEY, ["x"], f as never).catch((e: Error) => e);
    expect(err).toBeInstanceOf(EmbeddingError);
    expect(String(err)).not.toContain(KEY);
  });
});

describe("config and estimate", () => {
  const check = (semantic: unknown, ctx: Record<string, unknown> = {}) =>
    checkCrawlConfig(CrawlConfigInputSchema.parse({ semantic }), { urlCap: 100, verified: false, semanticCap: 500, aiKeys: { openai: true, gemini: false }, ...ctx }).problems.map((p) => `${p.field}:${p.code}`);
  it.each([
    ["within the cap, key saved", { pages: 500, segment: null }, {}, []],
    ["over the cap", { pages: 501, segment: null }, {}, ["semantic:over_plan_cap"]],
    ["no OpenAI key", { pages: 10, segment: null }, { aiKeys: { openai: false, gemini: true } }, ["semantic:ai_key_missing"]],
  ] as const)("%s", (_n, semantic, ctx, codes) => expect(check(semantic, ctx)).toEqual(codes));
  it("estimates N × 1,500 tokens at $0.02 / M; queues the metrics job", () => {
    expect(embeddingEstimate(2000)).toEqual({ tokens: 3_000_000, usd: 0.06 });
    expect(semanticEstimate(2000)).toEqual(embeddingEstimate(2000));
    expect(needsMetrics({ semantic: { pages: 5, segment: null } })).toBe(true);
  });
});

describe("start card", () => {
  it.each(["en", "fr", "de-CH"] as const)("%s: needs the tenant's key; estimate and confirm line", async (l) => {
    const t = SITE_CRAWLER_COPY[l];
    const el = document.createElement("div");
    const root = createRoot(el);
    await act(async () => root.render(<SemanticSection t={t.p4g} t4d={t.p4d} cap={2000} hasKey={false} value={null} segments={[]} int={int} disabled={false} onChange={() => {}} />));
    expect(el.textContent).toContain(t.p4g.semNeedsKey);
    expect((el.querySelector("input[type=checkbox]") as HTMLInputElement).disabled).toBe(true);
    await act(async () => root.render(<SemanticSection t={t.p4g} t4d={t.p4d} cap={2000} hasKey value={{ pages: 2000, segment: null }} segments={["Blog"]} int={int} disabled={false} onChange={() => {}} />));
    expect(el.textContent).toContain(t.p4g.semOwnKey);
    expect(el.textContent).toContain(t.p4g.semEstimate("3,000,000", "$0.06"));
    expect(semanticConfirmLine(t.p4g, { pages: 2000, segment: null }, int)).toBe(t.p4g.confirmSem("2,000", "$0.06"));
    expect(problemText({ field: "semantic", code: "ai_key_missing", provider: "openai" }, t.p4a, t.p4b, t.p4d, t.p4e, t.p4g)).toBe(t.p4g.problemSemKey);
    if (l === "de-CH") expect(JSON.stringify(t.p4g)).not.toContain("ß");
    root.unmount();
  });
  it("status lines", () => {
    const t = SITE_CRAWLER_COPY.en.p4g;
    expect(semanticStatusText({ status: "done", embedded: 48, targets: 50 }, t, int)).toBe(t.semStatusDone("48", "50"));
    expect(semanticStatusText({ status: "stopped", stoppedReason: "key_missing" }, t, int)).toBe(t.semStatusKey);
    expect(semanticStatusText(undefined, t, int)).toBeNull();
  });
});

describe("public line and row", () => {
  it("renders behind crawl.semantic with the given wording; cells from plan-config", () => {
    expect(FLAGS["crawl.semantic"]).toBe(true);
    const card = CRAWL_CAPABILITIES.find((c) => c.id === "semantic-duplicates")!;
    expect(card.title.en).toBe("Semantic duplicates");
    expect(capabilityBody(card, "en")).toBe("Pages that say the same thing in different words, and pages that don't belong on the site.");
    expect(capabilityBody(card, "fr")).toMatch(/^Les pages qui disent la même chose/);
    expect(visibleCapabilities({ families: new Set(), flags: FLAGS }).map((c) => c.id)).toContain("semantic-duplicates");
    expect(visibleCapabilities({ families: new Set(), flags: { ...FLAGS, "crawl.semantic": false } }).map((c) => c.id)).not.toContain("semantic-duplicates");
    const plans = { STARTER: PLAN_CONFIGS.STARTER, GROWTH: PLAN_CONFIGS.GROWTH, AGENCY: PLAN_CONFIGS.AGENCY };
    expect(Object.values(featureCells(CRAWL_FEATURE_ROWS.find((r) => r.id === "semantic-duplicates")!, plans, "en"))).toEqual(["500 pages per crawl", "2,000 pages per crawl", "5,000 pages per crawl"]);
  });
});
