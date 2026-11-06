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

/** "$756" — prices are whole USD in PLAN_CONFIGS; the $ sign is the currency, not a typed amount. */
export function usd(value: number, base: PricingBase): string {
  return `$${fmtNum(value, base)}`;
}
