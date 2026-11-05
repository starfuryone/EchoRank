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

// The v2 logo is final artwork: never resampled up, recoloured, cropped or
// given effects inside the image. Every <img> of it carries the 735:410 ratio
// as width/height. The byline is always text beside or under it, never in it.
const LOGO = {
  webp: "/nosy-bat/v2/nosy-bat-logo.webp",
  png: "/nosy-bat/v2/nosy-bat-logo.png",
  /** Downscaled PNGs plus the 735 px original, for srcSet. */
  sizes: [
    { src: "/nosy-bat/v2/nosy-bat-logo-240.png", w: 240 },
    { src: "/nosy-bat/v2/nosy-bat-logo-480.png", w: 480 },
    { src: "/nosy-bat/v2/nosy-bat-logo-800.png", w: 800 },
  ],
  width: 735,
  height: 410,
} as const;

/** The glow a dark surface puts around the logo — CSS only, nothing baked in. */
export const NOSY_BAT_LOGO_GLOW = "drop-shadow(0 0 24px rgba(240,185,11,.35))";

/** Width for a logo rendered `height` px high, at the artwork's 735:410. */
export const logoWidth = (height: number) => Math.round((height * LOGO.width) / LOGO.height);

export const CRAWLER_BRAND = {
  name: "Nosy Bat",
  nameTm: "Nosy Bat™",
  byline: "crawler by Echorank",
  /** The small mark: sidebar icon, favicon, anything under 120 px wide (the logo's wordmark is unreadable there). */
  mark: "/nosy-bat/nosy-bat-mark.svg",
  markOnDark: "/nosy-bat/nosy-bat-mark-on-dark.svg",
  /** The logo, transparent, wordmark inside the wings. Rendered through <NosyBatLogo>. */
  logo: LOGO,
  /** No separate dark variant: the same file, with a CSS drop-shadow on dark surfaces (NOSY_BAT_LOGO_GLOW). */
  logoOnDark: LOGO,
  /** For email clients that drop transparency: the original on white, absolute. */
  logoEmail: `${SITE}/nosy-bat/v2/nosy-bat-logo-on-white.png`,
  ua: "Echorank360Bot/2.0 (Nosy Bat; +https://echorank360.com/bot)",
} as const;
