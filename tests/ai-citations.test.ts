// AI Citations — the DataForSEO LLM Mentions tool.
//
// ── THIS SUITE IS WHY THE FEATURE CAN SHIP UNVERIFIED ──────────────────────
// Nobody has confirmed the DataForSEO account carries the AI Optimization
// product, so no live call has ever been made. What CAN be established without
// one is that our half is right: the derivations, the scope filter, the order
// of the gates, and the fact that a disabled account cannot reach the API at
// all. The fixtures below are shaped from the response contract transcribed in
// dataforseo/endpoints.ts.
//
// The four properties most worth pinning, each of which is silently wrong in
// an obvious implementation:
//
//   1. THE SCOPE FILTER RUNS BEFORE THE PER-PLATFORM CAP. Capping first
//      returns an empty table for a subfolder that has plenty of cited pages.
//   2. NULL IS NOT ZERO, through addition and through share arithmetic.
//   3. THE CACHE IS CHECKED BEFORE THE ALLOWANCE, so an exhausted workspace
//      can still reopen what it bought.
//   4. THE FLAG CLOSES EVERY SPENDING PATH — checked before the plan gate,
//      before the cache, before anything.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const aiCitationsAnalysis = { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() };
const seoApiCall = {
  count: vi.fn(async () => 0),
  aggregate: vi.fn(async () => ({ _sum: { costUsd: 0 } })),
  create: vi.fn(),
};
const researchLog = { create: vi.fn(async () => ({ id: "log_1" })) };
vi.mock("@/lib/prisma", () => ({
  prisma: { aiCitationsAnalysis, seoApiCall, researchLog },
}));

const seoMeteredCallResult = vi.fn();
vi.mock("@/lib/dataforseo/metering", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dataforseo/metering")>()),
  seoMeteredCallResult: (...args: unknown[]) => seoMeteredCallResult(...args),
}));

const {
  runAiCitationsLookup,
  AiCitationsNotEnabledError,
  AiCitationsPlanLockedError,
  AiCitationsFailedError,
  planCanUseAiCitations,
} = await import("@/lib/ai-citations/service");
const { deriveCitedSources } = await import("@/lib/ai-citations/cited-sources");
const { computeShareOfVoice, resolveCompetitorGroups, sumNullable } = await import(
  "@/lib/ai-citations/share-of-voice"
);
const { safeHttpUrl, safeHostname } = await import("@/lib/ai-citations/url");
const { parseCitationTarget, urlMatchesTarget, InvalidCitationTargetError } = await import(
  "@/lib/ai-citations/target"
);
const { cacheKeyFor, aiCitationsEnabled } = await import("@/lib/ai-citations/options");
const { pathToFeature } = await import("@/lib/dataforseo/client");
const { SEO_SEARCH_FEATURES } = await import("@/lib/seo-quota");
const { AI_CITATIONS_COPY } = await import("@/lib/i18n/dashboard");

// ─── Fixtures ────────────────────────────────────────────────────────────────
// Shaped from the response contract in dataforseo/endpoints.ts, which is
// transcribed from the reference's live-verified schemas.

function topPagesEnvelope(pages: { url: string; mentions: number; volume: number }[]) {
  return [
    {
      items: pages.map((page) => ({
        key: page.url,
        platform: [
          { type: "group", key: "google", mentions: page.mentions, ai_search_volume: page.volume },
        ],
      })),
    },
  ];
}

function mentionsEnvelope(
  rows: { question: string; volume: number | null; sources: string[] }[],
) {
  return [
    {
      items: rows.map((row) => ({
        question: row.question,
        ai_search_volume: row.volume,
        sources: row.sources.map((url) => ({ url, domain: "x", title: "t" })),
      })),
    },
  ];
}

const TENANT = "tenant_a";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.AI_CITATIONS_VERIFIED;
  aiCitationsAnalysis.findFirst.mockResolvedValue(null);
  aiCitationsAnalysis.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: "aic_1",
      createdAt: new Date("2026-09-05T12:00:00Z"),
      ...data,
    }),
  );
  seoApiCall.count.mockResolvedValue(0);
});

afterEach(() => {
  delete process.env.AI_CITATIONS_VERIFIED;
});

// ─── 1. The flag ─────────────────────────────────────────────────────────────

