// src/lib/site-crawler/brand.ts
//
// The Site Crawler is branded Nosy Bat™ — a sub-brand, not a product. Every
// surface that shows the name, the lockup or the user agent reads it from
// here; no other file under src/ spells the name out (tests/nosy-bat-brand.test.ts).
//
// Internal names do not follow the brand: the route, the `site_crawler` tool
// key, the API, the models and the queue all stay as they are. The UA token
// stays `Echorank360Bot` because customers' robots.txt rules key on it (the
// parser matches on what comes before the `/`); the name rides in the comment.
// TODO(fred): the UA points at https://echorank360.com/bot, which does not exist
// yet. Nothing here creates it; whoever writes it documents this UA.
// No React here, so server code, the catalogs and the workers can all import it.

export const CRAWLER_BRAND = {
  name: "Nosy Bat",
  nameTm: "Nosy Bat™",
  byline: "crawler by Echorank",
  mark: "/nosy-bat/nosy-bat-mark.svg",
  markOnDark: "/nosy-bat/nosy-bat-mark-on-dark.svg",
  logoOnDark: "/nosy-bat/nosy-bat-logo-on-dark.svg",
  logoOnLight: "/nosy-bat/nosy-bat-logo-on-light.svg",
  ua: "Echorank360Bot/2.0 (Nosy Bat; +https://echorank360.com/bot)",
} as const;
