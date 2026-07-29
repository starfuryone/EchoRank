// Site Audit parsers against the REAL recorded envelopes (echorank360.com,
// 25 pages, 2026-07-29).
//
// Four field-layout mistakes were caught by this crawl, and every one failed
// SILENTLY — the wrong read yields zeros or an empty list, never an exception:
//
//   1. duplicate_title / duplicate_description / duplicate_content and the
//      broken-link totals are page_metrics FIELDS, not `checks` entries.
//      Reading only `checks` dropped duplicate_title on 20 of 25 pages — the
//      single biggest finding on the site — from the issue list entirely.
//   2. on_page/pages reports `total_items_count`, not `total_count`; the
//      latter is absent and read 0 for a 25-page crawl.
//   3. seo_friendly_url and its four *_check siblings are POSITIVE checks:
//      the envelope reports 24 pages passing the characters check but only 13
//      with seo_friendly_url overall, which is only consistent if the *_check
//      keys count PASSES. Cataloguing them as problems reported 24 healthy
//      pages as issues.
//   4. page_timing has no `duration_time` — the keys are dom_complete /
//      time_to_interactive.
//
// Zero network, zero spend.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  crawlIsFinished,
  pagesCrawledFrom,
  parseIssues,
  parsePages,
  parseSummary,
  type RawSummaryResult,
} from "@/lib/site-audit/parse";
import { checkDefinition, PROBLEM_CHECKS, SEVERITY_ORDER } from "@/lib/site-audit/checks";

function envelope<T>(apiPath: string): T {
  const file = join(process.cwd(), "fixtures", "dataforseo", `${apiPath.replace(/\//g, "-")}.json`);
  const json = JSON.parse(readFileSync(file, "utf8")) as {
    tasks: { status_code: number; result: unknown }[];
  };
  expect(json.tasks[0].status_code).toBe(20000);
  return json.tasks[0].result as T;
}

const SUMMARY = envelope<RawSummaryResult[]>("v3/on_page/summary")[0];
const PAGES = envelope<Parameters<typeof parsePages>[0]>("v3/on_page/pages");

// ─── Crawl progress ─────────────────────────────────────────────────────────

describe("crawl progress", () => {
  it("recognises a finished crawl and its page count", () => {
    expect(crawlIsFinished(SUMMARY)).toBe(true);
    expect(pagesCrawledFrom(SUMMARY)).toBe(25);
  });

  it("treats anything other than 'finished' as still running", () => {
    // The poller must not store a half-crawled site as a completed audit.
    expect(crawlIsFinished({ crawl_progress: "in_progress" })).toBe(false);
    expect(crawlIsFinished({})).toBe(false);
    expect(crawlIsFinished(undefined)).toBe(false);
    expect(pagesCrawledFrom({ crawl_status: { pages_crawled: 6 } })).toBe(6);
  });
});

// ─── Summary ────────────────────────────────────────────────────────────────

describe("parseSummary", () => {
  const summary = parseSummary(SUMMARY);

  it("reads the headline metrics from the live crawl", () => {
    expect(summary.onPageScore).toBeCloseTo(92.79, 2);
    expect(summary.pagesCrawled).toBe(25);
    expect(summary.duplicateTitles).toBe(20);
    expect(summary.duplicateDescriptions).toBe(18);
    expect(summary.duplicateContent).toBe(21);
    expect(summary.brokenLinks).toBe(0);
    expect(summary.responses4xx).toBe(0);
    expect(summary.responses5xx).toBe(0);
  });

  it("keeps onpage_score on its native 0-100 scale", () => {
    // Unlike Lighthouse's 0-1 floats, OnPage already reports 0-100 — scaling
    // it again would report 9279.
    expect(summary.onPageScore).toBeGreaterThan(1);
    expect(summary.onPageScore).toBeLessThanOrEqual(100);
  });

  it("survives an empty result", () => {
    const empty = parseSummary(undefined);
    expect(empty.onPageScore).toBeNull();
    expect(empty.pagesCrawled).toBe(0);
  });
});

// ─── Issues ─────────────────────────────────────────────────────────────────

