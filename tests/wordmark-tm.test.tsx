// The ™ on the ECHORANK wordmark (src/lib/brand/wordmark-tm.ts), on every surface that draws it:
// one shared class for HTML text (globals.css + each standalone payload, verbatim), the ™ inside
// the SVG logo files (viewBox widened by the ™ only), the OG card scripts, and the extension pages
// when they are on this box. Decorative everywhere (aria-hidden); never in titles or metadata.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WORDMARK_TM_CSS, WORDMARK_TM_HTML } from "@/lib/brand/wordmark-tm";
import { WordmarkTm } from "@/components/brand/WordmarkTm";
import { TECHNICAL_GEO_HTML } from "@/app/[locale]/technical-geo/landing-html";
import { GLOSSARY_HTML } from "@/app/[locale]/glossary/landing-html";
import { KEYWORD_GUIDE_HTML } from "@/app/[locale]/keyword-research/landing-html";
import { METHODOLOGY_HTML } from "@/app/[locale]/methodology/landing-html";
import { SEO_GUIDE_HTML } from "@/app/[locale]/seo-guide/landing-html";
import { AIDO_HTML } from "@/app/[locale]/ai-discovery-optimization/landing-html";
import { PLAYBOOK_HTML } from "@/app/[locale]/link-building-playbook/landing-html";
import { SETUP_AI_SEARCH_TRACKING_HTML } from "@/app/[locale]/setup-ai-search-tracking/landing-html";
import { landingHtml as REPUTATION_TOOLS_HTML } from "@/app/[locale]/reputation-tools/landing-html";
import { issueLibraryHtml } from "@/app/[locale]/seo-spider/issues/library-html";

