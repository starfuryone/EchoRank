// src/lib/flags.ts
//
// Product feature flags: the PRODUCTION value of each switch, in code, so a
// marketing surface can never describe something the app does not do. A page
// that gates on a flag renders nothing for it while it is off — no
// placeholder, no "coming soon".
//
// Not src/lib/feature-flags.ts, which is per-PLAN feature access
// (hasFeature(plan, key)). These are per-RELEASE switches: a Phase 4 sub-phase
// ships its feature and flips its flag in the same commit.
//
// Dependency-free: marketing pages, the homepage and tests all import it.

export const FLAGS = {
  // The public /site-crawler page exists (SITE-CRAWLER-PUBLIC-PAGE.md); the
  // homepage's link to that page keys on this.
  "crawl.publicPage": true,

  // Phase 4a shipped: configuration, the internal link graph (found on,
  // inlinks, broken-link sources), list mode, the sitemap generator, custom
  // robots.txt (test mode + tester).
  "crawl.config": true,
  "crawl.links": true,
  "crawl.listMode": true,
  "crawl.sitemapGen": true,
  "crawl.customRobots": true,
  // Every outbound link stored with status, anchor and source. No phase
  // builds it yet: 4a stores internal edges, 3a HEAD-checks a sample of
  // external links per page.
  "crawl.externalLinks": false,
  // Phase 4b
  "crawl.extraction": true,
  "crawl.segments": true,
  // Phase 4c: the Structure tab (directory tree, crawl tree, link graph) and
  // the Compare tab shipped, and scheduled crawls (BullMQ repeatable per
  // schedule, compare with the last run), and reports: the PDF crawl report
  // and the scheduled-crawl email.
  "crawl.visualise": true,
  "crawl.compare": true,
  "crawl.schedule": true,
  "crawl.reports": true,
  // Google Sheets export (and the Looker Studio guide that reads it). Needs
  // the spreadsheets scope on the Google OAuth client and the Sheets API
  // enabled in the GCP project — an operator step; flipped after it.
  "crawl.sheets": false,
  // Phase 4d: Search Console joined onto crawled pages (automatic when the
  // GSC connection covers the host), and PageSpeed on the top N pages
  // (opt-in, through the Lighthouse tool's allowance), and backlink metrics
  // on the top N pages (opt-in, metered under the tenant's USD cap).
  "crawl.ga4": false,
  "crawl.gsc": true,
  "crawl.psi": true,
  "crawl.backlinks": true,
  // Phase 3b / 4e
  // Phase 3b shipped render mode (headless Chromium via the sidecar).
  "crawl.render": true,
  // Phase 4e: AMP pages through rel=amphtml, the official validator in the worker.
  "crawl.amp": true,
  // Phase 4e: custom JavaScript snippets in rendered pages (verified sites only).
  "crawl.customJs": true,
  // Phase 4e: AI prompts on the top N pages after the crawl (Claude on the
  // Marketing Studio token budget, OpenAI / Gemini on the tenant's own key).
  "crawl.ai": true,
  // Phase 4e: forms-based login before crawling (verified sites only).
  "crawl.login": true,
} as const satisfies Record<string, boolean>;

export type FlagName = keyof typeof FLAGS;
export type Flags = Readonly<Record<FlagName, boolean>>;

export function flag(name: FlagName, flags: Flags = FLAGS): boolean {
  return flags[name] === true;
}
