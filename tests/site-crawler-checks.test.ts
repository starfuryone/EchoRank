// One test per issue rule, against fixture HTML.
//
// parsePage() and detectIssues() are pure — no network, no database, no clock —
// which is what makes a fixture per rule cheap enough to actually write. Every
// rule the product claims to detect is exercised here, in both directions:
// fires when it should, and stays quiet when it should not.
import { describe, expect, it } from "vitest";
import {
  ISSUE_SEVERITY,
  ISSUE_TYPES,
  detectIssues,
  parsePage,
  type IssueType,
} from "@/lib/site-crawler/checks";
import { THIN_CONTENT_WORDS } from "@/lib/site-crawler/constants";

const URL = "https://example.com/page";
const ROOT = "https://example.com/";

/** Enough prose to clear the thin-content floor, so it never fires by accident. */
const FILLER = Array.from({ length: THIN_CONTENT_WORDS + 20 }, (_, i) => `word${i}`).join(" ");

function html(opts: {
  title?: string | null;
  desc?: string | null;
  h1?: number;
  canonical?: string | null;
  robots?: string | null;
  body?: string;
  links?: string[];
} = {}): string {
  const {
    title = "A perfectly reasonable page title",
    desc = "A meta description of an entirely unremarkable length for testing.",
    h1 = 1,
    canonical = URL,
    robots = null,
    body = FILLER,
    links = [],
  } = opts;

  return `<!doctype html><html><head>
    ${title === null ? "" : `<title>${title}</title>`}
    ${desc === null ? "" : `<meta name="description" content="${desc}">`}
    ${canonical === null ? "" : `<link rel="canonical" href="${canonical}">`}
    ${robots === null ? "" : `<meta name="robots" content="${robots}">`}
  </head><body>
    ${Array.from({ length: h1 }, (_, i) => `<h1>Heading ${i}</h1>`).join("")}
    <p>${body}</p>
    ${links.map((l) => `<a href="${l}">l</a>`).join("")}
  </body></html>`;
}

function issuesFor(source: string, over: Partial<Parameters<typeof detectIssues>[0]> = {}) {
  const parsed = parsePage(source, URL, ROOT);
  return detectIssues({
    statusCode: 200,
    parsed,
    finalUrl: URL,
    redirectHops: 0,
    xRobotsTag: null,
    isHtml: true,
    ...over,
  }).map((i) => i.type);
}

describe("issue catalogue", () => {
  it("gives every type exactly one severity", () => {
    for (const type of ISSUE_TYPES) {
      expect(ISSUE_SEVERITY[type], type).toMatch(/^(ERROR|WARNING|NOTICE)$/);
    }
    expect(Object.keys(ISSUE_SEVERITY).sort()).toEqual([...ISSUE_TYPES].sort());
  });

  it("assigns the severities the spec calls for", () => {
    const bySeverity = (s: string) =>
      (Object.entries(ISSUE_SEVERITY) as [IssueType, string][])
        .filter(([, v]) => v === s)
        .map(([k]) => k)
        .sort();

    expect(bySeverity("ERROR")).toEqual(
      // REDIRECT_LOOP joined in Phase 2; it is written by aggregation, not by
      // detectIssues, but it shares the same severity table.
      ["HTTP_4XX", "HTTP_5XX", "TITLE_MISSING", "H1_MISSING", "NOINDEX", "REDIRECT_LOOP"].sort(),
    );
    expect(bySeverity("NOTICE")).toEqual(
      // NO_INLINKS joined in Phase 2, from aggregation.
      ["BLOCKED_BY_ROBOTS", "CANONICAL_MISSING", "DUPLICATE_CONTENT", "NO_INLINKS"].sort(),
    );
  });
});

describe("a clean page", () => {
  it("produces no issues at all", () => {
    expect(issuesFor(html())).toEqual([]);
  });
});

