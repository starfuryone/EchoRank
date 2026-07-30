// Content Explorer envelope parsing, driven by the RECORDED fixtures.
//
// These assert against the real envelopes in fixtures/dataforseo/, recorded live
// on 2026-07-30, so a provider shape change shows up here rather than as an empty
// table in production. No network, no spend.
//
// The fixture was recorded for "reputation management software" (1.57M matches,
// 50 items) precisely because a rich result set exercises the null-handling: in
// that sample `country` is null on 29/50 items and `content_info.date_published`
// on 20/50, and both of those would otherwise have been discovered by a customer.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  normalizeQuery,
  parseApiDate,
  parseMention,
  parseSearchResult,
  parseSentiment,
  parseSummaryResult,
  sentimentLabel,
} from "@/lib/content-explorer/parse";
import {
  COST_PER_SEARCH_USD,
  HIGH_AUTHORITY_RANK,
  MAX_SPAM_SCORE_FOR_BADGE,
  MENTIONS_LIMIT,
  contentSearchLimit,
  planCanSearchContent,
  worstCaseMonthlyUsd,
} from "@/lib/content-explorer/options";

function fixture(name: string): { tasks: Array<{ result: unknown; cost: number }> } {
  return JSON.parse(
    readFileSync(join(process.cwd(), "fixtures", "dataforseo", name), "utf8"),
  );
}

const SEARCH = fixture("v3-content_analysis-search-live.json");
const SUMMARY = fixture("v3-content_analysis-summary-live.json");