describe("the verification flag closes every spending path", () => {
  it("is off unless explicitly set", () => {
    expect(aiCitationsEnabled()).toBe(false);
    process.env.AI_CITATIONS_VERIFIED = "0";
    expect(aiCitationsEnabled()).toBe(false);
    process.env.AI_CITATIONS_VERIFIED = "1";
    expect(aiCitationsEnabled()).toBe(true);
    process.env.AI_CITATIONS_VERIFIED = "true";
    expect(aiCitationsEnabled()).toBe(true);
  });

  it("refuses a lookup before touching the plan, the cache or the provider", async () => {
    await expect(
      runAiCitationsLookup(TENANT, "AGENCY", {
        target: parseCitationTarget("example.com"),
        platforms: ["google"],
        competitors: [],
      }),
    ).rejects.toBeInstanceOf(AiCitationsNotEnabledError);

    // Checked FIRST. Nothing else ran.
    expect(aiCitationsAnalysis.findFirst).not.toHaveBeenCalled();
    expect(seoApiCall.count).not.toHaveBeenCalled();
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });
});

// ─── 2. Gate order ───────────────────────────────────────────────────────────

describe("gate order", () => {
  beforeEach(() => {
    process.env.AI_CITATIONS_VERIFIED = "1";
  });

  it("locks STARTER out before spending anything", async () => {
    expect(planCanUseAiCitations("STARTER")).toBe(false);
    expect(planCanUseAiCitations("GROWTH")).toBe(true);
    await expect(
      runAiCitationsLookup(TENANT, "STARTER", {
        target: parseCitationTarget("example.com"),
        platforms: ["google"],
        competitors: [],
      }),
    ).rejects.toBeInstanceOf(AiCitationsPlanLockedError);
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("serves a cache hit WITHOUT consulting the allowance", async () => {
    // The property that matters on an exhausted workspace: a stored result
    // costs nothing, so it must be reachable after the allowance is gone.
    seoApiCall.count.mockResolvedValue(999_999);
    aiCitationsAnalysis.findFirst.mockResolvedValue({
      id: "aic_cached",
      target: "example.com",
      scope: "subdomains",
      platforms: ["google"],
      competitors: [],
      status: "completed",
      costUsd: 0.05,
      totals: [],
      sources: [],
      shareOfVoice: null,
      failedPlatforms: [],
      createdAt: new Date("2026-09-05T01:00:00Z"),
    });

    const { analysis, cached } = await runAiCitationsLookup(TENANT, "AGENCY", {
      target: parseCitationTarget("example.com"),
      platforms: ["google"],
      competitors: [],
    });

    expect(cached).toBe(true);
    expect(analysis.id).toBe("aic_cached");
    expect(analysis.reRunAvailableInMs).toBeGreaterThan(0);
    // Neither the allowance count nor the provider was touched.
    expect(seoApiCall.count).not.toHaveBeenCalled();
    expect(seoMeteredCallResult).not.toHaveBeenCalled();
  });

  it("counts ONE search for a lookup that fans out to many calls", async () => {
    seoMeteredCallResult.mockResolvedValue({
      data: [{ items: [] }],
      billing: { path: ["v3", "ai_optimization", "llm_mentions", "top_pages", "live"], costUsd: 0.02 },
    });

    await runAiCitationsLookup(TENANT, "AGENCY", {
      target: parseCitationTarget("example.com"),
      platforms: ["chat_gpt", "google"],
      competitors: [],
    });

    // Three calls per platform, six in all — but the pooled allowance is read
    // once, before the fan-out. One user action, one search.
    expect(seoMeteredCallResult).toHaveBeenCalledTimes(6);
    expect(seoApiCall.count).toHaveBeenCalledTimes(1);
  });

  it("pins ChatGPT to US/en regardless of the requested market", async () => {
    seoMeteredCallResult.mockResolvedValue({
      data: [{ items: [] }],
      billing: { path: ["v3", "ai_optimization", "llm_mentions", "top_pages", "live"], costUsd: 0 },
    });

    await runAiCitationsLookup(TENANT, "AGENCY", {
      target: parseCitationTarget("example.com"),
      platforms: ["chat_gpt", "google"],
      competitors: [],
      locationCode: 2124,
      languageCode: "fr",
    });

    const tasks = seoMeteredCallResult.mock.calls.map(
      (call) => call[2] as { platform: string; location_code: number; language_code: string },
    );
    for (const task of tasks) {
      if (task.platform === "chat_gpt") {
        // A provider restriction: a chat_gpt call for another market returns
        // nothing HAVING BEEN BILLED.
        expect(task.location_code).toBe(2840);
        expect(task.language_code).toBe("en");
      } else {
        expect(task.location_code).toBe(2124);
        expect(task.language_code).toBe("fr");
      }
    }
  });

  it("keeps a platform that answered when the other fails, and throws only if all fail", async () => {
    seoMeteredCallResult.mockImplementation(
      async (_tenant: string, path: string, task: { platform: string }) => {
        if (task.platform === "chat_gpt") throw new Error("provider 502");
        return {
          data: topPagesEnvelope([{ url: "https://example.com/a", mentions: 4, volume: 90 }]),
          billing: { path: path.split("/"), costUsd: 0.01 },
        };
      },
    );

    const { analysis } = await runAiCitationsLookup(TENANT, "AGENCY", {
      target: parseCitationTarget("example.com"),
      platforms: ["chat_gpt", "google"],
      competitors: [],
    });
    expect(analysis.status).toBe("partial");
    expect(analysis.failedPlatforms).toEqual(["chat_gpt"]);

    seoMeteredCallResult.mockRejectedValue(new Error("provider 502"));
    await expect(
      runAiCitationsLookup(TENANT, "AGENCY", {
        target: parseCitationTarget("example.com"),
        platforms: ["chat_gpt", "google"],
        competitors: [],
      }),
    ).rejects.toBeInstanceOf(AiCitationsFailedError);
  });

  it("writes a research-log entry on success", async () => {
    seoMeteredCallResult.mockResolvedValue({
      data: [{ items: [] }],
      billing: { path: ["v3", "ai_optimization", "llm_mentions", "top_pages", "live"], costUsd: 0.03 },
    });
    await runAiCitationsLookup(TENANT, "AGENCY", {
      target: parseCitationTarget("example.com/blog", "subfolder"),
      platforms: ["google"],
      competitors: [],
    });
    expect(researchLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: TENANT,
          feature: "ai_citations",
          target: "example.com/blog",
          sourceRef: "aic_1",
        }),
      }),
    );
  });
});

