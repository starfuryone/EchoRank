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
 * A price in whole cents. PLAN_CONFIGS prices are dollars, and every yearly
 * per-month figure has cents (62.40, 141.60): every sum or product of prices
 * goes through cents, because 141.6 × 12 in floating point is 1699.1999999999998.
 */
export const toCents = (dollars: number): number => Math.round(dollars * 100);

/**
 * An amount as the cards print a monthly price: "78" for whole dollars, "62.40"
 * with cents, "62,40" in French. Grouped like fmtNum.
 */
export function moneyAmount(value: number, base: PricingBase): string {
  const cents = toCents(value);
  if (cents % 100 === 0) return fmtNum(cents / 100, base);
  const frac = String(Math.abs(cents % 100)).padStart(2, "0");
  return `${fmtNum(Math.trunc(cents / 100), base)}${base === "fr" ? "," : "."}${frac}`;
}

/**
 * A MONTHLY plan price: "$78", no decimals (owner, 2026-11-11). Every monthly
 * price is whole dollars; one with cents would still print both decimals
 * rather than be rounded. The $ sign is the currency, not a typed amount.
 */
export function usd(value: number, base: PricingBase): string {
  return `$${moneyAmount(value, base)}`;
}

/** An amount with both decimals, always: "62,40" in French, "1,699.20" in English. */
export function moneyAmountCents(value: number, base: PricingBase): string {
  const cents = toCents(value);
  const frac = String(Math.abs(cents % 100)).padStart(2, "0");
  return `${fmtNum(Math.trunc(cents / 100), base)}${base === "fr" ? "," : "."}${frac}`;
}

/**
 * A YEARLY figure: the monthly equivalent, the billed-yearly total and the
 * yearly saving, always with two decimals ("$62.40", "$748.80", and "$60.00" were one whole).
 */
export function usdCents(value: number, base: PricingBase): string {
  return `$${moneyAmountCents(value, base)}`;
}
