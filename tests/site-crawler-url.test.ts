// URL normalization and scope — the two rules that decide what the crawler
// fetches, and therefore whether a crawl terminates.
//
// Getting normalization wrong does not produce a wrong answer; it produces an
// unbounded crawl of the same page under different spellings. That is the
// failure these tests exist for.
import { describe, expect, it } from "vitest";
import {
  isFetchableUrl,
  isInScope,
  isTrackingParam,
  looksLikeNonHtml,
  normalizeCrawlUrl,
  validateRootUrl,
} from "@/lib/site-crawler/url";

describe("normalizeCrawlUrl", () => {
  it("lowercases the host but preserves path case", () => {
    // /About and /about are different resources on most servers; folding them
    // would silently skip one.
    expect(normalizeCrawlUrl("https://EXAMPLE.com/About")).toBe("https://example.com/About");
  });

  it("drops the fragment", () => {
    expect(normalizeCrawlUrl("https://example.com/a#section")).toBe("https://example.com/a");
  });

  it("strips a trailing slash except on the root", () => {
    expect(normalizeCrawlUrl("https://example.com/a/")).toBe("https://example.com/a");
    expect(normalizeCrawlUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("removes tracking parameters and keeps real ones", () => {
    const out = normalizeCrawlUrl(
      "https://example.com/p?utm_source=x&utm_medium=y&gclid=z&fbclid=q&id=7",
    );
    expect(out).toBe("https://example.com/p?id=7");
  });

  it("sorts query parameters so one page is one entry", () => {
    expect(normalizeCrawlUrl("https://example.com/p?b=2&a=1")).toBe(
      normalizeCrawlUrl("https://example.com/p?a=1&b=2"),
    );
  });

  it("drops default ports", () => {
    expect(normalizeCrawlUrl("http://example.com:80/a")).toBe("http://example.com/a");
    expect(normalizeCrawlUrl("https://example.com:443/a")).toBe("https://example.com/a");
  });

  it("resolves relative links against the page they were found on", () => {
    expect(normalizeCrawlUrl("/b", "https://example.com/a/c")).toBe("https://example.com/b");
    expect(normalizeCrawlUrl("d", "https://example.com/a/c")).toBe("https://example.com/a/d");
  });

  it("refuses non-HTTP schemes", () => {
    for (const href of [
      "mailto:a@b.com",
      "tel:+41000",
      "javascript:alert(1)",
      "data:text/html,x",
      "ftp://example.com/f",
    ]) {
      expect(normalizeCrawlUrl(href), href).toBeNull();
    }
  });

  it("refuses junk and over-long URLs", () => {
    expect(normalizeCrawlUrl("")).toBeNull();
    expect(normalizeCrawlUrl("not a url")).toBeNull();
    expect(normalizeCrawlUrl(`https://example.com/${"x".repeat(2100)}`)).toBeNull();
  });
});

describe("isTrackingParam", () => {
  it("matches utm_* by prefix and the known click ids exactly", () => {
    for (const p of ["utm_source", "UTM_Campaign", "gclid", "fbclid", "msclkid"]) {
      expect(isTrackingParam(p), p).toBe(true);
    }
    for (const p of ["id", "page", "q", "utmsource"]) {
      expect(isTrackingParam(p), p).toBe(false);
    }
  });
});

describe("isInScope", () => {
  const root = "https://example.com/";

  it("accepts the same host", () => {
    expect(isInScope("https://example.com/a", root)).toBe(true);
  });

  it("accepts subdomains, per spec", () => {
    expect(isInScope("https://blog.example.com/a", root)).toBe(true);
    expect(isInScope("https://deep.blog.example.com/a", root)).toBe(true);
  });

  it("rejects other registrable domains", () => {
    expect(isInScope("https://example.org/a", root)).toBe(false);
    expect(isInScope("https://other.com/a", root)).toBe(false);
  });

  it("rejects a lookalike that merely ends with the root", () => {
    // The bug a naive endsWith() check ships with.
    expect(isInScope("https://evil-example.com/a", root)).toBe(false);
    expect(isInScope("https://notexample.com/a", root)).toBe(false);
  });

  it("handles multi-label public suffixes", () => {
    expect(isInScope("https://shop.acme.co.uk/x", "https://acme.co.uk/")).toBe(true);
    expect(isInScope("https://acme.co.uk/x", "https://other.co.uk/")).toBe(false);
  });

  it("matches across scheme and subdomain of the root itself", () => {
    expect(isInScope("http://www.example.com/a", "https://example.com/")).toBe(true);
  });
});

describe("looksLikeNonHtml", () => {
  it("skips assets by extension before they cost a request", () => {
    for (const p of ["/a.pdf", "/i.PNG", "/s.css", "/b.js", "/f.woff2", "/v.mp4", "/d.zip"]) {
      expect(looksLikeNonHtml(p), p).toBe(true);
    }
    for (const p of ["/", "/about", "/a.html", "/products/1"]) {
      expect(looksLikeNonHtml(p), p).toBe(false);
    }
  });
});

describe("validateRootUrl (SSRF surface)", () => {
  it("accepts a public https URL", () => {
    const r = validateRootUrl("https://example.com");
    expect(r.ok).toBe(true);
    expect(r.url).toBe("https://example.com/");
  });

  it("accepts a bare hostname the way other URL fields do", () => {
    expect(validateRootUrl("example.com").ok).toBe(true);
  });

  it("rejects loopback, private ranges and cloud metadata", () => {
    for (const u of [
      "http://localhost/",
      "http://127.0.0.1/",
      "http://10.0.0.5/",
      "http://192.168.1.1/",
      "http://172.16.4.4/",
      "http://169.254.169.254/",
      "http://[::1]/",
    ]) {
      expect(validateRootUrl(u).ok, u).toBe(false);
    }
  });

  it("rejects internal-only hostnames", () => {
    for (const u of ["http://box.internal/", "http://nas.local/", "http://intranet/"]) {
      expect(validateRootUrl(u).ok, u).toBe(false);
    }
  });

  it("rejects non-HTTP schemes, credentials and odd ports", () => {
    expect(validateRootUrl("file:///etc/passwd").ok).toBe(false);
    expect(validateRootUrl("https://user:pw@example.com/").ok).toBe(false);
    expect(validateRootUrl("https://example.com:22/").ok).toBe(false);
  });
});

describe("isFetchableUrl (per-link guard)", () => {
  it("passes ordinary public pages", () => {
    expect(isFetchableUrl("https://example.com/a")).toBe(true);
  });

  it("blocks a same-domain link that points at a private address", () => {
    // Scope alone would not catch this: the crawler must refuse the socket.
    expect(isFetchableUrl("http://10.1.2.3/admin")).toBe(false);
    expect(isFetchableUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isFetchableUrl("https://user:pw@example.com/")).toBe(false);
    expect(isFetchableUrl("https://example.com:8080/")).toBe(false);
  });
});
