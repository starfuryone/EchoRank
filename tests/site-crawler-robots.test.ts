// robots.txt: allow/deny for our UA, and the Crawl-delay clamp.
//
// The posture worth testing explicitly is the failure branch. A 404 means "no
// rules, crawl away". A timeout or a 5xx means "we asked and got no answer",
// which this treats as disallow-all — guessing permission from a server error
// is how a crawler hammers a site that was shedding load.
import { describe, expect, it } from "vitest";
import {
  allowAllRules,
  clampCrawlDelay,
  denyAllRules,
  rulesFromBody,
  MAX_CRAWL_DELAY_SECONDS,
} from "@/lib/site-crawler/robots";
import { CRAWLER_USER_AGENT } from "@/lib/site-crawler/constants";

const ROBOTS_URL = "https://example.com/robots.txt";

describe("clampCrawlDelay", () => {
  it("honors a delay a site asks for", () => {
    expect(clampCrawlDelay(3)).toBe(3);
    expect(clampCrawlDelay("5")).toBe(5);
  });

  it("clamps anything past the ceiling", () => {
    // A 30s delay would cap a 500-URL crawl at four hours, past the wall clock.
    expect(clampCrawlDelay(30)).toBe(MAX_CRAWL_DELAY_SECONDS);
    expect(clampCrawlDelay(3600)).toBe(MAX_CRAWL_DELAY_SECONDS);
  });

  it("treats missing, zero, negative and junk as no delay", () => {
    for (const v of [undefined, null, 0, -5, "abc", NaN]) {
      expect(clampCrawlDelay(v), String(v)).toBe(0);
    }
  });
});

describe("rulesFromBody", () => {
  it("honors a wildcard disallow", () => {
    const rules = rulesFromBody("User-agent: *\nDisallow: /private/", ROBOTS_URL);
    expect(rules.isAllowed("https://example.com/private/x")).toBe(false);
    expect(rules.isAllowed("https://example.com/public/x")).toBe(true);
  });

  it("honors a rule aimed at our user agent specifically", () => {
    const body = [
      "User-agent: *",
      "Disallow:",
      "",
      `User-agent: ${CRAWLER_USER_AGENT.split("/")[0]}`,
      "Disallow: /no-echorank/",
    ].join("\n");
    const rules = rulesFromBody(body, ROBOTS_URL);
    expect(rules.isAllowed("https://example.com/no-echorank/page")).toBe(false);
    expect(rules.isAllowed("https://example.com/elsewhere")).toBe(true);
  });

  it("applies Allow exceptions inside a disallowed tree", () => {
    const rules = rulesFromBody(
      "User-agent: *\nDisallow: /docs/\nAllow: /docs/public/",
      ROBOTS_URL,
    );
    expect(rules.isAllowed("https://example.com/docs/secret")).toBe(false);
    expect(rules.isAllowed("https://example.com/docs/public/a")).toBe(true);
  });

  it("blocks everything under Disallow: /", () => {
    const rules = rulesFromBody("User-agent: *\nDisallow: /", ROBOTS_URL);
    expect(rules.isAllowed("https://example.com/")).toBe(false);
    expect(rules.isAllowed("https://example.com/anything")).toBe(false);
  });

  it("reads and clamps Crawl-delay", () => {
    expect(rulesFromBody("User-agent: *\nCrawl-delay: 4", ROBOTS_URL).crawlDelaySeconds).toBe(4);
    expect(rulesFromBody("User-agent: *\nCrawl-delay: 99", ROBOTS_URL).crawlDelaySeconds).toBe(
      MAX_CRAWL_DELAY_SECONDS,
    );
  });

  it("allows everything when the file has no rules", () => {
    const rules = rulesFromBody("# just a comment", ROBOTS_URL);
    expect(rules.isAllowed("https://example.com/a")).toBe(true);
  });
});

describe("failure posture", () => {
  it("allowAllRules permits everything — the 404 branch", () => {
    const rules = allowAllRules();
    expect(rules.allowAll).toBe(true);
    expect(rules.isAllowed("https://example.com/anything")).toBe(true);
    expect(rules.crawlDelaySeconds).toBe(0);
  });

  it("denyAllRules permits nothing — the timeout/5xx branch", () => {
    const rules = denyAllRules();
    expect(rules.allowAll).toBe(false);
    expect(rules.isAllowed("https://example.com/")).toBe(false);
  });
});
