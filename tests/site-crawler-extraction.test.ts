// tests/site-crawler-extraction.test.ts
//
// Phase 4b extraction engine: CSS on the cheerio document, XPath over the
// xmldom copy of it, regex over raw HTML under a shared per-page budget, and
// custom search counts.

import { describe, expect, it, vi } from "vitest";
import * as cheerio from "cheerio";

vi.mock("server-only", () => ({}));

import { CrawlConfigInputSchema, EXTRACTOR_PRESETS, type Extractor } from "@/lib/site-crawler/crawl-config";
import { REGEX_PAGE_BUDGET_MS, checkExtractorExpr, compileExtraction } from "@/lib/site-crawler/extraction";
import { parsePage } from "@/lib/site-crawler/checks";

const HTML = `<!doctype html><html lang=en><head>
<title>Blue Widget</title>
<meta property="og:title" content="Blue Widget – Shop">
<meta property="og:image" content="https://x.example.com/w.png">
<meta property="og:description" content="A blue one.">
<meta name=author content="Ada Lovelace">
<meta property="article:published_time" content="2026-10-01T08:00:00Z">
<link rel=canonical href="https://x.example.com/w">
<link rel=alternate hreflang=fr href=/fr/w><link rel="alternate" hreflang="de" href="/de/w">
<script type="application/ld+json">{"@type":"Product","sku":"BW-42","offers":{"price":"19.90"}}</script>
</head><body>
<h1 class=title>Blue <b>Widget</b></h1>
<span itemprop=price content="19.90">CHF 19.90</span>
<ul><li>one</li><li> two </li><li></li><li>three</li></ul>
<p>Call us: 044 123 45 67 or 044 765 43 21. Widget widget WIDGET.</p>
</body></html>`;

const ex = (over: Partial<Extractor>): Extractor => ({ name: "x", kind: "css", expr: "h1", attr: null, multiple: false, ...over });
const run = (extractors: Extractor[], html = HTML, searches: { name: string; pattern: string; isRegex: boolean }[] = []) =>
  compileExtraction(extractors, searches)!.run(cheerio.load(html), html);
const one = (e: Partial<Extractor>, html = HTML) => run([ex(e)], html).values.get(0) ?? [];

describe("extractors", () => {
  it.each<[string, Partial<Extractor>, string[]]>([
    ["css text, whitespace collapsed", { expr: "h1" }, ["Blue Widget"]],
    ["css attribute", { expr: 'link[rel="canonical"]', attr: "href" }, ["https://x.example.com/w"]],
    ["css first only", { expr: "li" }, ["one"]],
    ["css multiple, blanks dropped", { expr: "li", multiple: true }, ["one", "two", "three"]],
    ["css no match", { expr: "nav a" }, []],
    ["xpath text", { kind: "xpath", expr: "//h1" }, ["Blue Widget"]],
    ["xpath attribute, unquoted markup", { kind: "xpath", expr: "//link[@rel='alternate']/@hreflang", multiple: true }, ["fr", "de"]],
    ["xpath case-insensitive names", { kind: "xpath", expr: "//H1/B" }, ["Widget"]],
    ["xpath element attr option", { kind: "xpath", expr: "//meta[@name='author']", attr: null }, []],
    ["xpath number", { kind: "xpath", expr: "count(//li)" }, ["4"]],
    ["xpath string", { kind: "xpath", expr: "string(//title)" }, ["Blue Widget"]],
    ["regex capture group", { kind: "regex", expr: '"sku"\\s*:\\s*"([^"]+)"' }, ["BW-42"]],
    ["regex whole match, multiple", { kind: "regex", expr: "044 \\d{3} \\d\\d \\d\\d", multiple: true }, ["044 123 45 67", "044 765 43 21"]],
    ["regex empty matches do not loop", { kind: "regex", expr: "z*", multiple: true }, []],
  ])("%s", (_label, e, want) => {
    expect(one(e)).toEqual(want);
  });

  it.each(Object.entries(EXTRACTOR_PRESETS))("preset %s finds its value on a product page", (_k, preset) => {
    expect(one(preset).length).toBeGreaterThan(0);
  });

  it("caps values at 20 and each at 500 characters", () => {
    const html = `<ul>${Array.from({ length: 30 }, (_, i) => `<li>${i}${"x".repeat(600)}</li>`).join("")}</ul>`;
    const v = one({ expr: "li", multiple: true }, html);
    expect(v).toHaveLength(20);
    expect(v.every((s) => s.length === 500)).toBe(true);
  });

  it("keeps extractor indexes and omits the ones that found nothing", () => {
    const out = run([ex({ expr: "nav" }), ex({ expr: "title" })]);
    expect([...out.values]).toEqual([[1, ["Blue Widget"]]]);
    expect(out.searchHits).toBeNull();
  });

  it("skips an expression that no longer compiles instead of failing the page", () => {
    const out = run([ex({ kind: "xpath", expr: "//[" }), ex({ expr: "title" })]);
    expect([...out.values]).toEqual([[1, ["Blue Widget"]]]);
  });

  it("is null when the crawl has nothing to extract or search", () => {
    expect(compileExtraction([], [])).toBeNull();
  });
});

