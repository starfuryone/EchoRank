// Phase 4a crawler UI: the configuration draft → API input (secrets kept, never
// echoed), the sitemap link, and the crawl tools / Pages column / Inlinks panel
// rendered in every dashboard locale with no missing string.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// The 4a flags as they ship with this sub-phase (flipped in flags.ts by its last commit).
vi.mock("@/lib/flags", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/flags")>();
  const on = { ...real.FLAGS, "crawl.config": true, "crawl.links": true, "crawl.listMode": true, "crawl.sitemapGen": true, "crawl.customRobots": true };
  return { ...real, FLAGS: on, flag: (name: keyof typeof on) => on[name] };
});

import { SITE_CRAWLER_COPY, type DashLocale } from "@/lib/i18n/dashboard";
import { problemText, toInput } from "@/components/seo-tools/site-crawler-config";
import { CrawlTools, sitemapHref } from "@/components/seo-tools/site-crawler-crawl-tools";
import { PagesPanel } from "@/components/seo-tools/site-crawler-panels";
import { CrawlConfigInputSchema, checkCrawlConfig } from "@/lib/site-crawler/crawl-config";
import { EMPTY_PAGE_FILTERS, type CrawlDto } from "@/lib/site-crawler/types";

const LOCALES: DashLocale[] = ["en", "fr", "de-CH"];
type DraftArg = Parameters<typeof toInput>[0];

const draft = (over: Partial<DraftArg> = {}): DraftArg => ({
  maxUrls: "",
  maxDepth: "",
  include: "",
  exclude: "",
  crawlSubdomains: true,
  followNofollow: false,
  queryStrings: "keep",
  stripParams: "",
  speed: "2",
  userAgent: "echorank",
  customUserAgent: "",
  headers: [],
  cookies: "",
  cookiesSaved: false,
  basicUser: "",
  basicPassword: "",
  basicSaved: false,
  respectRobots: true,
  customRobots: "",
  extractors: [],
  searches: [],
  js: [],
  useLogin: false,
  ...over,
});

describe("configuration draft → API input", () => {
  it("the empty draft is the server's defaults and validates", () => {
    const input = toInput(draft());
    expect(CrawlConfigInputSchema.parse(input)).toEqual(CrawlConfigInputSchema.parse({}));
    expect(checkCrawlConfig(CrawlConfigInputSchema.parse(input), { urlCap: 100, verified: false }).problems).toEqual([]);
  });

  it("parses lines, numbers and the parameter list", () => {
    expect(toInput(draft({ maxUrls: "300", maxDepth: "4", include: "/blog/*\n\n/news/*", queryStrings: "strip_listed", stripParams: "sort, page" }))).toMatchObject({
      maxUrls: 300,
      maxDepth: 4,
      include: ["/blog/*", "/news/*"],
      stripParams: ["sort", "page"],
    });
  });

  it.each([
    ["new value", { cookies: "a=1" }, "a=1"],
    ["blank, saved: keep it", { cookies: "", cookiesSaved: true }, { keep: true }],
    ["blank, nothing saved: none", { cookies: "" }, null],
  ])("cookies: %s", (_n, over, expected) => {
    expect(toInput(draft(over)).cookies).toEqual(expected);
  });

  it("a saved header with a blank value is kept; an empty new row is dropped", () => {
    const input = toInput(draft({ headers: [{ name: "X-Preview", value: "", saved: true }, { name: "X-New", value: "", saved: false }] }));
    expect(input.headers).toEqual([{ name: "X-Preview", value: { keep: true } }]);
    expect(CrawlConfigInputSchema.safeParse(input).success).toBe(true);
  });

  it("names every server problem in every locale", () => {
    for (const l of LOCALES) {
      const t = SITE_CRAWLER_COPY[l].p4a;
      for (const p of [
        { field: "userAgent", code: "requires_verified_site" as const },
        { field: "exclude", code: "invalid_pattern" as const, pattern: "/(a+)+/", reason: "unsafe_regex" },
        { field: "headers", code: "reserved_header" as const, name: "Host" },
        { field: "customUserAgent", code: "custom_ua_missing" as const },
      ]) {
        expect(problemText(p, t, SITE_CRAWLER_COPY[l].p4b).length, `${l} ${p.code}`).toBeGreaterThan(3);
      }
    }
  });
});

