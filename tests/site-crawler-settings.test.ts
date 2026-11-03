// A decrypted CrawlConfig → request options, URL admission, robots.txt to obey.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CRAWLER_USER_AGENT } from "@/lib/site-crawler/constants";
import { DEFAULT_CRAWL_CONFIG, GOOGLEBOT_UA, type RuntimeCrawlConfig } from "@/lib/site-crawler/crawl-config";
import { crawlSettings, resolveRobots } from "@/lib/site-crawler/crawl-settings";
import { allowAllRules, rulesFromBody } from "@/lib/site-crawler/robots";

const ROOT = "https://example.com/";
const cfg = (over: Partial<RuntimeCrawlConfig> = {}): RuntimeCrawlConfig => ({ ...DEFAULT_CRAWL_CONFIG, ...over });

describe("crawlSettings", () => {
  it("defaults: the crawler's own UA, no credentials, subdomains in scope", () => {
    const s = crawlSettings(cfg(), ROOT);
    expect(s.userAgent).toBe(CRAWLER_USER_AGENT);
    expect(s.fetchOpts).toEqual({ userAgent: CRAWLER_USER_AGENT });
    expect(s.admit("https://blog.example.com/a")).toBe("https://blog.example.com/a");
    expect(s.admit("https://other.com/")).toBeNull();
  });

  it.each([
    [{ crawlSubdomains: false }, "https://blog.example.com/a", null],
    [{ include: ["/blog/*"] }, "https://example.com/shop", null],
    [{ exclude: ["*/tag/*"] }, "https://example.com/tag/x", null],
    [{ queryStrings: "strip_all" as const }, "https://example.com/p?id=1", "https://example.com/p"],
    [{ queryStrings: "strip_listed" as const, stripParams: ["sort"] }, "https://example.com/p?id=1&sort=a", "https://example.com/p?id=1"],
  ])("%o admits %s as %s", (over, url, expected) => {
    expect(crawlSettings(cfg(over), ROOT).admit(url)).toBe(expected);
  });

  it("Googlebot sends Google's UA and obeys the Googlebot group", () => {
    const s = crawlSettings(cfg({ userAgent: "googlebot_smartphone" }), ROOT);
    expect(s.userAgent).toBe(GOOGLEBOT_UA.googlebot_smartphone);
    expect(s.agent).toBe("Googlebot");
  });

  it("credentials become headers, sent to the crawled site only", () => {
    const s = crawlSettings(
      cfg({ headers: [{ name: "X-Preview", value: "1" }], cookies: "a=b", basicAuth: { user: "u", password: "p" } }),
      ROOT,
    );
    expect(s.fetchOpts.extraHeaders).toEqual({ "x-preview": "1", cookie: "a=b", authorization: `Basic ${Buffer.from("u:p").toString("base64")}` });
    expect(s.fetchOpts.credentialsFor!("https://example.com/x")).toBe(true);
    expect(s.fetchOpts.credentialsFor!("https://evil.test/x")).toBe(false);
  });
});

describe("resolveRobots", () => {
  const URL_ = "https://example.com/robots.txt";
  const live = rulesFromBody("User-agent: *\nDisallow: /private\nSitemap: https://example.com/s.xml", URL_);
  const draft = "User-agent: *\nDisallow: /blog";

  it("no draft: obey the live file", () => {
    expect(resolveRobots(live, cfg(), URL_, "Echorank360Bot")).toEqual({ obey: live, test: null });
  });

  it("test mode: obey live, judge the draft", () => {
    const { obey, test } = resolveRobots(live, cfg({ customRobots: draft, customRobotsMode: "test" }), URL_, "Echorank360Bot");
    expect(obey.isAllowed("https://example.com/blog/a")).toBe(true);
    expect(test!.isAllowed("https://example.com/blog/a")).toBe(false);
    expect(test!.matchLine("https://example.com/blog/a")).toBe(2);
  });

  it("replace mode: obey the draft, keep the live sitemaps", () => {
    const { obey, test } = resolveRobots(live, cfg({ customRobots: draft, customRobotsMode: "replace" }), URL_, "Echorank360Bot");
    expect(test).toBeNull();
    expect(obey.isAllowed("https://example.com/private")).toBe(true);
    expect(obey.isAllowed("https://example.com/blog")).toBe(false);
    expect(obey.sitemaps).toEqual(["https://example.com/s.xml"]);
  });

  it("respectRobots off: everything allowed, sitemaps still read", () => {
    const { obey } = resolveRobots(live, cfg({ respectRobots: false }), URL_, "Echorank360Bot");
    expect(obey.isAllowed("https://example.com/private")).toBe(true);
    expect(obey.crawlDelaySeconds).toBe(0);
    expect(obey.sitemaps).toEqual(["https://example.com/s.xml"]);
    expect(allowAllRules().matchLine("x")).toBeNull();
  });
});
