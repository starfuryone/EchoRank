// Lighthouse parsers + URL validation.
//
// ⚠ PROVENANCE: the two fixtures are SYNTHETIC, hand-built to the documented
// PSI v5 shape — NOT recorded responses. Google's keyless daily quota was
// exhausted and no PAGESPEED_API_KEY was configured when this feature was
// built, so no live run could be captured. Every other tool in this repo had
// at least one silently-wrong field layout that only a real recording caught,
// so treat these assertions as pinning MY UNDERSTANDING of the shape, not the
// shape itself. Re-run scripts/lighthouse-e2e.ts once a key exists and
// reconcile.
//
// Zero network.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseCrux,
  parseMetrics,
  parseOpportunities,
  parsePsiResponse,
  parseScores,
  type RawPsiResponse,
} from "@/lib/lighthouse/parse";
import { metricBand, scoreBand } from "@/lib/lighthouse/options";
import { isValidAuditUrl, normalizeAuditUrl } from "@/lib/lighthouse/url";
import { fixtureKeyFor } from "@/lib/pagespeed/client";

function fixture(name: string): RawPsiResponse {
  return JSON.parse(
    readFileSync(join(process.cwd(), "fixtures", "pagespeed", `${name}.json`), "utf8"),
  ) as RawPsiResponse;
}

const WITH_CRUX = fixture("__synthetic__-with-crux-mobile");
const NO_CRUX = fixture("__synthetic__-no-crux-desktop");

// ─── Scores ─────────────────────────────────────────────────────────────────

describe("parseScores", () => {
  it("converts Lighthouse's 0-1 floats to the 0-100 the UI shows", () => {
    expect(parseScores(WITH_CRUX)).toEqual({
      performance: 62,
      accessibility: 94,
      bestPractices: 96,
      seo: 100,
    });
  });

  it("maps best-practices to camelCase without dropping it", () => {
    // The PSI id is kebab-case and the only category whose key differs.
    expect(parseScores(WITH_CRUX).bestPractices).toBe(96);
  });

  it("returns null, not 0, for an unscored category", () => {
    // "not measured" and "scored zero" render differently on a gauge.
    const scores = parseScores({ lighthouseResult: { categories: { performance: {} } } });
    expect(scores.performance).toBeNull();
    expect(scores.seo).toBeNull();
  });

  it("survives a response with no lighthouseResult at all", () => {
    expect(parseScores({})).toEqual({
      performance: null,
      accessibility: null,
      bestPractices: null,
      seo: null,
    });
  });
});

// ─── Lab metrics ────────────────────────────────────────────────────────────

describe("parseMetrics", () => {
  const metrics = parseMetrics(WITH_CRUX);
  const byKey = Object.fromEntries(metrics.map((m) => [m.key, m]));

  it("returns all six metrics in a stable order", () => {
    expect(metrics.map((m) => m.key)).toEqual(["FCP", "LCP", "TBT", "CLS", "SI", "TTI"]);
  });

  it("keeps the raw numeric value and Lighthouse's own formatted string", () => {
    expect(byKey.LCP.value).toBeCloseTo(3104.8, 1);
    expect(byKey.LCP.display).toBe("3.1 s");
    expect(byKey.LCP.score).toBe(48);
  });

  it("does not confuse a real zero with a missing measurement", () => {
    // CLS legitimately reaches 0; an absent metric must be null instead.
    const zeroCls = parseMetrics({
      lighthouseResult: {
        audits: { "cumulative-layout-shift": { numericValue: 0, displayValue: "0" } },
      },
    });
    expect(zeroCls.find((m) => m.key === "CLS")!.value).toBe(0);
    expect(zeroCls.find((m) => m.key === "LCP")!.value).toBeNull();
  });
});

// ─── Opportunities ──────────────────────────────────────────────────────────