describe("custom search", () => {
  it.each([
    ["plain string, case-insensitive, non-overlapping", { pattern: "widget", isRegex: false }, 6],
    ["regex as written", { pattern: "044 \\d{3}", isRegex: true }, 2],
    ["regex is case-sensitive unless it says otherwise", { pattern: "WIDGET", isRegex: true }, 1],
    ["no match", { pattern: "gtag(", isRegex: false }, 0],
  ])("%s", (_label, s, n) => {
    const hits = run([], HTML, [{ name: "s", ...s }]).searchHits!;
    expect(hits["0"] ?? 0).toBe(n);
  });

  it("records only searches that matched, by index", () => {
    const hits = run([], HTML, [
      { name: "a", pattern: "nope", isRegex: false },
      { name: "b", pattern: "aaa", isRegex: false },
      { name: "c", pattern: "h1", isRegex: false },
    ]).searchHits;
    expect(hits).toEqual({ "2": 2 });
  });
});

describe("regex budget", () => {
  it("stops all regex work on the page once 50 ms are spent, keeping what it found", () => {
    let t = 0;
    const now = () => (t += REGEX_PAGE_BUDGET_MS / 4); // each check costs a quarter of the budget
    const html = "a1 a2 a3 a4 a5 a6 a7 a8";
    const extractor = compileExtraction(
      [ex({ kind: "regex", expr: "a\\d", multiple: true })],
      [{ name: "s", pattern: "a\\d", isRegex: true }],
    )!;
    const out = extractor.run(cheerio.load(html), html, now);
    expect(out.timedOut).toBe(true);
    expect(out.values.get(0)!.length).toBeLessThan(8);
    expect(out.searchHits).toEqual({});
  });
});

describe("checkExtractorExpr", () => {
  it.each([
    [{ kind: "css", expr: "div > p.x" }, null],
    [{ kind: "css", expr: "div >>> [" }, "invalid_selector"],
    [{ kind: "xpath", expr: "//div[@id='x']/text()" }, null],
    [{ kind: "xpath", expr: "//[" }, "invalid_xpath"],
    [{ kind: "regex", expr: "(" }, null],
  ] as const)("%o → %s", (e, reason) => {
    expect(checkExtractorExpr(e)).toBe(reason);
  });
});

describe("runs on parsePage's document", () => {
  it("hands the loaded document to the visitor once", () => {
    const visit = vi.fn();
    parsePage(HTML, "https://x.example.com/w", "https://x.example.com/", visit);
    expect(visit).toHaveBeenCalledTimes(1);
    expect(visit.mock.calls[0]![0]("h1").text()).toBe("Blue Widget");
  });

  it("parses through the config schema with defaults", () => {
    expect(CrawlConfigInputSchema.parse({ extractors: [{ name: "n", kind: "css", expr: "h1" }] }).extractors[0]).toEqual(ex({ name: "n" }));
  });
});