// ─── 3. Metering classification ──────────────────────────────────────────────

describe("metering", () => {
  it("classifies every llm_mentions path as ai_citations", () => {
    for (const endpoint of ["search", "aggregated_metrics", "top_pages", "cross_aggregated_metrics"]) {
      expect(
        pathToFeature(["v3", "ai_optimization", "llm_mentions", endpoint, "live"]),
      ).toBe("ai_citations");
    }
  });

  it("is inside the pooled search allowance", () => {
    // The implemented default. Flagged for review — see the notes on
    // `ai_citations` in dataforseo/client.ts and seo-quota.ts.
    expect(SEO_SEARCH_FEATURES).toContain("ai_citations");
  });
});

// ─── 4. Cited sources ────────────────────────────────────────────────────────

describe("cited sources", () => {
  it("takes its ROWS and METRICS from top_pages, and only prompts from the sample", () => {
    const rows = deriveCitedSources(
      [
        {
          platform: "google",
          topPages: topPagesEnvelope([
            { url: "https://example.com/a", mentions: 12, volume: 400 },
          ])[0].items,
          mentions: mentionsEnvelope([
            { question: "best widget", volume: 90, sources: ["https://example.com/a"] },
            { question: "cheap widget", volume: 30, sources: ["https://example.com/a"] },
            // A sampled source that top_pages did not rank must NOT become a row.
            { question: "other", volume: 10, sources: ["https://elsewhere.example/z"] },
          ])[0].items,
        },
      ],
      { sourcesPerPlatform: 25, promptsPerSource: 5 },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].url).toBe("https://example.com/a");
    // The population figure, not a count of the sample.
    expect(rows[0].mentions).toBe(12);
    // Prompts sorted by volume, highest first.
    expect(rows[0].prompts.map((p) => p.question)).toEqual(["best widget", "cheap widget"]);
  });

  it("drops a javascript: URL rather than rendering it as a link", () => {
    const rows = deriveCitedSources(
      [
        {
          platform: "google",
          topPages: [
            { key: "javascript:alert(1)", platform: [{ key: "google", mentions: 99 }] },
            { key: "https://ok.example/", platform: [{ key: "google", mentions: 1 }] },
          ],
          mentions: [],
        },
      ],
      { sourcesPerPlatform: 25, promptsPerSource: 5 },
    );
    expect(rows.map((r) => r.url)).toEqual(["https://ok.example/"]);
  });

  it("FILTERS BY SCOPE BEFORE CAPPING — the edge case this whole design is for", () => {
    // Nine homepage-ish pages outrank the two blog pages. With a cap of 2 and
    // the filter applied AFTER, both blog pages are discarded and a subfolder
    // lookup that has real data returns nothing.
    const pages = [
      ...Array.from({ length: 9 }, (_, i) => ({
        url: `https://example.com/p${i}`,
        mentions: 100 - i,
        volume: 1000 - i,
      })),
      { url: "https://example.com/blog/one", mentions: 5, volume: 50 },
      { url: "https://example.com/blog/two", mentions: 4, volume: 40 },
    ];

    const target = parseCitationTarget("example.com/blog", "subfolder");
    const rows = deriveCitedSources(
      [{ platform: "google", topPages: topPagesEnvelope(pages)[0].items, mentions: [] }],
      { sourcesPerPlatform: 2, promptsPerSource: 5 },
      target,
    );

    expect(rows.map((r) => r.url)).toEqual([
      "https://example.com/blog/one",
      "https://example.com/blog/two",
    ]);
  });

  it("caps PER PLATFORM so a loud platform cannot crowd out a quiet one", () => {
    const rows = deriveCitedSources(
      [
        {
          platform: "google",
          topPages: topPagesEnvelope(
            Array.from({ length: 5 }, (_, i) => ({
              url: `https://example.com/g${i}`,
              mentions: 500,
              volume: 9000,
            })),
          )[0].items,
          mentions: [],
        },
        {
          platform: "chat_gpt",
          topPages: [
            { key: "https://example.com/c0", platform: [{ key: "chat_gpt", mentions: 1, ai_search_volume: 1 }] },
          ],
          mentions: [],
        },
      ],
      { sourcesPerPlatform: 2, promptsPerSource: 5 },
    );
    // Two Google rows, and the single ChatGPT row survives despite ranking
    // last overall.
    expect(rows.filter((r) => r.platform === "google")).toHaveLength(2);
    expect(rows.filter((r) => r.platform === "chat_gpt")).toHaveLength(1);
  });

  it("keeps a missing metric as null rather than 0", () => {
    const rows = deriveCitedSources(
      [
        {
          platform: "google",
          topPages: [{ key: "https://example.com/a", platform: [{ key: "google" }] }],
          mentions: [],
        },
      ],
      { sourcesPerPlatform: 5, promptsPerSource: 5 },
    );
    expect(rows[0].mentions).toBeNull();
    expect(rows[0].capturedVolume).toBeNull();
  });
});

