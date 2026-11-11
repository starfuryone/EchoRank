// src/lib/pricing-page/format.ts
//
// The /pricing rebuild's locale fold and number formatting. Dependency-free:
// PricingSection (a Client Component) receives strings built with these, and
// the copy module beside it imports them.
//
// THREE BASES, NOT TWO. The rest of the marketing site folds de-CH onto en;
// the pricing page carries real German (ECHORANK-PRICING.md), so de* gets its
// own base here. en-CA and fr-CA fold onto en and fr as everywhere else.

export type PricingBase = "en" | "fr" | "de";

export function pricingBase(locale: string | null | undefined): PricingBase {
  if (locale?.startsWith("fr")) return "fr";
  if (locale?.startsWith("de")) return "de";
  return "en";
}

/**
 * Grouped integers in each base's house style: "5,000" (en), "5 000" (fr, a
 * plain space, matching plan-features.ts), "5’000" (de-CH, the Swiss
 * apostrophe).
 */
export function fmtNum(value: number, base: PricingBase): string {
  const grouped = value.toLocaleString("en-US");
  if (base === "fr") return grouped.replace(/,/g, " ");
  if (base === "de") return grouped.replace(/,/g, "’");
  return grouped;
}

/**
 * A price in whole cents. PLAN_CONFIGS prices are dollars, and one has cents
 * (the crawler-only plan, 22.40 / 17.92): every sum or product of prices goes through
 * cents, because 17.92 × 12 in floating point is 215.04000000000002.
 */
export const toCents = (dollars: number): number => Math.round(dollars * 100);

/**
 * An amount as the cards print it: "79" for whole dollars (as before), "22.40"
 * with cents, "22,40" in French. Grouped like fmtNum.
 */
export function moneyAmount(value: number, base: PricingBase): string {
  const cents = toCents(value);
  if (cents % 100 === 0) return fmtNum(cents / 100, base);
  const frac = String(Math.abs(cents % 100)).padStart(2, "0");
  return `${fmtNum(Math.trunc(cents / 100), base)}${base === "fr" ? "," : "."}${frac}`;
}

/** "$756", "$22.40": the $ sign is the currency, not a typed amount. */
export function usd(value: number, base: PricingBase): string {
  return `$${moneyAmount(value, base)}`;
}
