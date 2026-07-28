// Site Explorer parsers against the REAL recorded envelopes.
//
// The route suite runs the parsers over hand-written envelopes; this one runs
// them over fixtures/dataforseo/*.json — the exact bytes DataForSEO returned
// for birdeye.com on 2026-07-28. It is the regression net for the three shape
// mistakes that a hand-written envelope hid:
//
//   1. domain_rank_overview nests metrics under result[0].items[0]
//   2. competitors_domain has three metric blocks; the column wants
//      competitor_metrics, not metrics
//   3. backlinks/summary reports nofollow per referring PAGE in the attributes
//      block, but per referring DOMAIN as a first-class field
//
// Zero network, zero spend.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseBacklinks,
  parseCompetitors,
  parseOverview,
  parseRankedKeywords,
} from "@/lib/site-explorer/parse";
import { normalizeDomain } from "@/lib/site-explorer/domain";

const TARGET = "birdeye.com";

function envelope<T>(apiPath: string): T {
  const file = join(process.cwd(), "fixtures", "dataforseo", `${apiPath.replace(/\//g, "-")}.json`);
  const json = JSON.parse(readFileSync(file, "utf8")) as {
    tasks: { status_code: number; cost: number; result: unknown }[];
  };
  expect(json.tasks[0].status_code).toBe(20000);
  return json.tasks[0].result as T;
}

describe("parseOverview", () => {
  const overview = parseOverview(envelope("v3/dataforseo_labs/google/domain_rank_overview/live"));

  it("reads the metrics nested under items[0], not off the result element", () => {
    // These are birdeye.com's real numbers. If the nesting regresses, every
    // one of them silently becomes 0 — which is why they are asserted exactly.
    expect(overview.etv).toBeCloseTo(928926.0017776303, 4);
    expect(overview.keywordCount).toBe(202815);
    expect(overview.estimatedPaidTrafficCost).toBeCloseTo(1392062.6528621677, 4);
  });

  it("collapses the ten upstream rank buckets into five without losing keywords", () => {
    const d = overview.distribution;
    expect(d.pos1).toBe(293);
    expect(d.pos2_3).toBe(2176);
    expect(d.pos4_10).toBe(30689);
    expect(d.pos11_20).toBe(59732);
    // 40491 + 27593 + 17920 + 11573 + 7082 + 3584 + 1304 + 378
    expect(d.pos21_100).toBe(109925);
    // The five buckets must still add up to the reported keyword count.
    const summed = d.pos1 + d.pos2_3 + d.pos4_10 + d.pos11_20 + d.pos21_100;
    expect(summed).toBe(overview.keywordCount);
  });

  it("returns zeros rather than throwing on an empty result", () => {
    expect(parseOverview([]).keywordCount).toBe(0);
    expect(parseOverview(undefined).etv).toBe(0);
    expect(parseOverview([{}]).distribution.pos1).toBe(0);
  });
});