// ─── 5. Share of voice ───────────────────────────────────────────────────────

describe("share of voice", () => {
  it("keeps null distinct from zero through addition", () => {
    expect(sumNullable([null, null])).toBeNull();
    expect(sumNullable([null, 3])).toBe(3);
    expect(sumNullable([0, null])).toBe(0);
    expect(sumNullable([2, 3])).toBe(5);
  });

  it("excludes a no-data brand from the denominator but keeps its row", () => {
    const sov = computeShareOfVoice(
      [
        {
          platform: "google",
          status: "success",
          items: [
            { key: "example.com", platform: [{ key: "google", mentions: 75 }] },
            { key: "Rival One", platform: [{ key: "google", mentions: 25 }] },
            // "Rival Two" returned nothing.
          ],
        },
      ],
      "example.com",
      ["Rival One", "Rival Two"],
    );

    expect(sov).not.toBeNull();
    const byLabel = new Map(sov!.entries.map((e) => [e.label, e]));
    expect(byLabel.get("example.com")!.sharePct).toBeCloseTo(75);
    expect(byLabel.get("Rival One")!.sharePct).toBeCloseTo(25);
    // Present as a row — the customer paid to compare it — but not counted.
    const missing = byLabel.get("Rival Two")!;
    expect(missing.mentions).toBeNull();
    expect(missing.sharePct).toBeNull();
    // And the two measured shares still sum to 100: the null did not dilute.
    expect(
      byLabel.get("example.com")!.sharePct! + byLabel.get("Rival One")!.sharePct!,
    ).toBeCloseTo(100);
  });

  it("counts a measured zero, and sorts it above a no-data row", () => {
    const sov = computeShareOfVoice(
      [
        {
          platform: "google",
          status: "success",
          items: [
            { key: "example.com", platform: [{ key: "google", mentions: 10 }] },
            { key: "Zero Co", platform: [{ key: "google", mentions: 0 }] },
          ],
        },
      ],
      "example.com",
      ["Zero Co", "Unknown Co"],
    );
    const labels = sov!.entries.map((e) => e.label);
    expect(labels).toEqual(["example.com", "Zero Co", "Unknown Co"]);
    expect(sov!.entries[1].sharePct).toBe(0);
    expect(sov!.entries[2].sharePct).toBeNull();
  });

  it("matches echoed keys case-insensitively so the target keeps its flag", () => {
    const sov = computeShareOfVoice(
      [
        {
          platform: "google",
          status: "success",
          items: [{ key: "EXAMPLE.COM", platform: [{ key: "google", mentions: 5 }] }],
        },
      ],
      "example.com",
      ["Rival"],
    );
    const target = sov!.entries.find((e) => e.isTarget);
    expect(target?.label).toBe("example.com");
    expect(target?.mentions).toBe(5);
  });

  it("ignores an unrequested key rather than letting it move a share", () => {
    const sov = computeShareOfVoice(
      [
        {
          platform: "google",
          status: "success",
          items: [
            { key: "example.com", platform: [{ key: "google", mentions: 50 }] },
            { key: "Rival", platform: [{ key: "google", mentions: 50 }] },
            { key: "NeverAskedFor", platform: [{ key: "google", mentions: 900 }] },
          ],
        },
      ],
      "example.com",
      ["Rival"],
    );
    expect(sov!.entries).toHaveLength(2);
    expect(sov!.entries[0].sharePct).toBeCloseTo(50);
  });

  it("returns null with no competitors, or when every call failed", () => {
    expect(computeShareOfVoice([], "example.com", [])).toBeNull();
    expect(
      computeShareOfVoice(
        [{ platform: "google", status: "error", items: [] }],
        "example.com",
        ["Rival"],
      ),
    ).toBeNull();
  });

  it("dedupes competitors case-insensitively and against the target", () => {
    expect(
      resolveCompetitorGroups("example.com", ["Nike", "nike", "  ", "Example.com", "Adidas"], 5),
    ).toEqual(["Nike", "Adidas"]);
    expect(resolveCompetitorGroups("x.com", ["a", "b", "c"], 2)).toEqual(["a", "b"]);
  });
});