describe("parsePage", () => {
  it("extracts the fields the row stores", () => {
    const p = parsePage(html({ title: "Hello", desc: "Desc" }), URL, ROOT);
    expect(p.title).toBe("Hello");
    expect(p.titleLength).toBe(5);
    expect(p.metaDescription).toBe("Desc");
    expect(p.metaDescLength).toBe(4);
    expect(p.h1Count).toBe(1);
    expect(p.canonical).toBe(URL);
    expect(p.wordCount).toBeGreaterThan(THIN_CONTENT_WORDS);
  });

  it("hashes content, not markup — same text, same hash", () => {
    const a = parsePage(html({ body: "identical words here" }), URL, ROOT);
    const b = parsePage(html({ body: "identical words here" }), "https://example.com/other", ROOT);
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("excludes script and style text from the word count", () => {
    const noisy = `<html><body><script>${"junk ".repeat(400)}</script><p>three real words</p></body></html>`;
    expect(parsePage(noisy, URL, ROOT).wordCount).toBe(3);
  });

  it("collects in-scope links and drops external ones", () => {
    const p = parsePage(
      html({ links: ["/a", "https://example.com/b", "https://elsewhere.com/c"] }),
      URL,
      ROOT,
    );
    expect(p.links).toContain("https://example.com/a");
    expect(p.links).toContain("https://example.com/b");
    expect(p.links.some((l) => l.includes("elsewhere.com"))).toBe(false);
  });

  it("records nofollow links without enqueueing them", () => {
    const source = `<html><body><a href="/followed">a</a><a href="/skipped" rel="nofollow">b</a></body></html>`;
    const p = parsePage(source, URL, ROOT);
    expect(p.links).toEqual(["https://example.com/followed"]);
    expect(p.nofollowLinks).toEqual(["https://example.com/skipped"]);
    expect(p.internalLinks).toBe(2); // counted, per spec
  });
});

describe("ERROR rules", () => {
  it("HTTP_4XX on a 404", () => {
    expect(issuesFor(html(), { statusCode: 404 })).toContain("HTTP_4XX");
  });

  it("HTTP_5XX on a 503", () => {
    expect(issuesFor(html(), { statusCode: 503 })).toContain("HTTP_5XX");
  });

  it("TITLE_MISSING when there is no title", () => {
    expect(issuesFor(html({ title: null }))).toContain("TITLE_MISSING");
  });

  it("H1_MISSING when there is no h1", () => {
    expect(issuesFor(html({ h1: 0 }))).toContain("H1_MISSING");
  });

  it("NOINDEX from meta robots", () => {
    expect(issuesFor(html({ robots: "noindex, follow" }))).toContain("NOINDEX");
  });

  it("NOINDEX from the X-Robots-Tag header", () => {
    expect(issuesFor(html(), { xRobotsTag: "noindex" })).toContain("NOINDEX");
  });

  it("reports NOINDEX once when both the header and the tag say it", () => {
    const found = issuesFor(html({ robots: "noindex" }), { xRobotsTag: "noindex" });
    expect(found.filter((t) => t === "NOINDEX")).toHaveLength(1);
  });
});

describe("WARNING rules", () => {
  it("TITLE_TOO_LONG past 60 chars", () => {
    expect(issuesFor(html({ title: "x".repeat(61) }))).toContain("TITLE_TOO_LONG");
    expect(issuesFor(html({ title: "x".repeat(60) }))).not.toContain("TITLE_TOO_LONG");
  });

  it("TITLE_TOO_SHORT under 15 chars", () => {
    expect(issuesFor(html({ title: "x".repeat(14) }))).toContain("TITLE_TOO_SHORT");
    expect(issuesFor(html({ title: "x".repeat(15) }))).not.toContain("TITLE_TOO_SHORT");
  });

  it("META_DESC_MISSING and META_DESC_TOO_LONG", () => {
    expect(issuesFor(html({ desc: null }))).toContain("META_DESC_MISSING");
    expect(issuesFor(html({ desc: "x".repeat(161) }))).toContain("META_DESC_TOO_LONG");
    expect(issuesFor(html({ desc: "x".repeat(160) }))).not.toContain("META_DESC_TOO_LONG");
  });

  it("MULTIPLE_H1 with more than one", () => {
    expect(issuesFor(html({ h1: 2 }))).toContain("MULTIPLE_H1");
    expect(issuesFor(html({ h1: 1 }))).not.toContain("MULTIPLE_H1");
  });

  it("CANONICAL_MISMATCH when the canonical points elsewhere", () => {
    expect(issuesFor(html({ canonical: "https://example.com/different" }))).toContain(
      "CANONICAL_MISMATCH",
    );
  });

  it("no CANONICAL_MISMATCH for a canonical that differs only by normalization", () => {
    // Trailing slash and tracking params are noise, not a finding.
    expect(issuesFor(html({ canonical: "https://example.com/page/?utm_source=x" }))).not.toContain(
      "CANONICAL_MISMATCH",
    );
  });

  it("REDIRECT_CHAIN only past one hop", () => {
    expect(issuesFor(html(), { redirectHops: 1 })).not.toContain("REDIRECT_CHAIN");
    expect(issuesFor(html(), { redirectHops: 2 })).toContain("REDIRECT_CHAIN");
  });

  it("THIN_CONTENT under the word floor on a 200", () => {
    expect(issuesFor(html({ body: "only a few words here" }))).toContain("THIN_CONTENT");
  });

  it("no THIN_CONTENT on a non-200 — absence is not thinness", () => {
    expect(issuesFor(html({ body: "short" }), { statusCode: 404 })).not.toContain("THIN_CONTENT");
  });
});

describe("NOTICE rules", () => {
  it("CANONICAL_MISSING when there is no canonical", () => {
    expect(issuesFor(html({ canonical: null }))).toContain("CANONICAL_MISSING");
  });

  it("DUPLICATE_CONTENT when another page shared the hash", () => {
    const found = issuesFor(html(), { duplicateOf: "https://example.com/original" });
    expect(found).toContain("DUPLICATE_CONTENT");
  });

  it("BLOCKED_BY_ROBOTS is the only finding for a page we never fetched", () => {
    const found = detectIssues({
      statusCode: null,
      parsed: null,
      finalUrl: URL,
      redirectHops: 0,
      xRobotsTag: null,
      isHtml: false,
      blockedByRobots: true,
    });
    // Every content rule below would be reporting on absence rather than the
    // page, so exactly one issue is correct here.
    expect(found.map((i) => i.type)).toEqual(["BLOCKED_BY_ROBOTS"]);
    expect(found[0]!.severity).toBe("NOTICE");
  });
});

describe("non-HTML responses", () => {
  it("records the status without running content rules", () => {
    const found = detectIssues({
      statusCode: 200,
      parsed: null,
      finalUrl: "https://example.com/a.pdf",
      redirectHops: 0,
      xRobotsTag: null,
      isHtml: false,
    });
    expect(found).toEqual([]);
  });

  it("still reports a 4xx on a non-HTML URL", () => {
    const found = detectIssues({
      statusCode: 404,
      parsed: null,
      finalUrl: "https://example.com/a.pdf",
      redirectHops: 0,
      xRobotsTag: null,
      isHtml: false,
    });
    expect(found.map((i) => i.type)).toEqual(["HTTP_4XX"]);
  });
});