const ROOT = join(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const count = (s: string, sub: string) => s.split(sub).length - 1;

/** Each standalone page and how many wordmarks it draws (header, footer). */
const PAYLOADS: [string, string, number][] = [
  ["technical-geo", TECHNICAL_GEO_HTML, 2],
  ["glossary", GLOSSARY_HTML, 1],
  ["keyword-research", KEYWORD_GUIDE_HTML, 1],
  ["methodology", METHODOLOGY_HTML, 2],
  ["seo-guide", SEO_GUIDE_HTML, 2],
  ["ai-discovery-optimization", AIDO_HTML, 1],
  ["link-building-playbook", PLAYBOOK_HTML, 1],
  ["setup-ai-search-tracking", SETUP_AI_SEARCH_TRACKING_HTML, 1],
  ["reputation-tools", REPUTATION_TOOLS_HTML, 1],
  ["seo-spider/issues", issueLibraryHtml(), 1],
  // /enterprise left this list on 2026-11-07: it is a React page under
  // PublicNav now, whose wordmark is the <WordmarkTm /> checked below.
];

describe("the shared ™ class", () => {
  it("one definition: <WordmarkTm /> is the canonical span, decorative", () => {
    expect(renderToStaticMarkup(createElement(WordmarkTm))).toBe(WORDMARK_TM_HTML);
    expect(WORDMARK_TM_HTML).toBe('<span class="er-tm" aria-hidden="true">™</span>');
  });

  it("the rules: 0.35em never under 7px, top on the cap line, ~0.05em after the K, currentColor, no line growth", () => {
    expect(WORDMARK_TM_CSS).toContain("font-size:max(7px,.35em)");
    expect(WORDMARK_TM_CSS).toContain("vertical-align:calc(var(--er-wm-cap) - 1cap)");
    expect(WORDMARK_TM_CSS).toContain("margin-left:calc(var(--er-wm-em)*.05 - var(--er-wm-ls))");
    expect(WORDMARK_TM_CSS).toContain("color:currentColor");
    expect(WORDMARK_TM_CSS).toContain("line-height:0");
    // No backtick or ${ — it is pasted into String.raw payloads.
    expect(WORDMARK_TM_CSS).not.toMatch(/`|\$\{/);
  });

  it("globals.css carries it verbatim (every React surface)", () => {
    expect(read("src/app/globals.css")).toContain(WORDMARK_TM_CSS);
  });
});

describe("HTML-text wordmarks", () => {
  it.each(PAYLOADS)("%s: the CSS verbatim, a ™ after every ECHORANK wordmark, none in title/meta", (_name, html, n) => {
    expect(html).toContain(WORDMARK_TM_CSS);
    expect(count(html, `ECHORANK${WORDMARK_TM_HTML}`)).toBe(n);
    expect(count(html, WORDMARK_TM_HTML)).toBe(n);
    expect(html).not.toMatch(/<title>[^<]*™/);
    expect(html).not.toMatch(/<meta[^>]*ECHORANK™/);
    expect(html).not.toMatch(/"name":\s*"[^"]*™/); // JSON-LD
  });

  it("the public nav (header and mobile menu) and the demo page use <WordmarkTm /> right after the K, in one flex item", () => {
    const nav = read("src/app/[locale]/PublicNav.tsx");
    expect(count(nav, "<WordmarkTm />")).toBe(2);
    expect(nav).toMatch(/<span>\s*ECHORANK\s*<WordmarkTm \/>\s*<\/span>/);
    expect(read("src/app/[locale]/demo/page.tsx")).toMatch(/<span>\s*ECHORANK\s*<WordmarkTm \/>\s*<\/span>/);
    // The letter-spacing the K carries is handed to the ™'s gap.
    expect(read("src/app/[locale]/home2.module.css")).toMatch(/\.brand\{[^}]*letter-spacing:\.04em[^}]*--er-wm-ls:\.04em/);
  });

  it("the copyright lines and kickers stay as they were (running text, not the wordmark)", () => {
    expect(read("src/components/PublicFooter.tsx")).toContain("© 2026 ECHORANK / CHATLOGIC INSIGHTS LTD</span>");
    expect(read("src/lib/i18n/content.ts")).not.toContain("ECHORANK™");
  });
});

describe("SVG logo files", () => {
  for (const [file, ink] of [["echorank-logo-dark.svg", "#1a1a1a"], ["echorank-logo-light.svg", "#FFFFFF"]] as const) {
    it(`${file}: the ™ after the K in the wordmark's colour; the viewBox wider by the ™ only`, () => {
      const svg = read(`public/${file}`);
      expect(svg).toContain('viewBox="60 40 1348.57 220" width="1348.57"');
      const tm = svg.match(/<path aria-hidden="true" fill="([^"]+)" transform="translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)/);
      expect(tm).not.toBeNull();
      const [, fill, x, y, s] = tm!;
      expect(fill).toBe(ink);
      // Top on the cap line (the E's top is y=106); ~0.05em (6 units at a 120-unit em) after the K (x=1085.71).
      expect(Number(y)).toBe(106);
      expect(Number(x) - 1085.71).toBeCloseTo(6, 1);
      // "360" moved by the ™'s gap + width, and the viewBox grew by exactly that.
      const width = 85.36 * Number(s);
      // A <g> transform, not one on the path: svglib (the PDF header) ignores a path's transform under a gradient fill.
      expect(svg).toContain('<g transform="translate(48.57 0)"><path d="M1144.7486');
      expect(6 + width).toBeCloseTo(48.57, 1);
      // The accessible name is unchanged.
      expect(svg).toContain('aria-label="ECHORANK 360"');
    });
  }

  it("the JSON-LD logo (metadata) is untouched", () => {
    expect(read("public/echorank-logo.svg")).not.toContain("™");
  });

  it("/ai-visibility has no header logo of its own: it uses the shared PublicNav (2026-11-10)", () => {
    const page = read("src/app/[locale]/ai-visibility/page.tsx");
    expect(count(page, "width={187} height={34}")).toBe(0);
    expect(page).toContain("<PublicNav locale={locale} />");
  });
});

describe("OG cards", () => {
  for (const s of ["gen-og.mjs", "gen-og-seo-guide.mjs", "gen-og-ai-discovery-optimization.mjs", "gen-og-link-building-playbook.mjs"]) {
    it(`${s} draws the ™ as a 0.35em tspan after the K`, () => {
      expect(read(`scripts/${s}`)).toContain('ECHORANK<tspan dx="-3.5" dy="-14.2" font-size="10.5" letter-spacing="0">™</tspan>');
    });
  }
  it("the home card keeps its space before 360", () => {
    expect(read("scripts/gen-og.mjs")).toContain('<tspan dy="14.2" xml:space="preserve"> 360</tspan>');
  });
});

const EXT = "/opt/echorank/extension-dist";
describe.skipIf(!existsSync(EXT))("extension pages (outside the repo)", () => {
  for (const f of ["help.html", "getting-reviews-in.html", "download.html", "howto-ai-visibility.html", "howto-import-reviews.html"]) {
    it(`${f}: the CSS verbatim and one ™ after the wordmark`, () => {
      const html = readFileSync(join(EXT, f), "utf8");
      expect(html).toContain(WORDMARK_TM_CSS);
      expect(count(html, WORDMARK_TM_HTML)).toBe(1);
      expect(html).toMatch(/(ECHORANK|Echorank|EchoRank)<span class="er-tm" aria-hidden="true">™<\/span> /);
    });
  }
});