describe("parseOpportunities", () => {
  const opportunities = parseOpportunities(WITH_CRUX);

  it("selects audits by details.type and sorts by time saved", () => {
    expect(opportunities.map((o) => o.id)).toEqual([
      "unused-javascript", // 1150 ms
      "render-blocking-resources", // 620 ms
      "modern-image-formats", // 0 ms but 74 KiB
    ]);
  });

  it("keeps both savings dimensions", () => {
    const js = opportunities[0];
    expect(js.savingsMs).toBe(1150);
    expect(js.savingsBytes).toBe(319488);
    expect(js.display).toBe("Potential savings of 312 KiB");
  });

  it("drops opportunities with nothing to save", () => {
    // uses-long-cache-ttl is an opportunity-typed audit with 0/0 savings — a
    // to-do list item with no work in it is noise.
    expect(opportunities.map((o) => o.id)).not.toContain("uses-long-cache-ttl");
  });

  it("ignores non-opportunity audits entirely", () => {
    expect(opportunities.map((o) => o.id)).not.toContain("viewport");
    expect(opportunities.map((o) => o.id)).not.toContain("largest-contentful-paint");
  });
});

// ─── CrUX field data ────────────────────────────────────────────────────────

describe("parseCrux", () => {
  it("reads the page-level distributions when present", () => {
    const crux = parseCrux(WITH_CRUX)!;
    expect(crux).not.toBeNull();
    expect(crux.overall).toBe("AVERAGE");
    expect(crux.originFallback).toBe(false);
    expect(crux.metrics.map((m) => m.key).sort()).toEqual(["CLS", "INP", "LCP", "TTFB"]);
  });

  it("rescales CLS, which CrUX reports multiplied by 100", () => {
    // A percentile of 8 is a CLS of 0.08 — left raw it would render as a
    // catastrophic layout shift of 8 instead of an excellent one.
    const cls = parseCrux(WITH_CRUX)!.metrics.find((m) => m.key === "CLS")!;
    expect(cls.p75).toBeCloseTo(0.08, 5);
    expect(cls.category).toBe("FAST");
  });

  it("leaves millisecond metrics unscaled", () => {
    const lcp = parseCrux(WITH_CRUX)!.metrics.find((m) => m.key === "LCP")!;
    expect(lcp.p75).toBe(2814);
    expect(lcp.distribution).toEqual([0.61, 0.24, 0.15]);
  });

  it("returns null when the page has no field data", () => {
    // The normal case for a low-traffic page — the UI must say so rather than
    // render zeros.
    expect(parseCrux(NO_CRUX)).toBeNull();
    expect(parseCrux({})).toBeNull();
    expect(parseCrux({ loadingExperience: { metrics: {} } })).toBeNull();
  });

  it("falls back to origin data and flags that it did", () => {
    const crux = parseCrux({
      originLoadingExperience: {
        overall_category: "FAST",
        metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 1900, category: "FAST" } },
      },
    })!;
    expect(crux.originFallback).toBe(true);
    expect(crux.overall).toBe("FAST");
  });

  it("honours PSI's own origin_fallback flag on page-level data", () => {
    const crux = parseCrux({
      loadingExperience: {
        overall_category: "SLOW",
        origin_fallback: true,
        metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 5000, category: "SLOW" } },
      },
    })!;
    expect(crux.originFallback).toBe(true);
  });
});

// ─── Whole response ─────────────────────────────────────────────────────────

describe("parsePsiResponse", () => {
  it("assembles every section and carries the Lighthouse version", () => {
    const parsed = parsePsiResponse(WITH_CRUX);
    expect(parsed.scores.performance).toBe(62);
    expect(parsed.metrics).toHaveLength(6);
    expect(parsed.opportunities.length).toBeGreaterThan(0);
    expect(parsed.crux).not.toBeNull();
    expect(parsed.lighthouseVersion).toBe("12.2.1");
    expect(parsed.finalUrl).toBe("https://echorank360.com/");
  });

  it("produces a usable audit with no CrUX", () => {
    const parsed = parsePsiResponse(NO_CRUX);
    expect(parsed.crux).toBeNull();
    // Desktop is throttled far less, so it legitimately scores much higher.
    expect(parsed.scores.performance).toBe(93);
  });

  it("does not throw on junk", () => {
    expect(() => parsePsiResponse(null)).not.toThrow();
    expect(() => parsePsiResponse({ lighthouseResult: null })).not.toThrow();
    expect(parsePsiResponse(undefined).metrics).toHaveLength(6);
  });
});

