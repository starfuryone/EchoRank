// Crawl configuration (Phase 4a): patterns, the regex guard, query-string
// modes, verified-site gating, and secrets that never come back out.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CrawlConfigInputSchema,
  applyQueryMode,
  checkCrawlConfig,
  compilePattern,
  robotsToken,
  unsafeRegex,
  urlFilter,
  viewCrawlConfig,
} from "@/lib/site-crawler/crawl-config";
import { MissingKeptSecretError, openCrawlConfig, sealCrawlConfig } from "@/lib/site-crawler/crawl-config-secrets";

const KEY = "test-key-not-a-secret";
const input = (over: Record<string, unknown> = {}) => CrawlConfigInputSchema.parse(over);

describe("patterns", () => {
  it.each([
    ["/blog/*", "https://x.com/blog/a", true],
    ["/blog/*", "https://x.com/shop/a", false],
    ["*.pdf", "https://x.com/a.PDF", true],
    ["page-?", "https://x.com/page-2", true],
    ["/\\/p\\/\\d+$/", "https://x.com/p/42", true],
    ["/\\/p\\/\\d+$/", "https://x.com/p/42/edit", false],
    ["/TAG/i", "https://x.com/tag/seo", true],
  ])("%s on %s → %s", (pattern, url, expected) => {
    const c = compilePattern(pattern);
    expect(c.ok && c.test(url)).toBe(expected);
  });

  it.each([
    ["/(a+)+$/", "unsafe_regex"],
    ["/(x|xx)*y/", "unsafe_regex"],
    ["/(.)\\1/", "unsafe_regex"],
    ["/[unclosed/", "invalid_regex"],
    ["", "empty"],
    ["a".repeat(201), "too_long"],
  ])("rejects %s (%s)", (pattern, reason) => {
    expect(compilePattern(pattern)).toEqual({ ok: false, reason });
  });

  it("leaves linear regexes alone", () => {
    for (const ok of ["^/a/(b|c)/", "\\d{2,4}", "[(]+x", "(abc)?d"]) expect(unsafeRegex(ok), ok).toBe(false);
  });

  it("include narrows, exclude wins", () => {
    const f = urlFilter(["/blog/*"], ["*?page=*"]);
    expect(f("https://x.com/blog/a")).toBe(true);
    expect(f("https://x.com/blog/a?page=2")).toBe(false);
    expect(f("https://x.com/about")).toBe(false);
    expect(urlFilter([], [])("https://x.com/anything")).toBe(true);
  });
});

describe("query strings", () => {
  it.each([
    ["keep", [], "https://x.com/a?b=1&c=2"],
    ["strip_all", [], "https://x.com/a"],
    ["strip_listed", ["C", "sort"], "https://x.com/a?b=1"],
  ] as const)("%s", (mode, params, expected) => {
    expect(applyQueryMode("https://x.com/a?b=1&c=2", mode, params)).toBe(expected);
  });
});

describe("user agents", () => {
  it.each([
    ["echorank", null, "Echorank360Bot"],
    ["googlebot_smartphone", null, "Googlebot"],
    ["googlebot_desktop", null, "Googlebot"],
    ["custom", "AcmeAudit/2.0 (+https://acme.example)", "AcmeAudit"],
  ] as const)("%s obeys the %s robots.txt group", (choice, custom, token) => {
    expect(robotsToken(choice, custom, "Echorank360Bot")).toBe(token);
  });
});

describe("checkCrawlConfig", () => {
  it("clamps max URLs to the plan cap without complaint", () => {
    expect(checkCrawlConfig(input({ maxUrls: 99_999 }), { urlCap: 2_500, verified: false })).toMatchObject({
      config: { maxUrls: 2_500 },
      problems: [],
    });
  });

  it.each([
    [{ userAgent: "googlebot_desktop" }, "userAgent"],
    [{ respectRobots: false }, "respectRobots"],
  ])("%o needs a verified site", (over, field) => {
    expect(checkCrawlConfig(input(over), { urlCap: 100, verified: false }).problems).toEqual([
      { field, code: "requires_verified_site" },
    ]);
    expect(checkCrawlConfig(input(over), { urlCap: 100, verified: true }).problems).toEqual([]);
  });

  it("allows a custom robots.txt on any site (test mode when unverified)", () => {
    expect(checkCrawlConfig(input({ customRobots: "User-agent: *\nDisallow: /x" }), { urlCap: 100, verified: false }).problems).toEqual([]);
  });

  it.each(["Host", "Cookie", "Authorization", "Proxy-Authorization", "Sec-Fetch-Mode", "User-Agent"])(
    "refuses the reserved header %s",
    (name) => {
      const out = checkCrawlConfig(input({ headers: [{ name, value: "v" }] }), { urlCap: 100, verified: true });
      expect(out.problems).toEqual([{ field: "headers", code: "reserved_header", name }]);
    },
  );

  it("reports bad patterns with their reason", () => {
    expect(checkCrawlConfig(input({ exclude: ["/(a+)+/"] }), { urlCap: 100, verified: true }).problems).toEqual([
      { field: "exclude", code: "invalid_pattern", pattern: "/(a+)+/", reason: "unsafe_regex" },
    ]);
  });

  it("rejects header values and cookies carrying a line break", () => {
    expect(CrawlConfigInputSchema.safeParse({ cookies: "a=1\r\nX-Evil: 1" }).success).toBe(false);
    expect(CrawlConfigInputSchema.safeParse({ headers: [{ name: "X-A", value: "1\n2" }] }).success).toBe(false);
  });

  it.each([{ speed: 0.25 }, { speed: 3 }, { maxDepth: -1 }, { include: Array(21).fill("x") }])("rejects %o", (over) => {
    expect(CrawlConfigInputSchema.safeParse(over).success).toBe(false);
  });
});

describe("secrets", () => {
  const withSecrets = input({
    headers: [{ name: "X-Preview", value: "tok-123" }],
    cookies: "session=abc",
    basicAuth: { user: "staging", password: "hunter2" },
  });

  it("are stored encrypted, open back to the same values, and are never shown", () => {
    const stored = sealCrawlConfig(withSecrets, null, KEY);
    const json = JSON.stringify(stored);
    for (const plain of ["tok-123", "session=abc", "hunter2"]) expect(json).not.toContain(plain);
    expect(openCrawlConfig(stored, KEY)).toMatchObject({
      headers: [{ name: "X-Preview", value: "tok-123" }],
      cookies: "session=abc",
      basicAuth: { user: "staging", password: "hunter2" },
    });
    const view = JSON.stringify(viewCrawlConfig(stored));
    expect(view).not.toContain("enc");
    expect(viewCrawlConfig(stored)).toMatchObject({ cookies: { set: true }, basicAuth: { user: "staging", password: { set: true } } });
  });

  it("{ keep: true } reuses the saved ciphertext, and fails when nothing is saved", () => {
    const saved = sealCrawlConfig(withSecrets, null, KEY);
    const again = sealCrawlConfig(input({ cookies: { keep: true }, headers: [{ name: "x-preview", value: { keep: true } }] }), saved, KEY);
    expect(again.cookies).toEqual(saved.cookies);
    expect(again.headers[0]!.value).toEqual(saved.headers[0]!.value);
    expect(() => sealCrawlConfig(input({ cookies: { keep: true } }), null, KEY)).toThrow(MissingKeptSecretError);
  });
});
