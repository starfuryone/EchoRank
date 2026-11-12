// tests/pricing-card-hover.test.ts
//
// The hover / focus lift on the shared pricing grid's cards (2026-11-12).
// jsdom cannot hover or measure; the browser check is in the commit message.
// This holds the rules: pointer devices only, transform-only movement, the
// three transitioned properties, reduced motion without the transform, the
// highlighted card's own hover, and nothing that clips the lifted card.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/[locale]/home2.module.css"), "utf8");

/** The body of the first @media block whose condition is exactly `cond`. */
function mediaBody(cond: string): string {
  const start = css.indexOf(`@media ${cond}{`);
  expect(start, cond).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(css.indexOf("{", start) + 1, i);
  }
  throw new Error("unclosed @media");
}

const CARD = ".priceGrid:not(.priceGrid2) > .price";
const HI = ".priceGrid:not(.priceGrid2) > .priceHi";

describe("the pricing card hover", () => {
  const hover = mediaBody("(hover:hover) and (pointer:fine)");
  const reduced = mediaBody("(hover:hover) and (pointer:fine) and (prefers-reduced-motion:reduce)");

  it("lifts the card on hover and on focus-within, above its neighbours, on pointer devices only", () => {
    expect(hover).toContain(`${CARD}:hover,\n  ${CARD}:focus-within{transform:translateY(-4px) scale(1.03);z-index:2;`);
    // Outside the pointer-only blocks no rule hovers a card, so touch gets nothing sticky.
    const outside = css.replace(`@media (hover:hover) and (pointer:fine){${hover}}`, "").replace(
      `@media (hover:hover) and (pointer:fine) and (prefers-reduced-motion:reduce){${reduced}}`,
      "",
    );
    expect(outside).not.toMatch(/\.price(Hi)?:(hover|focus-within)/);
  });

  it("transitions transform, border-color and box-shadow only, 180ms ease-out", () => {
    expect(hover).toContain(
      `${CARD}{transition:transform 180ms ease-out,border-color 180ms ease-out,box-shadow 180ms ease-out}`,
    );
    // Nothing that would reflow: no size, margin, padding or position change on hover.
    const rules = [...hover.matchAll(/:(?:hover|focus-within)\{([^}]*)\}/g)].map((m) => m[1]).join(";");
    expect(rules).not.toMatch(/\b(width|height|margin|padding|top|left|border-width)\s*:/);
  });

  it("gives the highlighted card a stronger version of its own emphasis, only when it is hovered", () => {
    expect(hover).toContain(`${HI}:hover,\n  ${HI}:focus-within{border-color:rgba(252,213,53,.85);`);
    // No sibling or :has() rule: hovering one card cannot restyle another.
    expect(hover).not.toMatch(/~|\+|:has\(/);
  });

  it("drops the movement under reduced motion and keeps the border and shadow", () => {
    expect(reduced).toContain(`${CARD}{transition:border-color 180ms ease-out,box-shadow 180ms ease-out}`);
    expect(reduced).toContain(`${CARD}:hover,\n  ${CARD}:focus-within{transform:none}`);
    // It overrides neither, so the hover block's border and shadow still apply.
    expect(reduced).not.toMatch(/border-color:rgba|box-shadow:0/);
  });

  it("leaves the Watcher's two-card grid alone", () => {
    expect(hover).not.toMatch(/\.priceGrid2 > /);
  });

  it("clips nothing: the grid and the cards have no overflow rule", () => {
    for (const sel of [".priceGrid", ".priceGrid4", ".priceGrid5", ".price", ".priceHi", ".card", ".section", ".container"]) {
      const rule = css.match(new RegExp(`(?:^|\\n)\\${sel}\\{([^}]*)\\}`))?.[1] ?? "";
      expect(rule, sel).not.toContain("overflow");
    }
  });
});
