// src/lib/other-services.ts — Echorank's other services, linked from every
// public footer and from PublicNav's Resources › More column (2026-11-10).
// Today one: llms.txt Studio's free llms.txt generator and validator.
//
// WORDING. A generator and validator, nothing more: no claim that llms.txt
// improves AI citations or rankings (the ChatGPT guide's evidence, and the AI
// readiness score v3, which does not score it).
//
// Dependency-free: PublicNav and the footers are Client and Server
// Components alike, and the static route-handler pages copy STATIC_FOOTER_HTML
// verbatim (their payloads cannot interpolate).

export const LLMS_TXT_GENERATOR_URL = "https://llmstxt.echorank360.com/llms-txt-generator";

export type OtherServicesBase = "en" | "fr" | "de-CH";
export function otherServicesBase(locale: string | null | undefined): OtherServicesBase {
  const l = (locale ?? "").toLowerCase();
  if (l.startsWith("fr")) return "fr";
  if (l.startsWith("de")) return "de-CH";
  return "en";
}

/** The generator's URL with this placement's UTM tags. */
export function llmsTxtGeneratorHref(medium: "footer" | "menu"): string {
  return `${LLMS_TXT_GENERATOR_URL}?utm_source=echorank360.com&utm_medium=${medium}`;
}

export const OTHER_SERVICES_COPY: Record<
  OtherServicesBase,
  { heading: string; footerLabel: string; footerLine: string; menuLabel: string; menuDesc: string }
> = {
  en: {
    heading: "Other services",
    footerLabel: "llms.txt Generator by Echorank",
    footerLine: "Free llms.txt generator and validator",
    menuLabel: "llms.txt Generator ↗",
    menuDesc: "Free generator and validator, by Echorank",
  },
  fr: {
    heading: "Autres services",
    footerLabel: "llms.txt Generator by Echorank",
    footerLine: "Générateur et validateur llms.txt gratuits",
    menuLabel: "llms.txt Generator ↗",
    menuDesc: "Générateur et validateur gratuits, par Echorank",
  },
  "de-CH": {
    heading: "Weitere Dienste",
    footerLabel: "llms.txt Generator by Echorank",
    footerLine: "Kostenloser llms.txt-Generator und -Validator",
    menuLabel: "llms.txt Generator ↗",
    menuDesc: "Kostenloser Generator und Validator, von Echorank",
  },
};

/**
 * The footer group as plain HTML for the static route-handler pages (English,
 * like their payloads). Each landing-html.ts carries this exact string; a test
 * checks it (no interpolation is possible inside those String.raw payloads).
 */
export const STATIC_FOOTER_HTML =
  `<div class="er-other-services" style="flex-basis:100%;min-width:0;font-size:13px;line-height:1.5;margin-top:8px">` +
  `<span style="display:block;font-weight:600">${OTHER_SERVICES_COPY.en.heading}</span>` +
  `<a href="${llmsTxtGeneratorHref("footer").replace(/&/g, "&amp;")}" style="overflow-wrap:anywhere">${OTHER_SERVICES_COPY.en.footerLabel}</a>` +
  `<span style="display:block;opacity:.75">${OTHER_SERVICES_COPY.en.footerLine}</span>` +
  `</div>`;
