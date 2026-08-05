// Sitemap parsing, index recursion, caps — and the normalizer parity that
// orphan detection depends on.
//
// THE PARITY TEST IS THE IMPORTANT ONE. Orphan detection is a set difference
// between sitemap URLs and crawled URLs. If the two sides spell the same page
// differently — one with a trailing slash, one without — every page on the
// site reports as an orphan. That is a wrong answer delivered confidently,
// which is worse than a crash.
import { describe, expect, it, vi } from "vitest";
import {
  collectSitemapUrls,
  decodeXmlEntities,
  parseSitemapXml,
} from "@/lib/site-crawler/sitemap";
import { normalizeCrawlUrl } from "@/lib/site-crawler/url";
import { MAX_SITEMAP_FILES, MAX_SITEMAP_URLS } from "@/lib/site-crawler/constants";

const ROOT = "https://example.com/";
const limiter = { acquire: async () => {} };

function urlset(urls: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${u}</loc><lastmod>2026-01-01</lastmod></url>`).join("\n")}
</urlset>`;
}

function sitemapindex(urls: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<sitemap><loc>${u}</loc></sitemap>`).join("\n")}
</sitemapindex>`;
}

describe("parseSitemapXml", () => {
  it("reads <loc> values from a urlset", () => {
    const parsed = parseSitemapXml(urlset(["https://example.com/a", "https://example.com/b"]));
    expect(parsed.isIndex).toBe(false);
    expect(parsed.locs).toEqual(["https://example.com/a", "https://example.com/b"]);
  });

  it("recognises a sitemap index", () => {
    const parsed = parseSitemapXml(sitemapindex(["https://example.com/s1.xml"]));
    expect(parsed.isIndex).toBe(true);
    expect(parsed.locs).toEqual(["https://example.com/s1.xml"]);
  });

  it("survives malformed XML, returning what it could read", () => {
    // A file we do not control must never throw here.
    const broken = `<urlset><url><loc>https://example.com/a</loc></url><url><loc>https://exa`;
    expect(() => parseSitemapXml(broken)).not.toThrow();
    expect(parseSitemapXml(broken).locs).toEqual(["https://example.com/a"]);
  });

  it("returns nothing for an empty or non-XML body", () => {
    expect(parseSitemapXml("").locs).toEqual([]);
    expect(parseSitemapXml("<html><body>not a sitemap</body></html>").locs).toEqual([]);
  });

  it("decodes the XML entities that appear in URLs", () => {
    expect(decodeXmlEntities("a&amp;b")).toBe("a&b");
    const parsed = parseSitemapXml(urlset(["https://example.com/a?x=1&amp;y=2"]));
    expect(parsed.locs[0]).toBe("https://example.com/a?x=1&y=2");
  });

  it("tolerates whitespace inside <loc>", () => {
    expect(parseSitemapXml("<urlset><url><loc>\n  https://example.com/a\n </loc></url></urlset>").locs)
      .toEqual(["https://example.com/a"]);
  });
});

describe("normalizer parity", () => {
  it("spells sitemap URLs exactly as the frontier would", () => {
    const raw = [
      "https://EXAMPLE.com/a/",
      "https://example.com/b?utm_source=news&id=2",
      "https://example.com/c#section",
      "https://example.com:443/d",
    ];
    const fetchFile = vi.fn(async () => urlset(raw));

    return collectSitemapUrls({ rootUrl: ROOT, declared: [], limiter, fetchFile }).then((r) => {
      // Whatever the sitemap wrote, both sides agree on the spelling.
      for (const original of raw) {
        expect(r.urls).toContain(normalizeCrawlUrl(original));
      }
      expect(r.urls).toContain("https://example.com/a");
      expect(r.urls).toContain("https://example.com/b?id=2");
      expect(r.urls).toContain("https://example.com/c");
      expect(r.urls).toContain("https://example.com/d");
    });
  });

  it("dedupes URLs that normalize to the same page", () => {
    const fetchFile = vi.fn(async () =>
      urlset(["https://example.com/a", "https://example.com/a/", "https://example.com/a?utm_source=x"]),
    );
    return collectSitemapUrls({ rootUrl: ROOT, declared: [], limiter, fetchFile }).then((r) => {
      expect(r.urls).toEqual(["https://example.com/a"]);
    });
  });
});

