// List mode (Phase 4a): what counts as a URL line in a paste or an upload.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseUrlList } from "@/lib/site-crawler/url-list";
import { keptInListMode } from "@/lib/site-crawler/aggregate";

describe("parseUrlList", () => {
  it.each([
    ["one per line", "https://a.example/\nhttps://b.example/x", ["https://a.example/", "https://b.example/x"]],
    ["CSV: first column, header row dropped", 'url,status\n"https://a.example/q?x=1,2",200\nhttps://b.example/,404', ["https://a.example/q?x=1,2", "https://b.example/"]],
    ["blank lines, comments and duplicates", "\n# old\nhttps://a.example/\n\nhttps://a.example/\r\n", ["https://a.example/"]],
    ["tab and semicolon separated", "https://a.example/\tx\nhttps://b.example/;y", ["https://a.example/", "https://b.example/"]],
  ])("%s", (_name, text, expected) => {
    expect(parseUrlList(text)).toEqual(expected);
  });
});

describe("list mode skips link-graph rules", () => {
  it.each([
    ["links.orphan", false],
    ["sitemaps.page_not_in_sitemap", false],
    ["response_codes.inlinks_to_3xx", false],
    ["hreflang.missing_on_multilingual_site", false],
    ["page_titles.duplicate", true],
    ["canonicals.to_redirect", true],
    ["response_codes.redirect_loop", true],
  ])("%s kept: %s", (id, kept) => {
    expect(keptInListMode(id)).toBe(kept);
  });
});