// ─── 6. Target parsing and scope ─────────────────────────────────────────────

describe("target and scope", () => {
  it("defaults a bare domain to subdomains and a path to subfolder", () => {
    expect(parseCitationTarget("example.com").scope).toBe("subdomains");
    expect(parseCitationTarget("https://example.com/blog").scope).toBe("subfolder");
    expect(parseCitationTarget("https://www.Example.com/").hostname).toBe("example.com");
  });

  it("rejects what the provider would bill and then fail on", () => {
    // my_site.com passes URL() and fails at DataForSEO AFTER billing.
    expect(() => parseCitationTarget("my_site.com")).toThrow(InvalidCitationTargetError);
    expect(() => parseCitationTarget("ftp://example.com")).toThrow(InvalidCitationTargetError);
    expect(() => parseCitationTarget("https://u:p@example.com")).toThrow(
      InvalidCitationTargetError,
    );
    expect(() => parseCitationTarget("192.168.0.1")).toThrow(InvalidCitationTargetError);
    expect(() => parseCitationTarget("")).toThrow(InvalidCitationTargetError);
    expect(() => parseCitationTarget("example.com", "subfolder")).toThrow(
      InvalidCitationTargetError,
    );
  });

  it("matches a subfolder's children but not a similarly named sibling", () => {
    const target = parseCitationTarget("example.com/blog", "subfolder");
    expect(urlMatchesTarget("https://example.com/blog", target)).toBe(true);
    expect(urlMatchesTarget("https://example.com/blog/post", target)).toBe(true);
    // The mistake `startsWith(path)` would make.
    expect(urlMatchesTarget("https://example.com/blogging", target)).toBe(false);
    expect(urlMatchesTarget("https://other.example/blog", target)).toBe(false);
  });

  it("separates domain from subdomains", () => {
    const strict = parseCitationTarget("example.com", "domain");
    const wide = parseCitationTarget("example.com", "subdomains");
    expect(urlMatchesTarget("https://shop.example.com/x", strict)).toBe(false);
    expect(urlMatchesTarget("https://shop.example.com/x", wide)).toBe(true);
    expect(urlMatchesTarget("https://www.example.com/x", strict)).toBe(true);
  });

  it("sorts platforms into the cache key so a set order cannot split the cache", () => {
    const now = new Date("2026-09-05T23:59:00Z");
    expect(cacheKeyFor("subdomains:example.com", ["google", "chat_gpt"], now)).toBe(
      cacheKeyFor("subdomains:example.com", ["chat_gpt", "google"], now),
    );
    // A different platform SET is a different question, and a different key.
    expect(cacheKeyFor("subdomains:example.com", ["google"], now)).not.toBe(
      cacheKeyFor("subdomains:example.com", ["chat_gpt", "google"], now),
    );
    // And the bucket rolls at UTC midnight, not 24h after the last run.
    expect(cacheKeyFor("subdomains:example.com", ["google"], now)).not.toBe(
      cacheKeyFor("subdomains:example.com", ["google"], new Date("2026-09-06T00:01:00Z")),
    );
  });
});

