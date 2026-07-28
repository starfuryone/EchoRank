// task_get/advanced envelope -> persisted shapes. Guards the two things that
// silently corrupt a SERP report: using the wrong rank field, and counting
// SERP features as organic results.

import { describe, expect, it } from "vitest";
import {
  parseOrganicItems,
  parseSerpFeatures,
  parseSerpTaskResult,
} from "@/lib/serp/parse";

const ITEMS = [
  { type: "featured_snippet", rank_group: 1, rank_absolute: 1, title: "Snippet", url: "https://x.test/" },
  { type: "organic", rank_group: 1, rank_absolute: 2, domain: "a.test", title: "A", url: "https://a.test/p", description: "aaa" },
  { type: "people_also_ask", rank_absolute: 3 },
  { type: "organic", rank_group: 2, rank_absolute: 4, title: "B", url: "https://www.b.test/q", description: "bbb" },
];

describe("parseOrganicItems", () => {
  it("keeps only organic items and ranks them by rank_group", () => {
    const items = parseOrganicItems(ITEMS);
    expect(items).toHaveLength(2);
    // rank_group is the organic-only rank: the 2nd item is position 1, not 2.
    expect(items.map((i) => i.position)).toEqual([1, 2]);
    expect(items[0]).toMatchObject({ title: "A", url: "https://a.test/p", domain: "a.test" });
  });

  it("derives a missing domain from the URL and strips www.", () => {
    expect(parseOrganicItems(ITEMS)[1].domain).toBe("b.test");
  });

  it("caps at the top 100 organic results", () => {
    const many = Array.from({ length: 140 }, (_, i) => ({
      type: "organic",
      rank_group: i + 1,
      url: `https://x.test/${i}`,
    }));
    const items = parseOrganicItems(many);
    expect(items).toHaveLength(100);
    expect(items.at(-1)?.position).toBe(100);
  });

  it("degrades missing strings to empty rather than throwing", () => {
    const items = parseOrganicItems([{ type: "organic", rank_group: 1 }]);
    expect(items[0]).toEqual({ position: 1, title: "", url: "", domain: "", snippet: "" });
  });

  it("drops items with no usable rank instead of showing position 0", () => {
    expect(parseOrganicItems([{ type: "organic", url: "https://x.test/" }])).toHaveLength(0);
  });
});

describe("parseSerpFeatures", () => {
  it("prefers DataForSEO's own item_types, minus organic", () => {
    expect(
      parseSerpFeatures({ item_types: ["organic", "people_also_ask", "local_pack"] }),
    ).toEqual(["local_pack", "people_also_ask"]);
  });

  it("falls back to the item types actually present", () => {
    expect(parseSerpFeatures({ items: ITEMS })).toEqual([
      "featured_snippet",
      "people_also_ask",
    ]);
  });

  it("returns an empty list for a purely organic page", () => {
    expect(parseSerpFeatures({ item_types: ["organic"] })).toEqual([]);
  });
});

describe("parseSerpTaskResult", () => {
  it("assembles results, features, and the organic count", () => {
    const parsed = parseSerpTaskResult([
      {
        keyword: "pizza",
        check_url: "https://www.google.com/search?q=pizza",
        se_results_count: 1234,
        item_types: ["organic", "images"],
        items: ITEMS,
      },
    ]);

    expect(parsed.itemCount).toBe(2);
    expect(parsed.results.items).toHaveLength(2);
    expect(parsed.results.seResultsCount).toBe(1234);
    expect(parsed.results.checkUrl).toContain("google.com");
    expect(parsed.serpFeatures).toEqual(["images"]);
  });

  it("survives an empty result array", () => {
    const parsed = parseSerpTaskResult([]);
    expect(parsed).toEqual({ results: { items: [] }, serpFeatures: [], itemCount: 0 });
  });
});
