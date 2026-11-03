// src/lib/site-crawler/extraction.ts
//
// Custom extraction and custom search (Phase 4b), run once per HTML page on
// what the crawler already has: no re-fetch, no second HTML parse.
//
//   css    cheerio, on the document parsePage already loaded.
//   xpath  `xpath` over an @xmldom/xmldom tree built from that same cheerio
//          document. xmldom's own text/html parser is not an HTML5 parser (it
//          loses elements after unquoted attributes), so the tree is copied
//          node by node from parse5's, which is what browsers build. Element
//          names are lowercase and namespace-free; isHtml makes name tests
//          case-insensitive, so //H1 and //h1 both work.
//   regex  over the raw HTML, flags "g": the first capture group when the
//          pattern has one, else the whole match.
//
// Searches count matches in the raw HTML: a plain string case-insensitively,
// a regex as written (flags "g").
//
// REGEX BUDGET. Every pattern passed unsafeRegex (crawl-config.ts) when the
// crawl was configured, which rejects the shapes that backtrack
// exponentially. On top of that, all regex work on one page shares a 50 ms
// budget, checked between matches: past it, extraction and counting stop and
// keep what they have. JavaScript cannot interrupt a single running match,
// which is why the screen comes first.

import "server-only";
import type { CheerioAPI } from "cheerio";
import * as cheerio from "cheerio";
import { DOMImplementation, type Document as XmlDocument, type Element as XmlElement } from "@xmldom/xmldom";
import * as xpath from "xpath";
import { CONFIG_LIMITS, type CustomSearch, type Extractor } from "./crawl-config";

/** Wall-clock budget for all regex work on one page. */
export const REGEX_PAGE_BUDGET_MS = 50;
/** Matches counted per search per page, at most. */
export const SEARCH_COUNT_MAX = 100_000;

export interface PageExtraction {
  /** Extractor index → values (1..20, each ≤ 500 chars). Extractors that found nothing are absent. */
  values: Map<number, string[]>;
  /** Search index → matches, only searches that matched. Null when the crawl has no searches. */
  searchHits: Record<string, number> | null;
  /** True when the regex budget ran out on this page. */
  timedOut: boolean;
}

export interface PageExtractor {
  extractorCount: number;
  searchCount: number;
  run($: CheerioAPI, html: string, now?: () => number): PageExtraction;
}

const clip = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, CONFIG_LIMITS.extractValueChars);

/** Null when the expression compiles; otherwise why not. Server-side half of checkCrawlConfig. */
export function checkExtractorExpr(e: Pick<Extractor, "kind" | "expr">): string | null {
  if (e.kind === "css") {
    try {
      cheerio.load("")(e.expr);
      return null;
    } catch {
      return "invalid_selector";
    }
  }
  if (e.kind === "xpath") {
    try {
      parseXPath(e.expr);
      return null;
    } catch {
      return "invalid_xpath";
    }
  }
  return null; // regex: regexProblem in crawl-config
}

// ─── XPath tree ──────────────────────────────────────────────────────────────

/** The parts of a domhandler node (cheerio's tree) this copy reads. */
interface DomNode {
  type: string;
  name?: string;
  data?: string;
  attribs?: Record<string, string>;
  children?: DomNode[];
}

/** Copy cheerio's parsed document into an xmldom Document. Names XML cannot hold (`@click`) are skipped. */
export function xmlFromCheerio($: CheerioAPI): XmlDocument {
  const doc = new DOMImplementation().createDocument(null, "");
  const copy = (src: DomNode, dst: XmlDocument | XmlElement) => {
    for (const n of src.children ?? []) {
      if (n.type === "text") {
        dst.appendChild(doc.createTextNode(n.data ?? ""));
      } else if ((n.type === "tag" || n.type === "script" || n.type === "style") && n.name) {
        let el: XmlElement;
        try {
          el = doc.createElement(n.name);
        } catch {
          continue;
        }
        for (const [k, v] of Object.entries(n.attribs ?? {})) {
          try {
            el.setAttribute(k, v);
          } catch {
            // not an XML name
          }
        }
        dst.appendChild(el);
        copy(n, el);
      }
    }
  };
  copy($.root()[0] as unknown as DomNode, doc);
  return doc;
}

interface XPathValue {
  toArray?: () => { nodeValue?: string | null; textContent?: string | null }[];
  toString(): string;
}

/** xpath's compiled-expression API, which its typings leave out. */
interface ParsedXPath {
  evaluate(options: { node: unknown; isHtml: boolean }): XPathValue;
}
const parseXPath = (expr: string): ParsedXPath => (xpath as unknown as { parse(e: string): ParsedXPath }).parse(expr);

