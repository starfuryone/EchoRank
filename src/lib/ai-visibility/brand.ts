// src/lib/ai-visibility/brand.ts
//
// The AI Visibility product's sub-brand mark: the Echorank AI Visibility logo
// and emblem (public/ai-visibility/), used the way the crawler's sub-brand is
// (src/lib/site-crawler/brand.ts). Every placement reads its files from here.
//
// The global Echorank logo (echorank-logo-*.svg: the sidebar header, the top
// nav wordmark, the footer, the PDF page header) is NOT this and is never
// replaced by it. Not on pricing cards, legal pages, the reputation tools,
// crawler's own pages or the global header/footer.
//
// The SVGs are final: used as-is, never with edited paths or colours. Dark
// surfaces take logoOnDark, light ones logoOnLight; every <img> carries
// explicit width/height at the logo's 2056:518 (≈3.97:1). The emblem is square.
// No React and no server imports: Server and Client Components, the email
// builders and the tests all import it.

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://echorank360.com";
const DIR = "/ai-visibility";
const LOGO_W = 2056;
const LOGO_H = 518;

export const AV_BRAND = {
  name: "Echorank AI Visibility",
  /** White wordmark, gold mark: dark surfaces. */
  logoOnDark: `${DIR}/echorank-ai-visibility-logo-on-dark.svg`,
  /** Dark wordmark, gold mark: light surfaces. */
  logoOnLight: `${DIR}/echorank-ai-visibility-logo-on-light.svg`,
  logoMonoGold: `${DIR}/echorank-ai-visibility-logo-mono-gold.svg`,
  logoMonoWhite: `${DIR}/echorank-ai-visibility-logo-mono-white.svg`,
  /** The emblem in gold. */
  emblem: `${DIR}/echorank-ai-visibility-emblem.svg`,
  /** The emblem with fill="currentColor": painted through a CSS mask (<AvEmblemIcon>) to take the text colour. */
  emblemCurrent: `${DIR}/echorank-ai-visibility-emblem-current.svg`,
  /** The tab icon on the in-app AI Visibility pages. */
  favicon: `${DIR}/echorank-ai-visibility-emblem-32.png`,
  /** Emails: the on-dark 800 px PNG, absolute; it sits on a dark header strip (avEmailHeader). */
  logoEmail: `${SITE}${DIR}/echorank-ai-visibility-logo-on-dark-800.png`,
  /** PDF covers: the on-light 800 px PNG. The sidecar reads the same file from disk (AV_REPORT_LOGO_PATH). */
  logoPdf: `${SITE}${DIR}/echorank-ai-visibility-logo-on-light-800.png`,
  width: LOGO_W,
  height: LOGO_H,
} as const;

/** The in-app AI Visibility pages' tab icon (Next metadata `icons`). */
export const AV_ICONS = { icon: [{ url: AV_BRAND.favicon, type: "image/png", sizes: "32x32" }] };

/** The logo's width at `height` px. */
export const avLogoWidthAt = (height: number) => Math.round((height * LOGO_W) / LOGO_H);

/** The dark surface the on-dark logo sits on in emails (the site's #181A20). */
export const AV_EMAIL_BAND = "#181A20";

/**
 * The email header: the on-dark logo, 240 px wide, on a dark strip. Most email
 * bodies are white, where the on-dark logo's white wordmark would vanish; the
 * strip is a table cell background, which every major client renders.
 */
export function avEmailHeader(): string {
  const w = 240;
  const h = Math.round((w * LOGO_H) / LOGO_W);
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