// ─── 7. URL safety ───────────────────────────────────────────────────────────

describe("url safety", () => {
  it("allows only http(s) with no embedded credentials", () => {
    expect(safeHttpUrl("https://a.example/x")).toBe("https://a.example/x");
    expect(safeHttpUrl("http://a.example")).toBe("http://a.example");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>")).toBeNull();
    expect(safeHttpUrl("https://user:pass@a.example")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });

  it("strips www from the hostname and refuses unsafe schemes", () => {
    expect(safeHostname("https://www.a.example/x")).toBe("a.example");
    expect(safeHostname("javascript:alert(1)")).toBeNull();
  });
});

// ─── 8. Copy ─────────────────────────────────────────────────────────────────

describe("copy", () => {
  const LOCALES = ["en", "fr", "de-CH"] as const;

  it("covers every scope, platform and error state in all three catalogs", () => {
    for (const locale of LOCALES) {
      const t = AI_CITATIONS_COPY[locale];
      for (const scope of ["subdomains", "domain", "subfolder", "exact_url"]) {
        expect(t.scopes[scope]?.length, `${locale} scope ${scope}`).toBeGreaterThan(0);
      }
      for (const platform of ["chat_gpt", "google"]) {
        expect(t.platforms[platform]?.length, `${locale} platform ${platform}`).toBeGreaterThan(0);
      }
      expect(t.errorNotEnabled.length).toBeGreaterThan(0);
      expect(t.errorPlanLocked.length).toBeGreaterThan(0);
      expect(t.errorQuota.length).toBeGreaterThan(0);
      expect(t.costHint.length).toBeGreaterThan(0);
      // The sampling caveat is not decoration: the counts and the example
      // prompts come from different populations, and a reader who assumes the
      // prompts are exhaustive will misread the table.
      expect(t.samplingNote.length).toBeGreaterThan(0);
      expect(t.cachedNote(7)).toContain("7");
      expect(t.partialNote("ChatGPT")).toContain("ChatGPT");
    }
  });

  it("de-CH uses ss, never sz", () => {
    const t = AI_CITATIONS_COPY["de-CH"];
    const strings = [
      t.formIntro,
      t.costHint,
      t.samplingNote,
      t.errorNotEnabled,
      t.sourcesEmpty,
      t.chatGptMarketNote,
    ];
    for (const line of strings) expect(line).not.toContain("ß");
  });

  it("brands correctly", () => {
    for (const locale of LOCALES) {
      const t = AI_CITATIONS_COPY[locale];
      for (const line of [t.formIntro, t.errorNotEnabled, t.samplingNote]) {
        expect(line).not.toMatch(/EchoRank|echoRank|Echo Rank/);
      }
    }
  });
});