function xpathValues(expr: ParsedXPath, doc: XmlDocument): string[] {
  const r = expr.evaluate({ node: doc, isHtml: true });
  // A node set (duck-typed: bundlers may rename the class); otherwise a string, number or boolean.
  if (typeof r.toArray === "function") return r.toArray().map((n) => n.nodeValue ?? n.textContent ?? "");
  return [r.toString()];
}

// ─── Regex with a shared budget ──────────────────────────────────────────────

class Budget {
  timedOut = false;
  constructor(
    private readonly deadline: number,
    private readonly now: () => number,
  ) {}
  spent(): boolean {
    if (!this.timedOut && this.now() > this.deadline) this.timedOut = true;
    return this.timedOut;
  }
}

/** Matches of a global regex, stopping at `max` or when the budget is spent. */
function* matches(re: RegExp, text: string, budget: Budget, max: number): Generator<RegExpExecArray> {
  re.lastIndex = 0;
  let n = 0;
  while (n < max && !budget.spent()) {
    const m = re.exec(text);
    if (!m) return;
    if (m[0] === "") re.lastIndex++; // never loop on an empty match
    n++;
    yield m;
  }
}

// ─── Compile ─────────────────────────────────────────────────────────────────

type Run = ($: CheerioAPI, html: string, xml: () => XmlDocument, budget: Budget) => string[];

function compileExtractor(e: Extractor): Run {
  const max = e.multiple ? CONFIG_LIMITS.extractValues : 1;
  if (e.kind === "css") {
    return ($) => {
      const out: string[] = [];
      $(e.expr).each((_, el) => {
        const v = clip(e.attr ? ($(el).attr(e.attr) ?? "") : $(el).text());
        if (v) out.push(v);
        return out.length < max;
      });
      return out;
    };
  }
  if (e.kind === "xpath") {
    const expr = parseXPath(e.expr);
    return (_$, _html, xml) => {
      const out: string[] = [];
      for (const raw of xpathValues(expr, xml())) {
        const v = clip(raw);
        if (v) out.push(v);
        if (out.length >= max) break;
      }
      return out;
    };
  }
  const re = new RegExp(e.expr, "g");
  return (_$, html, _xml, budget) => {
    const out: string[] = [];
    // Bounded by matches tried, not values kept: blank matches must not run forever.
    for (const m of matches(re, html, budget, max * 50)) {
      const v = clip(m.length > 1 ? (m[1] ?? "") : m[0]);
      if (v) out.push(v);
      if (out.length >= max) break;
    }
    return out;
  };
}

function compileSearch(s: CustomSearch): (html: string, lower: () => string, budget: Budget) => number {
  if (s.isRegex) {
    const re = new RegExp(s.pattern, "g");
    return (html, _lower, budget) => {
      let n = 0;
      for (const m of matches(re, html, budget, SEARCH_COUNT_MAX)) n += m ? 1 : 0;
      return n;
    };
  }
  const needle = s.pattern.toLowerCase();
  return (_html, lower) => {
    const hay = lower();
    let n = 0;
    for (let i = hay.indexOf(needle); i !== -1 && n < SEARCH_COUNT_MAX; i = hay.indexOf(needle, i + needle.length)) n++;
    return n;
  };
}

/**
 * One crawl's extractors and searches, compiled once. Null when the crawl has
 * neither. Expressions were validated at configuration; one that still fails
 * to compile here (a config saved by an older build) is skipped.
 */
export function compileExtraction(extractors: readonly Extractor[], searches: readonly CustomSearch[]): PageExtractor | null {
  if (extractors.length === 0 && searches.length === 0) return null;
  const safe = <T, R>(f: (x: T) => R) => (x: T): R | null => {
    try {
      return f(x);
    } catch {
      return null;
    }
  };
  const runs = extractors.map(safe(compileExtractor));
  const counts = searches.map(safe(compileSearch));
  return {
    extractorCount: extractors.length,
    searchCount: searches.length,
    run($, html, now = Date.now) {
      const budget = new Budget(now() + REGEX_PAGE_BUDGET_MS, now);
      let xml: XmlDocument | null = null;
      const getXml = () => (xml ??= xmlFromCheerio($));
      let lower: string | null = null;
      const getLower = () => (lower ??= html.toLowerCase());

      const values = new Map<number, string[]>();
      runs.forEach((run, i) => {
        if (!run) return;
        try {
          const v = run($, html, getXml, budget);
          if (v.length) values.set(i, v);
        } catch {
          // A selector that throws on this page's markup extracts nothing here.
        }
      });
      let searchHits: Record<string, number> | null = null;
      if (counts.length) {
        searchHits = {};
        counts.forEach((count, i) => {
          const n = count ? count(html, getLower, budget) : 0;
          if (n > 0) searchHits![String(i)] = n;
        });
      }
      return { values, searchHits, timedOut: budget.timedOut };
    },
  };
}
