// tests/pricing-yearly-layout.test.ts
//
// The yearly toggle's price block on the shared pricing grid must fit its card
// (2026-11-12: "$62.40/mo save" was one unbreakable run that stuck out of the
// five-across cards, and every French grid overflowed). jsdom cannot measure
// layout; the browser check is in the commit message. This holds the rules.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/[locale]/home2.module.css"), "utf8");
const tsx = readFileSync(join(process.cwd(), "src/app/[locale]/PricingSection.tsx"), "utf8");

describe("the yearly price block on the shared pricing grid", () => {
  it("puts the save chip on its own line, never split, outside the Watcher's two-card grid", () => {
    expect(css).toContain(".priceGrid:not(.priceGrid2) .priceSave{display:block;margin:6px 0 0;white-space:nowrap}");
  });

  it("puts the struck monthly price on its own line only while the row is five across", () => {
    // .priceGrid5 is five columns above 1180 px, two below, one under 900.
    expect(css).toContain("@media(max-width:1180px){.priceGrid4,.priceGrid5{grid-template-columns:repeat(2,minmax(0,1fr))}}");
    expect(css).toContain("@media(min-width:1181px){.priceGrid5 .priceAnchor{display:block;width:max-content;margin:0 0 2px}}");
  });

  it("does not shrink the type", () => {
    expect(css).toMatch(/\.pamount\{font-size:28px;/);
    expect(css).toMatch(/\.priceSave\{font-family:var\(--mono\);font-size:10px;/);
    expect(css).toMatch(/\.priceAnchor\{[^}]*font-size:18px;/);
  });

  it("the five-card grid is the one PricingSection picks for five cards", () => {
    expect(tsx).toContain("const gridClass = cardCount >= 5 ? s.priceGrid5 : cardCount === 4 ? s.priceGrid4 : s.priceGrid;");
  });
});
