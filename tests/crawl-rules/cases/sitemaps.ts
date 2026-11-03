import { sc, siteCtx, stored, type RuleCase } from "../harness";

const root = (sitemap: Record<string, unknown>) => siteCtx({ isRoot: true, job: { sitemap: sitemap as never } });

const cases: RuleCase[] = [
  sc("sitemaps.url_not_crawled", "12 never reached", true, stored(), root({ notCrawled: 12, notCrawledSample: "https://example.com/z" })),
  sc("sitemaps.url_not_crawled", "only on the root row", false, stored(), siteCtx({ job: { sitemap: { notCrawled: 12 } as never } })),
  sc("sitemaps.url_not_crawled", "all crawled", false, stored(), root({})),
  sc("sitemaps.page_not_in_sitemap", "indexable, unlisted", true, stored({ inSitemap: false })),
  sc("sitemaps.page_not_in_sitemap", "listed", false, stored()),
  sc("sitemaps.page_not_in_sitemap", "no sitemap at all", false, stored({ inSitemap: null })),
  sc("sitemaps.page_not_in_sitemap", "noindex: belongs outside", false, stored({ inSitemap: false, noindex: true })),
  sc("sitemaps.non_indexable_listed", "noindex listed", true, stored({ noindex: true })),
  sc("sitemaps.non_indexable_listed", "canonicalised listed", true, stored({ canonical: "https://example.com/main" })),
  sc("sitemaps.non_indexable_listed", "self-canonical, trailing slash aside", false, stored({ canonical: "https://example.com/page/" })),
  sc("sitemaps.redirect_listed", "redirect", true, stored({ redirectTarget: "https://example.com/new" })),
  sc("sitemaps.redirect_listed", "not listed", false, stored({ redirectTarget: "https://example.com/new", inSitemap: false })),
  sc("sitemaps.error_listed", "404 listed", true, stored({ statusCode: 404 })),
  sc("sitemaps.error_listed", "200 listed", false, stored()),
  sc("sitemaps.missing", "none found", true, stored({ inSitemap: null }), root({ found: false })),
  sc("sitemaps.missing", "found", false, stored(), root({})),
  sc("sitemaps.too_large", "60k in one file", true, stored(), root({ largestFileUrls: 60_000 })),
  sc("sitemaps.too_large", "under the limit", false, stored(), root({ largestFileUrls: 50_000 })),
  sc("sitemaps.not_in_robots", "found, undeclared", true, stored(), root({ declaredInRobots: false })),
  sc("sitemaps.not_in_robots", "declared", false, stored(), root({})),
  sc("sitemaps.not_in_robots", "no sitemap: the missing rule speaks", false, stored(), root({ found: false, declaredInRobots: false })),
];

export default cases;