// ─── search/live ────────────────────────────────────────────────────────────
describe("parseSearchResult against the recorded envelope", () => {
  const parsed = parseSearchResult(SEARCH.tasks[0].result);

  it("reads the index-wide total and the page of items separately", () => {
    // total_count is matches across the whole index (millions); mentions is the
    // page we paid to retrieve. Conflating them would misreport reach by 5 orders
    // of magnitude.
    expect(parsed.totalCount).toBeGreaterThan(1_000_000);
    expect(parsed.mentions).toHaveLength(50);
    expect(parsed.mentions.length).toBeLessThanOrEqual(MENTIONS_LIMIT);
  });

  it("lifts the fields buried under content_info onto the mention", () => {
    const m = parsed.mentions[0];
    expect(m.url).toMatch(/^https?:\/\//);
    expect(m.domain.length).toBeGreaterThan(0);
    expect(typeof m.title).toBe("string");
    expect(typeof m.snippet).toBe("string");
    expect(typeof m.domainRank).toBe("number");
  });

  it("gives every mention a date, falling back to the crawl time", () => {
    // date_published is null on 20/50 items in this sample; a table sorted by
    // date needs something for every row.
    for (const m of parsed.mentions) {
      expect(m.date).not.toBeNull();
      expect(new Date(m.date!).toString()).not.toBe("Invalid Date");
    }
    const fallbacks = parsed.mentions.filter((m) => m.dateIsCrawl);
    expect(fallbacks.length).toBeGreaterThan(0);
  });

  it("keeps country null rather than inventing one", () => {
    // 29/50 null in this sample — the UI renders "Unknown", never a default.
    const nulls = parsed.mentions.filter((m) => m.country === null);
    expect(nulls.length).toBeGreaterThan(0);
  });

  it("parses sentiment as a distribution and derives the dominant label", () => {
    for (const m of parsed.mentions) {
      expect(m.sentiment).not.toBeNull();
      const s = m.sentiment!;
      // The three keys sum to ~1 — this is a mix, not a label.
      expect(s.positive + s.negative + s.neutral).toBeCloseTo(1, 1);
      expect(["positive", "negative", "neutral"]).toContain(m.sentimentLabel);
    }
  });

  it("drops an item with no URL rather than rendering an unopenable row", () => {
    expect(parseMention({ domain: "x.com", content_info: { title: "t" } })).toBeNull();
    expect(parseMention({})).toBeNull();
    expect(parseMention(null)).toBeNull();
  });

  it("survives a truncated or alien envelope", () => {
    for (const junk of [null, undefined, {}, [], [{}], { items: "nope" }]) {
      const r = parseSearchResult(junk);
      expect(r.totalCount).toBe(0);
      expect(r.mentions).toEqual([]);
    }
  });
});

// ─── summary/live ───────────────────────────────────────────────────────────
describe("parseSummaryResult against the recorded envelope", () => {
  const parsed = parseSummaryResult(SUMMARY.tasks[0].result);

  it("reads totals, sentiment, and the top domains", () => {
    expect(parsed.totalCount).toBeGreaterThan(1_000_000);
    expect(parsed.sentiment).not.toBeNull();
    expect(parsed.topDomains.length).toBeGreaterThan(0);
    expect(parsed.topDomains[0].domain.length).toBeGreaterThan(0);
    expect(parsed.topDomains[0].count).toBeGreaterThan(0);
  });

  it("sorts top domains by count descending", () => {
    const counts = parsed.topDomains.map((d) => d.count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it("turns the country and language count OBJECTS into sorted lists", () => {
    // The API returns these as objects keyed by code, not arrays — the shape
    // most likely to be assumed wrong.
    expect(Array.isArray(parsed.countries)).toBe(true);
    expect(Array.isArray(parsed.languages)).toBe(true);
    expect(parsed.languages.length).toBeGreaterThan(0);
    const counts = parsed.languages.map((l) => l.count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it("survives an alien envelope", () => {
    const empty = parseSummaryResult({});
    expect(empty.totalCount).toBe(0);
    expect(empty.sentiment).toBeNull();
    expect(empty.topDomains).toEqual([]);
  });
});

// ─── Sentiment semantics ────────────────────────────────────────────────────
describe("sentiment", () => {
  it("treats an all-zero distribution as no data, not as neutral", () => {
    // This is exactly what a zero-result phrase returns. Calling it "neutral"
    // would put a grey chip on a search that found nothing.
    expect(parseSentiment({ positive: 0, negative: 0, neutral: 0 })).toBeNull();
    expect(sentimentLabel(null)).toBeNull();
  });

  it("requires all three keys", () => {
    expect(parseSentiment({ positive: 0.5, negative: 0.5 })).toBeNull();
    expect(parseSentiment({})).toBeNull();
    expect(parseSentiment(null)).toBeNull();
  });

  it("picks the dominant key and resolves ties to neutral", () => {
    expect(sentimentLabel({ positive: 0.6, negative: 0.2, neutral: 0.2 })).toBe("positive");
    expect(sentimentLabel({ positive: 0.2, negative: 0.6, neutral: 0.2 })).toBe("negative");
    expect(sentimentLabel({ positive: 0.2, negative: 0.2, neutral: 0.6 })).toBe("neutral");
    // A genuine tie is ambiguous; neutral is the honest reading.
    expect(sentimentLabel({ positive: 0.5, negative: 0.5, neutral: 0 })).toBe("neutral");
  });
});

// ─── Date normalization ─────────────────────────────────────────────────────
describe("parseApiDate", () => {
  it("handles the provider's spaced format", () => {
    // "2024-02-25 22:02:23 +00:00" — space instead of T, spaced offset.
    expect(parseApiDate("2024-02-25 22:02:23 +00:00")).toBe("2024-02-25T22:02:23.000Z");
  });

  it("applies the offset rather than dropping it", () => {
    const utc = parseApiDate("2024-02-25 12:00:00 +00:00")!;
    const plus2 = parseApiDate("2024-02-25 12:00:00 +02:00")!;
    expect(new Date(utc).getTime() - new Date(plus2).getTime()).toBe(2 * 3600 * 1000);
  });

  it("returns null for junk rather than an Invalid Date", () => {
    for (const junk of ["", "   ", "not a date", null, undefined, 42]) {
      expect(parseApiDate(junk)).toBeNull();
    }
  });
});

// ─── Query normalization ────────────────────────────────────────────────────
describe("normalizeQuery", () => {
  it("collapses the variants that would otherwise be billed twice", () => {
    // At ~5 cents a search with a fixed floor, "Echorank360" and " echorank360 "
    // must be one cache entry.
    for (const v of ["Echorank360", " Echorank360 ", "ECHORANK360", "echorank360"]) {
      expect(normalizeQuery(v)).toBe("echorank360");
    }
    expect(normalizeQuery("reputation   management  software")).toBe(
      "reputation management software",
    );
  });

  it("handles empty input", () => {
    expect(normalizeQuery("")).toBe("");
    expect(normalizeQuery("   ")).toBe("");
  });
});

// ─── Caps sanity-checked against the MEASURED cost ──────────────────────────
describe("plan caps against measured provider cost", () => {
  it("uses the cost measured from the envelopes, not a guess", () => {
    // search $0.024036 base + ~$0.0000353/item, summary $0.024036 flat.
    // At 50 items: 0.025800 + 0.024036 = 0.049836.
    expect(COST_PER_SEARCH_USD).toBeCloseTo(0.0498, 4);
  });

  it("prices each plan's worst case", () => {
    expect(contentSearchLimit("STARTER")).toBe(10);
    expect(contentSearchLimit("GROWTH")).toBe(50);
    expect(contentSearchLimit("AGENCY")).toBe(200);
    expect(worstCaseMonthlyUsd("STARTER")).toBeCloseTo(0.5, 2);
    expect(worstCaseMonthlyUsd("GROWTH")).toBeCloseTo(2.49, 2);
    expect(worstCaseMonthlyUsd("AGENCY")).toBeCloseTo(9.96, 2);
  });

  it("keeps every plan's worst case inside the default per-tenant USD cap", () => {
    // SEO_MONTHLY_CAP_USD_DEFAULT is 25 and is shared with backlinks, site
    // audit, rank tracker and SERP checks — so this tool must not be able to
    // consume it alone.
    for (const plan of ["STARTER", "GROWTH", "AGENCY"] as const) {
      expect(worstCaseMonthlyUsd(plan)).toBeLessThan(25);
    }
  });

  it("locks the tool out of AI_VISIBILITY entirely", () => {
    expect(planCanSearchContent("AI_VISIBILITY")).toBe(false);
    expect(contentSearchLimit("AI_VISIBILITY")).toBe(0);
    expect(worstCaseMonthlyUsd("AI_VISIBILITY")).toBe(0);
  });

  it("sets the high-authority badge thresholds where the data supports them", () => {
    // Recorded sample: min 138 / median 484 / max 700. A threshold at or below
    // the median would badge half the table and mean nothing.
    const ranks = parseSearchResult(SEARCH.tasks[0].result)
      .mentions.map((m) => m.domainRank ?? 0)
      .sort((a, b) => a - b);
    const median = ranks[Math.floor(ranks.length / 2)];
    expect(HIGH_AUTHORITY_RANK).toBeGreaterThan(median);
    expect(MAX_SPAM_SCORE_FOR_BADGE).toBeLessThan(50);
  });
});
