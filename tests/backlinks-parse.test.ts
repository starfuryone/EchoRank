// Backlinks parsers against the REAL recorded envelopes, plus target
// normalization.
//
// The envelope tests exist because three of the five sections had field
// layouts that a reasonable guess got wrong, and every one of them failed
// SILENTLY — the wrong read yields zeros or an empty list, not an exception:
//
//   1. referring_domains has NO `dofollow` field (spam score is used instead)
//   2. anchors has NO `dofollow` field either; the dofollow-domain count is
//      differenced from referring_domains / referring_domains_nofollow
//   3. domain_pages puts the address in `page` (not `url`/`meta.url`) and
//      every metric under `page_summary` — reading the top level produced 20
//      rows of zeros that then filtered down to nothing
//
// Zero network, zero spend.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBacklinksSummary } from "@/lib/dataforseo/backlinks-summary";
import {
  parseAnchors,
  parseHistory,
  parseLinkedPages,
  parseReferringDomains,
} from "@/lib/backlinks/parse";
import {
  includeSubdomainsFor,
  isValidTarget,
  normalizeTarget,
} from "@/lib/backlinks/target";
import { sectionAppliesTo, sectionsForMode } from "@/lib/backlinks/types";

function envelope<T>(apiPath: string): T {
  const file = join(process.cwd(), "fixtures", "dataforseo", `${apiPath.replace(/\//g, "-")}.json`);
  const json = JSON.parse(readFileSync(file, "utf8")) as {
    tasks: { status_code: number; result: unknown }[];
  };
  expect(json.tasks[0].status_code).toBe(20000);
  return json.tasks[0].result as T;
}

// ─── summary ────────────────────────────────────────────────────────────────

describe("parseBacklinksSummary (shared with Site Explorer)", () => {
  const summary = parseBacklinksSummary(envelope("v3/backlinks/summary/live"));

  it("reads the headline metrics", () => {
    expect(summary.backlinks).toBe(1467392);
    expect(summary.referringDomains).toBe(24492);
    expect(summary.rank).toBe(530);
    expect(summary.brokenBacklinks).toBe(13820);
  });

  it("derives the dofollow split from the referring-DOMAIN pair", () => {
    // 24492 - 5865 = 18627, i.e. 76.1 %. The 135608 in the per-link attributes
    // block is counted against referring PAGES; if it ever leaks in here the
    // ratio jumps to ~90.8 %.
    expect(summary.nofollowDomains).toBe(5865);
    expect(summary.dofollowDomains).toBe(18627);
    expect(summary.dofollowRatio!).toBeLessThan(0.8);
  });

  it("carries the fields the Backlinks tool added without breaking old rows", () => {
    expect(summary.spamScore).toBe(7);
    expect(summary.referringIps).toBeGreaterThan(0);
    expect(typeof summary.firstSeen).toBe("string");
  });
});

// ─── referring_domains ──────────────────────────────────────────────────────

describe("parseReferringDomains", () => {
  const section = parseReferringDomains(envelope("v3/backlinks/referring_domains/live"));

  it("returns the 50 requested rows out of the full total", () => {
    expect(section.items).toHaveLength(50);
    expect(section.totalCount).toBe(21046);
  });

  it("fills every column from fields that actually exist upstream", () => {
    const first = section.items[0];
    expect(first.domain).toBe("agrusslawfirm.com");
    expect(first.rank).toBe(475);
    expect(first.backlinks).toBe(105573);
    // There is no `dofollow` field on these rows — spam score is reported.
    expect(first.spamScore).toBe(0);
    expect(first.firstSeen).toContain("2022-01-06");
    expect(first.lostDate).toBeNull();
  });

  it("normalizes domains so www. does not split the table", () => {
    for (const row of section.items) {
      expect(row.domain).toBe(row.domain.toLowerCase());
      expect(row.domain.startsWith("www.")).toBe(false);
    }
  });

  it("survives an empty or absent result", () => {
    expect(parseReferringDomains(undefined).items).toEqual([]);
    expect(parseReferringDomains([{}]).items).toEqual([]);
  });
});

