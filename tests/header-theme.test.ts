// tests/header-theme.test.ts
//
// The marketing header in DAY: card surface, card border, body-text ink, and
// brand-yellow gold buttons with dark text. Night is left exactly as it was.
// Contrast is computed from the shipped token values, as in
// theme-contrast.test.ts.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AA_BODY, contrastRatio, readCssTokens } from "./support/contrast";

const CSS = readFileSync(join(process.cwd(), "src/app/[locale]/home2.module.css"), "utf8");
const night = readCssTokens("src/app/globals.css", ":root");
const day = { ...night, ...readCssTokens("src/app/globals.css", '[data-theme="day"]') };

/**
 * Body of the rule that `sel` (a selector ending in "{", or the last selector
 * of a comma list) opens.
 */
function rule(sel: string): string {
  const at = CSS.indexOf(sel.endsWith("{") ? sel : `${sel}{`);
  expect(at, sel).toBeGreaterThanOrEqual(0);
  const open = CSS.indexOf("{", at);
  return CSS.slice(open + 1, CSS.indexOf("}", open));
}

describe("day header uses the theme tokens", () => {
  it("light surface with the card border, no hard-coded dark band", () => {
    const body = rule(':global([data-theme="day"]) .nav{');
    expect(body).toMatch(/background:var\(--surface\)/);
    expect(body).toMatch(/border-bottom:1px solid var\(--line\)/);
    expect(body).not.toMatch(/rgba\(9,9,12/);
  });

  it("wordmark, nav links, EN/FR and the theme icon take the body text colour", () => {
    for (const cls of [".brand", ".navlinks", ".megaTrigger", ".toggle", ".themeBtn"]) {
      expect(CSS, cls).toContain(`:global([data-theme="day"]) ${cls}`);
    }
    expect(rule(':global([data-theme="day"]) .burger')).toMatch(/color:var\(--text\)/);
  });

  it("Dashboard and the hero CTA are brand yellow with dark text, not olive", () => {
    const body = rule(':global([data-theme="day"]) .navcta');
    expect(body).toMatch(/background:var\(--goldGrad\)/);
    expect(body).toMatch(/color:var\(--onGold\)/);
    expect(body).not.toMatch(/#C4B454|#d4c56a|#a8993f/i);
  });
});

describe("night header is unchanged", () => {
  it("keeps the dark band and the existing button override", () => {
    expect(CSS).toContain(".nav{position:sticky;top:0;z-index:50;background:rgba(9,9,12,.82)");
    expect(CSS).toMatch(/linear-gradient\(135deg, #d4c56a 0%, #C4B454 45%, #a8993f 100%\)/);
  });
});

describe("AA contrast on the header, both themes", () => {
  const BAND_NIGHT = "#09090c"; // rgba(9,9,12,.82) over the night bg, effectively

  it("day: ink, accent and on-gold pairs clear 4.5:1", () => {
    const bg = day["--er-surface"];
    expect(contrastRatio(day["--er-text"], bg)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(day["--er-accent-text"], bg)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(day["--er-on-gold"], day["--er-gold"])).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(day["--er-on-gold"], day["--er-gold-deep"])).toBeGreaterThanOrEqual(AA_BODY);
  });

  it("night: the header's muted links and accent clear 4.5:1 on the band", () => {
    expect(contrastRatio(night["--er-text-muted"], BAND_NIGHT)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(night["--er-text"], BAND_NIGHT)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(night["--er-accent-text"], BAND_NIGHT)).toBeGreaterThanOrEqual(AA_BODY);
  });
});
