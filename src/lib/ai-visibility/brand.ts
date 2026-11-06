// src/lib/ai-visibility/brand.ts
//
// The AI Visibility product's sub-brand mark: the Echorank AI Visibility logo
// and its mark (public/ai-visibility/), used the way the crawler's sub-brand is
// (src/lib/site-crawler/brand.ts). Every placement reads its files from here.
//
// The global Echorank logo (echorank-logo-*.svg: the sidebar header, the top
// nav wordmark, the footer, the PDF page header) is NOT this and is never
// replaced by it. Not on pricing cards, legal pages, the reputation tools,
// crawler's own pages or the global header/footer.
//
// The artwork (2026-11, /opt/echorank/prompts/logo/) is used as-is, never with
// edited paths: echorank-ai-visibility.svg on light surfaces,
// echorank-ai-visibility-on-dark.svg on dark ones, echorank-ai-visibility-mark.svg
// in small or square slots. The light file is the on-dark artwork with its
// white wordmark set to the site's #181A20 (the old set's own light/dark
// convention), because no light file was supplied with the set. Every <img>
// carries explicit width/height at the logo's 1580:371 (≈4.26:1). The favicons
// (echorank-ai-visibility-emblem-*.png) are unchanged.
// No React and no server imports: Server and Client Components, the email
// builders and the tests all import it.

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://echorank360.com";
const DIR = "/ai-visibility";
const LOGO_W = 1580;
const LOGO_H = 371;

export const AV_BRAND = {
  name: "Echorank AI Visibility",
  /** White wordmark, gold mark: dark surfaces. */
  logoOnDark: `${DIR}/echorank-ai-visibility-on-dark.svg`,
  /** Dark wordmark, gold mark: light surfaces. */
  logoOnLight: `${DIR}/echorank-ai-visibility.svg`,
  /**
   * The mark alone (366:372, gold), for small or square slots. <AvEmblem> shows
   * it; <AvEmblemIcon> uses it as a CSS mask (only its shape counts there).
   */
  mark: `${DIR}/echorank-ai-visibility-mark.svg`,
  /** The tab icon on the in-app AI Visibility pages (unchanged). */
  favicon: `${DIR}/echorank-ai-visibility-emblem-32.png`,
  /** Emails: the on-dark logo as an 800 px PNG, absolute; it sits on a dark header strip (avEmailHeader). */
  logoEmail: `${SITE}${DIR}/echorank-ai-visibility-on-dark-800.png`,
  /** PDF covers: the light SVG. The sidecar reads the same file from disk (AV_REPORT_LOGO_PATH, via svglib). */
  logoPdf: `${SITE}${DIR}/echorank-ai-visibility.svg`,
  width: LOGO_W,
  height: LOGO_H,
} as const;

/** The in-app AI Visibility pages' tab icon (Next metadata `icons`). */
export const AV_ICONS = { icon: [{ url: AV_BRAND.favicon, type: "image/png", sizes: "32x32" }] };

/** The logo's width at `height` px. */
export const avLogoWidthAt = (height: number) => Math.round((height * LOGO_W) / LOGO_H);

/** The dark surface the on-dark logo sits on in emails (the site's #181A20). */
export const AV_EMAIL_BAND = "#181A20";

/** The email header logo's height: kept at the old logo's 60 px when the artwork changed. */
export const AV_EMAIL_LOGO_HEIGHT = 60;

/**
 * The email header: the on-dark logo, 60 px high, on a dark strip. Most email
 * bodies are white, where the on-dark logo's white wordmark would vanish; the
 * strip is a table cell background, which every major client renders.
 */
export function avEmailHeader(): string {
  const h = AV_EMAIL_LOGO_HEIGHT;
  const w = avLogoWidthAt(h);
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 16px">` +
    `<tr><td style="background:${AV_EMAIL_BAND};padding:16px 20px">` +
    `<img src="${AV_BRAND.logoEmail}" width="${w}" height="${h}" alt="${AV_BRAND.name}" style="display:block;border:0;outline:none;width:${w}px;height:${h}px">` +
    `</td></tr></table>`
  );
}

/**
 * The in-app pages that are the AI Visibility product: /visibility and its
 * pages that keep its "AI Visibility" title. Not the SEO Tools hub that lives
 * under /visibility/tools, nor /visibility/keywords or /visibility/brand-radar
 * (SEO surfaces with titles of their own).
 */
export function avBrandedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname === "/visibility") return true;
  return pathname.startsWith("/visibility/") && !/^\/visibility\/(tools|keywords|brand-radar)(\/|$)/.test(pathname);
}