describe("parseRankedKeywords", () => {
  const section = parseRankedKeywords(envelope("v3/dataforseo_labs/google/ranked_keywords/live"));

  it("returns the 100 requested rows out of the domain's full total", () => {
    expect(section.items).toHaveLength(100);
    expect(section.totalCount).toBe(202821);
  });

  it("fills every column of every row from the envelope", () => {
    for (const row of section.items) {
      expect(row.keyword.length).toBeGreaterThan(0);
      expect(row.position).toBeGreaterThan(0);
      expect(row.url).toMatch(/^https?:\/\//);
      expect(Number.isFinite(row.searchVolume)).toBe(true);
      expect(Number.isFinite(row.etv)).toBe(true);
    }
  });

  it("honours the rank_group,asc order the service requests", () => {
    const positions = section.items.map((row) => row.position);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("drops rows with no keyword text rather than rendering a blank cell", () => {
    const section = parseRankedKeywords([
      {
        total_count: 2,
        items: [
          { ranked_serp_element: { serp_item: { rank_group: 4 } } },
          {
            keyword_data: { keyword: "kept", keyword_info: { search_volume: 10 } },
            ranked_serp_element: { serp_item: { rank_group: 1, url: "https://a.test/", etv: 2 } },
          },
        ],
      },
    ]);
    expect(section.items.map((r) => r.keyword)).toEqual(["kept"]);
  });
});

describe("parseCompetitors", () => {
  const raw = envelope<{ items?: { domain?: string }[] }[]>(
    "v3/dataforseo_labs/google/competitors_domain/live",
  );
  const section = parseCompetitors(raw, TARGET);

  it("filters out the target's own row", () => {
    expect(raw[0].items?.some((i) => i.domain === TARGET)).toBe(true);
    expect(section.items.some((row) => row.domain === TARGET)).toBe(false);
    expect(section.items).toHaveLength(19); // 20 requested, minus the target
  });

  it("uses the COMPETITOR's traffic on the shared keywords, not the target's", () => {
    const facebook = section.items.find((row) => row.domain === "facebook.com");
    expect(facebook).toBeDefined();
    expect(facebook!.intersections).toBe(191565);
    expect(facebook!.avgPosition).toBeCloseTo(8.583332028293269, 6);
    // competitor_metrics.organic.etv (7118762) — NOT metrics.organic.etv
    // (843857, which is birdeye's own traffic on those keywords).
    expect(facebook!.etv).toBeCloseTo(7118762.28786457, 2);
    expect(facebook!.etv).not.toBeCloseTo(843857.1103391815, 2);
  });

  it("normalizes competitor domains so www. does not split the table", () => {
    for (const row of section.items) {
      expect(row.domain).toBe(row.domain.toLowerCase());
      expect(row.domain.startsWith("www.")).toBe(false);
    }
  });

  it("survives an empty or absent result", () => {
    expect(parseCompetitors(undefined, TARGET).items).toEqual([]);
    expect(parseCompetitors([{}], TARGET).items).toEqual([]);
  });
});

describe("parseBacklinks", () => {
  const section = parseBacklinks(envelope("v3/backlinks/summary/live"));

  it("reads the headline metrics", () => {
    expect(section.backlinks).toBe(1467392);
    expect(section.referringDomains).toBe(24492);
    expect(section.referringMainDomains).toBe(21020);
    expect(section.rank).toBe(530);
    expect(section.brokenBacklinks).toBe(13820);
  });

  it("derives the dofollow split from the referring-DOMAIN pair", () => {
    // 24492 - 5865 = 18627 dofollow domains, 76.1 %.
    expect(section.nofollowDomains).toBe(5865);
    expect(section.dofollowDomains).toBe(18627);
    expect(section.dofollowRatio).toBeCloseTo(18627 / 24492, 10);
    // The 135608 in referring_links_attributes.nofollow is per referring PAGE.
    // If it ever leaks into this calculation the ratio jumps to ~90.8 %.
    expect(section.dofollowRatio!).toBeLessThan(0.8);
  });

  it("reports null, not 100 %, when no referring domains came back", () => {
    expect(parseBacklinks([]).dofollowRatio).toBeNull();
    expect(parseBacklinks([{ backlinks: 5 }]).dofollowRatio).toBeNull();
  });

  it("never lets nofollow exceed the domain total", () => {
    const odd = parseBacklinks([{ referring_domains: 10, referring_domains_nofollow: 99 }]);
    expect(odd.nofollowDomains).toBe(10);
    expect(odd.dofollowDomains).toBe(0);
    expect(odd.dofollowRatio).toBe(0);
  });
});

describe("normalizeDomain", () => {
  it.each([
    ["example.com", "example.com"],
    ["  Example.COM  ", "example.com"],
    ["https://example.com", "example.com"],
    ["http://www.example.com/", "example.com"],
    ["HTTPS://WWW.Example.CO.UK:443/blog?x=1#top", "example.co.uk"],
    ["user:pw@example.com/path", "example.com"],
    ["example.com.", "example.com"],
    ["sub.example.com", "sub.example.com"],
    ["xn--bcher-kva.example", "xn--bcher-kva.example"],
  ])("normalizes %j -> %j", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it.each(["", "   ", "localhost", "example", "192.168.0.1", "1.1.1.1", "-bad.com", "bad-.com", "exa mple.com", "http://", "example.c0m", "a..b.com"])(
    "rejects %j",
    (input) => {
      expect(() => normalizeDomain(input)).toThrow(/Enter a domain/);
    },
  );

  it("collapses www and non-www to one cache key", () => {
    expect(normalizeDomain("https://www.example.com/a")).toBe(normalizeDomain("EXAMPLE.com"));
  });
});