// ─── anchors ────────────────────────────────────────────────────────────────

describe("parseAnchors", () => {
  const section = parseAnchors(envelope("v3/backlinks/anchors/live"));

  it("returns the 30 requested rows and the bar denominator", () => {
    expect(section.items).toHaveLength(30);
    expect(section.totalCount).toBe(67118);
    expect(section.maxBacklinks).toBe(320594);
    // The denominator must be the largest row actually in the list.
    expect(section.maxBacklinks).toBe(Math.max(...section.items.map((r) => r.backlinks)));
  });

  it("keeps null anchors — an image link legitimately has no text", () => {
    const top = section.items[0];
    expect(top.anchor).toBe("");
    expect(top.backlinks).toBe(320594);
  });

  it("differences dofollow domains from the reported nofollow pair", () => {
    // 6058 referring domains - 174 nofollow = 5884.
    expect(section.items[0].referringDomains).toBe(6058);
    expect(section.items[0].dofollowDomains).toBe(5884);
  });

  it("never lets the dofollow count go negative", () => {
    const odd = parseAnchors([
      { items: [{ anchor: "x", backlinks: 5, referring_domains: 1, referring_domains_nofollow: 9 }] },
    ]);
    expect(odd.items[0].dofollowDomains).toBe(0);
  });
});

// ─── domain_pages ───────────────────────────────────────────────────────────

