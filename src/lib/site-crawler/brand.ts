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

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://echorank360.com";
const V3 = "/nosy-bat/v3";

// The v3 wordmark and emblem (public/nosy-bat/v3/) are final SVGs: used as-is
// at any size, never with edited paths, colours or ™. The wordmarks' viewBox is
// cropped to the glyphs (195 218 1915 266: their box plus ~15 units each side),
// so every <img> of the logo carries 1915:266 (~7.2:1) as width/height. The
// PNGs are rendered from these files (scripts/gen-nosy-bat-pngs.mjs). The byline is always text
// beside or under it, never in an image.

/** The teal of the light-background logo and emblem (their fill). */
export const NOSY_BAT_TEAL = "#027453";

const LOGO_W = 1915;
const LOGO_H = 266;

/** The logo's width at `height` px (1915:266). */
export const logoWidthAt = (height: number) => Math.round((height * LOGO_W) / LOGO_H);

export const CRAWLER_BRAND = {
  name: "Nosy Bat",
  nameTm: "Nosy Bat™",
  byline: "crawler by Echorank",
  /** The emblem, fill="currentColor": painted through a CSS mask (<NosyBatIcon>), so it takes the text colour. */
  mark: `${V3}/nosy-bat-emblem-current.svg`,
  /** The emblem in white, for an <img> on a dark surface. */
  markOnDark: `${V3}/nosy-bat-emblem-on-dark.svg`,
  /** The emblem as a 512 px PNG (structured data). */
  markPng: `${V3}/nosy-bat-emblem-512.png`,
  /** The tab icon on /crawler/*. */
  favicon: `${V3}/nosy-bat-emblem-32.png`,
  /** The wordmark, teal, for light backgrounds. */
  logo: `${V3}/nosy-bat-logo.svg`,
  /** The wordmark in white, for dark backgrounds. */
  logoOnDark: `${V3}/nosy-bat-logo-on-dark.svg`,
  /** The wordmark in light teal: the public /site-crawler hero only. */
  logoOnDarkAccent: `${V3}/nosy-bat-logo-on-dark-teal.svg`,
  /** Emails: the 800 px teal PNG, absolute. */
  logoEmail: `${SITE}${V3}/nosy-bat-logo-800.png`,
  /** The PDF cover: the same PNG. The sidecar reads it from disk (AV_CRAWLER_LOCKUP_PATH). */
  logoPdf: `${SITE}${V3}/nosy-bat-logo-800.png`,
  logoWidth: LOGO_W,
  logoHeight: LOGO_H,
  ua: "Echorank360Bot/2.0 (Nosy Bat; +https://echorank360.com/bot)",
} as const;
