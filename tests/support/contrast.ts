// tests/support/contrast.ts
//
// WCAG 2.x relative luminance and contrast ratio, for asserting that a text
// token is readable on a surface token.
//
// ── WHY THIS IS COMPUTED AND NOT EYEBALLED ────────────────────────────────
// A contrast failure is the one design bug that is invisible to the person who
// introduced it: the author picked the colour BECAUSE they could read it, on
// their monitor, at their brightness. The reader who cannot is somewhere else.
// Computing the ratio from the actual token values is the only way the suite
// can hold a line nobody can see.
//
// Reads token values out of a CSS source rather than taking them as arguments,
// so a test asserts the colours that SHIP — an edit to globals.css fails the
// suite, which is the whole point of having this.

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** #rgb / #rrggbb -> [r, g, b] in 0..255. Throws on anything else, loudly:
 *  a silently-parsed bad value would assert contrast against black. */
export function parseHex(value: string): [number, number, number] {
  const hex = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`Not a hex colour: ${value}`);
  }
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1..21. Order-independent. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** AA thresholds. Large = >=18.66px, or >=14px bold. */
export const AA_BODY = 4.5;
export const AA_LARGE = 3;

/**
 * Every `--name: value;` declaration in a CSS file, by selector block.
 *
 * Deliberately dumb: it does not resolve `var()` indirection, because a token
 * defined as a reference to another token has no colour of its own to assert.
 * Callers ask for the literal-valued tokens and get exactly those.
 *
 * Values come back VERBATIM, hex or not — `rgba(...)`, a gradient, anything.
 * That matters because the most useful assertion about a scrim or a gradient
 * is not its ratio but WHETHER A THEME OVERRIDES IT, and a hex-only reader
 * reports "absent" for a token that is merely not a hex. Feeding a non-hex
 * value to luminance() still throws, loudly, which is the right outcome.
 */
export function readCssTokens(relativePath: string, selector: string): Record<string, string> {
  const css = readFileSync(join(process.cwd(), relativePath), "utf8");
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // EVERY block for the selector, not the first. A stylesheet may declare
  // `:root` more than once — globals.css does — and CSS cascades them, so
  // reading only the first would assert against tokens that are not the ones
  // in force. Later blocks win, exactly as the browser resolves them.
  const blocks = [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "gm"))];
  if (blocks.length === 0) throw new Error(`No \`${selector}\` block in ${relativePath}`);

  const tokens: Record<string, string> = {};
  for (const block of blocks) {
    for (const match of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
      tokens[match[1]] = match[2].trim();
    }
  }
  return tokens;
}