describe("collectSitemapUrls", () => {
  it("falls back to /sitemap.xml when robots declared none", async () => {
    const fetchFile = vi.fn(async () => urlset(["https://example.com/a"]));
    const result = await collectSitemapUrls({ rootUrl: ROOT, declared: [], limiter, fetchFile });

    expect(fetchFile).toHaveBeenCalledWith("https://example.com/sitemap.xml");
    expect(result.found).toBe(true);
    expect(result.urls).toEqual(["https://example.com/a"]);
  });

  it("prefers the sitemaps robots.txt declared", async () => {
    const fetchFile = vi.fn(async () => urlset(["https://example.com/a"]));
    await collectSitemapUrls({
      rootUrl: ROOT,
      declared: ["https://example.com/custom-sitemap.xml"],
      limiter,
      fetchFile,
    });
    expect(fetchFile).toHaveBeenCalledWith("https://example.com/custom-sitemap.xml");
    expect(fetchFile).not.toHaveBeenCalledWith("https://example.com/sitemap.xml");
  });

  it("recurses into an index file", async () => {
    const fetchFile = vi.fn(async (url: string) =>
      url.includes("index")
        ? sitemapindex(["https://example.com/s1.xml", "https://example.com/s2.xml"])
        : urlset([`${url.replace(".xml", "")}/page`]),
    );

    const result = await collectSitemapUrls({
      rootUrl: ROOT,
      declared: ["https://example.com/index.xml"],
      limiter,
      fetchFile,
    });

    expect(result.filesFetched).toBe(3); // index + two children
    expect(result.urls).toHaveLength(2);
  });

  it("reports not-found when nothing could be fetched", async () => {
    const result = await collectSitemapUrls({
      rootUrl: ROOT,
      declared: [],
      limiter,
      fetchFile: async () => null,
    });
    expect(result.found).toBe(false);
    expect(result.urls).toEqual([]);
  });

  it("stops at the sitemap-file cap and says it truncated", async () => {
    // An index listing 100 children must cost ten fetches, not a hundred.
    const children = Array.from({ length: 100 }, (_, i) => `https://example.com/s${i}.xml`);
    const fetchFile = vi.fn(async (url: string) =>
      url.includes("index") ? sitemapindex(children) : urlset([`https://example.com/p${url.length}`]),
    );

    const result = await collectSitemapUrls({
      rootUrl: ROOT,
      declared: ["https://example.com/index.xml"],
      limiter,
      fetchFile,
    });

    expect(result.filesFetched).toBeLessThanOrEqual(MAX_SITEMAP_FILES);
    expect(result.truncated).toBe(true);
  });

  it("stops at the URL cap", async () => {
    const many = Array.from({ length: MAX_SITEMAP_URLS + 500 }, (_, i) => `https://example.com/p${i}`);
    const result = await collectSitemapUrls({
      rootUrl: ROOT,
      declared: [],
      limiter,
      fetchFile: async () => urlset(many),
    });

    expect(result.urls.length).toBeLessThanOrEqual(MAX_SITEMAP_URLS);
    expect(result.truncated).toBe(true);
  });

  it("drops out-of-scope URLs — a sitemap cannot widen the crawl", async () => {
    const result = await collectSitemapUrls({
      rootUrl: ROOT,
      declared: [],
      limiter,
      fetchFile: async () =>
        urlset([
          "https://example.com/mine",
          "https://blog.example.com/also-mine",
          "https://elsewhere.com/theirs",
        ]),
    });

    expect(result.urls).toContain("https://example.com/mine");
    expect(result.urls).toContain("https://blog.example.com/also-mine");
    expect(result.urls.some((u) => u.includes("elsewhere.com"))).toBe(false);
  });

  it("refuses to follow an index entry pointing off-domain", async () => {
    const fetchFile = vi.fn(async (url: string) =>
      url.includes("index") ? sitemapindex(["https://evil.com/s.xml"]) : urlset([]),
    );
    await collectSitemapUrls({
      rootUrl: ROOT,
      declared: ["https://example.com/index.xml"],
      limiter,
      fetchFile,
    });
    expect(fetchFile).not.toHaveBeenCalledWith("https://evil.com/s.xml");
  });

  it("paces itself through the shared rate limiter", async () => {
    const acquire = vi.fn(async () => {});
    await collectSitemapUrls({
      rootUrl: ROOT,
      declared: [],
      limiter: { acquire },
      fetchFile: async () => urlset(["https://example.com/a"]),
    });
    // Sitemap fetches are requests too; they obey the same 2 req/s.
    expect(acquire).toHaveBeenCalled();
  });
});