describe("sitemap link", () => {
  it("carries the options and up to 20 exclude patterns", () => {
    const href = sitemapHref("c1", { lastmod: "header", changefreq: "weekly", priority: "depth", exclude: "*/tag/*\n/(a)/\n", images: true });
    const q = new URL(href, "https://app.test").searchParams;
    expect(href.startsWith("/api/seo/v1/crawl/c1/sitemap?")).toBe(true);
    expect(q.getAll("exclude")).toEqual(["*/tag/*", "/(a)/"]);
    expect([q.get("lastmod"), q.get("changefreq"), q.get("priority"), q.get("images")]).toEqual(["header", "weekly", "depth", "1"]);
  });
});

const crawl = (over: Partial<CrawlDto> = {}): CrawlDto => ({
  id: "c1",
  rootUrl: "https://x.com/",
  status: "COMPLETED",
  urlCap: 100,
  pagesCrawled: 10,
  issueCount: 2,
  stoppedReason: null,
  startedAt: null,
  finishedAt: null,
  createdAt: "2026-11-03T10:00:00Z",
  renderMode: "none",
  renderCap: 0,
  pagesRendered: 0,
  mode: "spider",
  pinned: false,
  dataPurgedAt: null,
  ...over,
});

describe.each(LOCALES)("rendered in %s", (locale) => {
  const t = SITE_CRAWLER_COPY[locale];
  const int = new Intl.NumberFormat(locale === "en" ? "en-US" : locale);

  it("crawl tools: pin, link exports, sitemap form", () => {
    const html = renderToStaticMarkup(<CrawlTools crawl={crawl()} t={t.p4a} kept="10" onUpdated={() => {}} />);
    for (const s of [t.p4a.pin, t.p4a.exportBrokenLinks, t.p4a.exportRedirectHops, t.p4a.sitemapTitle, t.p4a.sitemapDownload]) {
      expect(html).toContain(s.replace(/'/g, "&#x27;"));
    }
    expect(html).toContain("/api/seo/v1/crawl/c1/export?view=broken-links");
    expect(html).not.toMatch(/undefined|\[object/);
  });

  it("a purged crawl shows the summary-only note and nothing that needs pages", () => {
    const html = renderToStaticMarkup(<CrawlTools crawl={crawl({ dataPurgedAt: "2026-11-04T03:00:00Z" })} t={t.p4a} kept="10" onUpdated={() => {}} />);
    expect(html).toContain(t.p4a.purgedNote.slice(0, 20).replace(/'/g, "&#x27;"));
    expect(html).not.toContain("view=broken-links");
    expect(html).not.toContain(t.p4a.sitemapTitle);
  });

  it("a list-mode crawl offers no sitemap", () => {
    expect(renderToStaticMarkup(<CrawlTools crawl={crawl({ mode: "list" })} t={t.p4a} kept="10" onUpdated={() => {}} />)).not.toContain(t.p4a.sitemapTitle);
  });

  it("Pages: Found on column and an Inlinks button when the page has inlinks", () => {
    const data = {
      pages: [{ id: "p1", url: "https://x.com/a", statusCode: 200, title: null, depth: 1, inlinkCount: 3, inSitemap: true, wordCount: 10, foundOn: "https://x.com/", issueCount: 0 }],
      page: 1,
      pageSize: 50,
      total: 1,
      totalPages: 1,
    };
    const html = renderToStaticMarkup(
      <PagesPanel data={data} filters={EMPTY_PAGE_FILTERS} onFilters={() => {}} onPage={() => {}} onInlinks={() => {}} t={t} int={int} />,
    );
    expect(html).toContain(t.p4a.colFoundOn);
    expect(html).toContain(t.p4a.inlinksCta);
    const without = renderToStaticMarkup(<PagesPanel data={data} filters={EMPTY_PAGE_FILTERS} onFilters={() => {}} onPage={() => {}} t={t} int={int} />);
    expect(without).not.toContain(t.p4a.colFoundOn);
  });
});

describe("catalogs", () => {
  it("fr and de-CH carry every 4a key, de-CH without ß", () => {
    const en = Object.keys(SITE_CRAWLER_COPY.en.p4a).sort();
    for (const l of ["fr", "de-CH"] as const) expect(Object.keys(SITE_CRAWLER_COPY[l].p4a).sort()).toEqual(en);
    expect(JSON.stringify(Object.values(SITE_CRAWLER_COPY["de-CH"].p4a).filter((v) => typeof v === "string"))).not.toContain("ß");
  });
});