describe("parseIssues", () => {
  const issues = parseIssues(SUMMARY);
  const byKey = Object.fromEntries(issues.items.map((i) => [i.key, i]));

  it("includes the page_metrics issues that are NOT in the checks block", () => {
    // The regression net for the biggest bug: reading only `checks` made
    // duplicate_title (20 of 25 pages) vanish from the report.
    expect(byKey.duplicate_title).toBeDefined();
    expect(byKey.duplicate_title.count).toBe(20);
    expect(byKey.duplicate_title.severity).toBe("error");
    expect(byKey.duplicate_description.count).toBe(18);
    expect(byKey.duplicate_content.count).toBe(21);
  });

  it("includes issues that DO come from the checks block", () => {
    expect(byKey.low_content_rate.count).toBe(14);
    expect(byKey.low_content_rate.severity).toBe("warning");
    expect(byKey.has_render_blocking_resources.count).toBe(24);
  });

  it("does NOT report the positive seo_friendly_url checks as problems", () => {
    // 24 pages "have" seo_friendly_url_characters_check while only 13 have
    // seo_friendly_url overall — only consistent if these count PASSES.
    for (const key of [
      "seo_friendly_url",
      "seo_friendly_url_characters_check",
      "seo_friendly_url_dynamic_check",
      "seo_friendly_url_keywords_check",
      "seo_friendly_url_relative_length_check",
      "canonical",
      "has_html_doctype",
      "is_https",
    ]) {
      expect(byKey[key], `${key} must not be reported as an issue`).toBeUndefined();
      expect(issues.unclassified).toContain(key);
    }
  });

  it("sorts worst severity first, then by count", () => {
    const severities = issues.items.map((i) => SEVERITY_ORDER.indexOf(i.severity));
    expect([...severities].sort((a, b) => a - b)).toEqual(severities);
    expect(issues.items[0].key).toBe("duplicate_title");
  });

  it("totals each severity", () => {
    expect(issues.totals.error).toBe(20); // duplicate_title only
    expect(issues.totals.warning).toBeGreaterThan(0);
    expect(issues.totals.notice).toBeGreaterThan(0);
    const summed = issues.items.reduce((n, i) => n + i.count, 0);
    expect(issues.totals.error + issues.totals.warning + issues.totals.notice).toBe(summed);
  });

  it("never counts a key twice, even if it appears as both metric and check", () => {
    const keys = issues.items.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("ignores zero counts and survives an empty result", () => {
    expect(parseIssues({ page_metrics: { checks: { no_title: 0 } } }).items).toEqual([]);
    expect(parseIssues(undefined).items).toEqual([]);
    expect(parseIssues(undefined).totals).toEqual({ error: 0, warning: 0, notice: 0 });
  });
});

// ─── Pages ──────────────────────────────────────────────────────────────────

describe("parsePages", () => {
  const pages = parsePages(PAGES);

  it("reads the total from total_items_count, not total_count", () => {
    // `total_count` is absent on this endpoint and read 0 for a 25-page crawl.
    expect(pages.totalCount).toBe(25);
    expect(pages.items).toHaveLength(25);
  });

  it("treats a TRUE check as the condition holding, not as a pass", () => {
    // The home page is https and returns 200, so is_4xx_code is false there —
    // if true meant "passed", every healthy page would look broken.
    const home = pages.items.find((p) => p.url === "https://echorank360.com/")!;
    expect(home).toBeDefined();
    expect(home.statusCode).toBe(200);
    expect(home.failedChecks).not.toContain("is_4xx_code");
    expect(home.failedChecks).not.toContain("no_title");
  });

  it("never lists a positive check as a page failure", () => {
    for (const page of pages.items) {
      expect(page.failedChecks).not.toContain("is_https");
      expect(page.failedChecks).not.toContain("seo_friendly_url");
      expect(page.failedChecks).not.toContain("has_html_doctype");
    }
  });

  it("only lists catalogued checks, and issueCount matches", () => {
    for (const page of pages.items) {
      expect(page.issueCount).toBe(page.failedChecks.length);
      for (const key of page.failedChecks) {
        expect(checkDefinition(key), `${key} should be catalogued`).not.toBeNull();
      }
    }
  });

  it("sorts most-problematic first", () => {
    const counts = pages.items.map((p) => p.issueCount);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it("survives an empty or absent result", () => {
    expect(parsePages(undefined).items).toEqual([]);
    expect(parsePages([{ items: [] }]).items).toEqual([]);
  });
});

// ─── Catalogue integrity ────────────────────────────────────────────────────

describe("check catalogue", () => {
  it("classifies every catalogued check into a known severity", () => {
    for (const [key, definition] of Object.entries(PROBLEM_CHECKS)) {
      expect(SEVERITY_ORDER, key).toContain(definition.severity);
    }
  });

  it("does not catalogue the known-positive checks", () => {
    // Guards the whitelist against a well-meaning future addition.
    for (const key of [
      "seo_friendly_url",
      "seo_friendly_url_characters_check",
      "canonical",
      "is_https",
      "has_html_doctype",
    ]) {
      expect(checkDefinition(key), `${key} is a POSITIVE check`).toBeNull();
    }
  });
});