// ─── Score / metric bands ───────────────────────────────────────────────────

describe("Lighthouse score bands", () => {
  it("uses Google's published 0-49 / 50-89 / 90-100 boundaries", () => {
    expect(scoreBand(0)).toBe("poor");
    expect(scoreBand(49)).toBe("poor");
    expect(scoreBand(50)).toBe("average");
    expect(scoreBand(89)).toBe("average");
    expect(scoreBand(90)).toBe("good");
    expect(scoreBand(100)).toBe("good");
    expect(scoreBand(null)).toBeNull();
  });

  it("bands Core Web Vitals on the web.dev thresholds", () => {
    expect(metricBand("LCP", 2500)).toBe("good");
    expect(metricBand("LCP", 2501)).toBe("average");
    expect(metricBand("LCP", 4001)).toBe("poor");
    expect(metricBand("CLS", 0.1)).toBe("good");
    expect(metricBand("CLS", 0.26)).toBe("poor");
    expect(metricBand("INP", 200)).toBe("good");
    expect(metricBand("unknown-metric", 1)).toBeNull();
    expect(metricBand("LCP", null)).toBeNull();
  });
});

// ─── URL validation ─────────────────────────────────────────────────────────

describe("normalizeAuditUrl", () => {
  it.each([
    ["https://example.com/pricing", "https://example.com/pricing"],
    ["example.com", "https://example.com/"],
    ["example.com/a?b=1", "https://example.com/a?b=1"],
    ["http://example.com/a", "http://example.com/a"],
    ["  https://Example.com/Path  ", "https://example.com/Path"],
    ["https://www.example.com/a#top", "https://www.example.com/a"],
  ])("normalizes %j -> %j", (input, expected) => {
    expect(normalizeAuditUrl(input)).toBe(expected);
  });

  it("keeps the path and scheme, because they are what is being audited", () => {
    // Unlike the domain tools, "/" and "/pricing" are different subjects with
    // legitimately different scores and must not collapse.
    expect(normalizeAuditUrl("https://example.com/")).not.toBe(
      normalizeAuditUrl("https://example.com/pricing"),
    );
    // www. is NOT stripped: it can serve a different page.
    expect(normalizeAuditUrl("https://www.example.com/")).not.toBe(
      normalizeAuditUrl("https://example.com/"),
    );
  });

  it("drops the fragment, which cannot change what Lighthouse measures", () => {
    expect(normalizeAuditUrl("https://example.com/a#one")).toBe(
      normalizeAuditUrl("https://example.com/a#two"),
    );
  });

  it.each([
    "http://localhost:3000/",
    "https://127.0.0.1/",
    "https://192.168.1.10/",
    "https://10.0.0.5/",
    "https://myserver/",
    "https://api.internal/",
    "https://box.local/",
  ])("rejects %j as not publicly reachable", (input) => {
    expect(() => normalizeAuditUrl(input)).toThrow(/not reachable from the public internet/);
  });

  it.each(["", "   ", "ftp://example.com/x", "not a url", "https://exa mple.com/"])(
    "rejects %j as malformed",
    (input) => {
      expect(() => normalizeAuditUrl(input)).toThrow();
    },
  );

  it("isValidAuditUrl mirrors normalizeAuditUrl without throwing", () => {
    expect(isValidAuditUrl("https://example.com/a")).toBe(true);
    expect(isValidAuditUrl("http://localhost/")).toBe(false);
    expect(isValidAuditUrl("")).toBe(false);
  });
});

describe("fixtureKeyFor", () => {
  it("produces a filesystem-safe key that separates the two strategies", () => {
    expect(fixtureKeyFor("https://example.com/a?b=1", "mobile")).toBe("example.com-a-b-1-mobile");
    expect(fixtureKeyFor("https://example.com/", "mobile")).not.toBe(
      fixtureKeyFor("https://example.com/", "desktop"),
    );
  });
});