describe("parseLinkedPages", () => {
  const section = parseLinkedPages(envelope("v3/backlinks/domain_pages/live"));

  it("reads the address from `page` and the metrics from `page_summary`", () => {
    // Reading the top level instead yields 20 zero rows that filter to none —
    // this assertion is the regression net for exactly that.
    expect(section.items.length).toBeGreaterThan(0);
    expect(section.items).toHaveLength(20);
    expect(section.totalCount).toBe(1457807);
    for (const row of section.items) {
      expect(row.url).toMatch(/^https?:\/\//);
      expect(row.backlinks).toBeGreaterThan(0);
    }
  });

  it("sorts most-linked first, since domain_pages rejects order_by", () => {
    const counts = section.items.map((r) => r.backlinks);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
    expect(section.items[0].backlinks).toBe(168005);
  });

  it("survives an empty or absent result", () => {
    expect(parseLinkedPages(undefined).items).toEqual([]);
    expect(parseLinkedPages([{ items: [] }]).items).toEqual([]);
  });
});

// ─── history ────────────────────────────────────────────────────────────────

describe("parseHistory", () => {
  const section = parseHistory(envelope("v3/backlinks/history/live"));

  it("returns 12 monthly points, oldest first", () => {
    expect(section.points).toHaveLength(12);
    const months = section.points.map((p) => p.month);
    expect([...months].sort()).toEqual(months);
    expect(months[0]).toBe("2025-07");
  });

  it("collapses the timestamp to a YYYY-MM bucket", () => {
    for (const point of section.points) {
      expect(point.month).toMatch(/^\d{4}-\d{2}$/);
      expect(point.backlinks).toBeGreaterThan(0);
      expect(point.referringDomains).toBeGreaterThan(0);
    }
  });

  it("drops undated points and duplicate months rather than folding the line", () => {
    const section = parseHistory([
      {
        items: [
          { date: "2026-01-31 00:00:00 +00:00", backlinks: 5, referring_domains: 2 },
          { date: "2026-01-15 00:00:00 +00:00", backlinks: 9, referring_domains: 3 },
          { backlinks: 7, referring_domains: 1 },
        ],
      },
    ]);
    expect(section.points).toHaveLength(1);
    expect(section.points[0].backlinks).toBe(5);
  });

  it("falls back to year/month when no date string is present", () => {
    const section = parseHistory([{ items: [{ year: 2026, month: 3, backlinks: 4 }] }]);
    expect(section.points[0].month).toBe("2026-03");
  });
});

// ─── target normalization ───────────────────────────────────────────────────

describe("normalizeTarget — domain mode", () => {
  it.each([
    ["example.com", "example.com"],
    ["  Example.COM  ", "example.com"],
    ["https://example.com", "example.com"],
    ["http://www.example.com/", "example.com"],
    ["HTTPS://WWW.Example.CO.UK:443/blog?x=1#top", "example.co.uk"],
    ["example.com.", "example.com"],
    ["sub.example.com", "sub.example.com"],
  ])("normalizes %j -> %j", (input, expected) => {
    expect(normalizeTarget(input, "domain")).toBe(expected);
  });

  it.each(["", "   ", "localhost", "example", "192.168.0.1", "-bad.com"])(
    "rejects %j",
    (input) => {
      expect(() => normalizeTarget(input, "domain")).toThrow(/Enter a domain/);
    },
  );
});

describe("normalizeTarget — exact-URL mode", () => {
  it("keeps the scheme, www. and path, because they identify the page", () => {
    expect(normalizeTarget("https://www.example.com/pricing", "exact_url")).toBe(
      "https://www.example.com/pricing",
    );
    // www. is NOT stripped here, unlike domain mode.
    expect(normalizeTarget("https://www.example.com/a", "exact_url")).not.toBe(
      normalizeTarget("https://example.com/a", "exact_url"),
    );
  });

  it("defaults a missing scheme to https", () => {
    expect(normalizeTarget("example.com/pricing", "exact_url")).toBe(
      "https://example.com/pricing",
    );
  });

  it("keeps the query but drops the fragment", () => {
    expect(normalizeTarget("https://example.com/a?b=1#top", "exact_url")).toBe(
      "https://example.com/a?b=1",
    );
  });

  it("does not leave a bare trailing ? that would split the cache", () => {
    expect(normalizeTarget("https://example.com/a?", "exact_url")).toBe(
      "https://example.com/a",
    );
  });

  it("still rejects hosts that are not real public domains", () => {
    for (const bad of ["https://localhost/x", "https://1.2.3.4/", "ftp://example.com/x", "not a url"]) {
      expect(() => normalizeTarget(bad, "exact_url")).toThrow(/full page URL/);
    }
  });

  it("keeps the two modes in separate cache namespaces", () => {
    // Same input, different mode -> different normalized target, so a domain
    // analysis can never be replayed for an exact-URL request.
    expect(normalizeTarget("example.com", "domain")).not.toBe(
      normalizeTarget("example.com", "exact_url"),
    );
  });
});

describe("mode -> upstream params", () => {
  it("only widens to subdomains for domain targets", () => {
    // DataForSEO ignores include_subdomains for page targets; sending true
    // would imply a behaviour the API does not honour.
    expect(includeSubdomainsFor("domain")).toBe(true);
    expect(includeSubdomainsFor("exact_url")).toBe(false);
  });

  it("isValidTarget mirrors normalizeTarget without throwing", () => {
    expect(isValidTarget("example.com", "domain")).toBe(true);
    expect(isValidTarget("localhost", "domain")).toBe(false);
    expect(isValidTarget("https://example.com/a", "exact_url")).toBe(true);
    expect(isValidTarget("not a url", "exact_url")).toBe(false);
  });
});

// ─── Mode-scoped sections ───────────────────────────────────────────────────

describe("sections that only exist for a whole domain", () => {
  it("keeps all five for domain mode", () => {
    expect(sectionsForMode("domain")).toEqual([
      "summary",
      "history",
      "referringDomains",
      "anchors",
      "pages",
    ]);
  });

  it("drops history and pages for exact-URL mode", () => {
    // Both are domain-scoped upstream and error on a page target, so they are
    // skipped rather than called and reported as broken.
    expect(sectionsForMode("exact_url")).toEqual(["summary", "referringDomains", "anchors"]);
    expect(sectionAppliesTo("history", "exact_url")).toBe(false);
    expect(sectionAppliesTo("pages", "exact_url")).toBe(false);
    expect(sectionAppliesTo("summary", "exact_url")).toBe(true);
  });
});
