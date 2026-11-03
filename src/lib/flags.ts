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

  // Phase 4a
  "crawl.config": false,
  "crawl.links": false,
  "crawl.listMode": false,
  "crawl.sitemapGen": false,
  "crawl.customRobots": false,
  // Phase 4b
  "crawl.extraction": false,
  "crawl.segments": false,
  // Phase 4c
  "crawl.visualise": false,
  "crawl.compare": false,
  "crawl.schedule": false,
  "crawl.reports": false,
  // Phase 4d
  "crawl.ga4": false,
  "crawl.gsc": false,
  "crawl.psi": false,
  "crawl.backlinks": false,
  // Phase 3b / 4e
  // Phase 3b shipped render mode (headless Chromium via the sidecar).
  "crawl.render": true,
  "crawl.customJs": false,
  "crawl.ai": false,
  "crawl.formsAuth": false,
} as const satisfies Record<string, boolean>;

export type FlagName = keyof typeof FLAGS;
export type Flags = Readonly<Record<FlagName, boolean>>;

export function flag(name: FlagName, flags: Flags = FLAGS): boolean {
  return flags[name] === true;
}
