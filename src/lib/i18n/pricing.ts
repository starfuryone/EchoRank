// Echorank pricing — source of truth for locale -> currency and the price ladder.
// MXN is a deliberate market price (Inicio/Crecimiento are NOT FX-of-USD; they
// carry a ~40% Mexico discount). Do not "fix" them back to FX parity on the
// semi-annual currency review — only USD/EUR/GBP/CAD/CHF track FX.

export type Tier = 'starter' | 'growth' | 'agency' | 'enterprise';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'CHF' | 'MXN';

export const LOCALE_CURRENCY: Record<string, Currency> = {
  'en': 'USD',
  'en-CA': 'CAD',
  'fr': 'EUR',
  'fr-CA': 'CAD',
  'de-CH': 'CHF',
  'es-419': 'USD',
  'es-ES': 'EUR',
  'es-MX': 'MXN',
};

// Monthly amounts in major units (no cents). Stripe Prices are created from these.
export const PRICE_LADDER: Record<Currency, Record<Tier, number>> = {
  // USD is authoritative (Stripe seed). Non-USD rows below are STALE:
  // they still reflect the pre-alignment ladder and have no consumers yet.
  USD: { starter: 79,  growth: 199,   agency: 499,   enterprise: 0 },
  EUR: { starter: 49,  growth: 149,   agency: 349,   enterprise: 999 },
  GBP: { starter: 49,  growth: 149,   agency: 349,   enterprise: 999 },
  CAD: { starter: 69,  growth: 209,   agency: 479,   enterprise: 1379 },
  CHF: { starter: 39,  growth: 119,   agency: 279,   enterprise: 799 },
  MXN: { starter: 499, growth: 1549,  agency: 5999,  enterprise: 17299 },
};

/**
 * USD-only as of 2026-07-27: Echorank360 bills every locale in US dollars.
 * LOCALE_CURRENCY and the non-USD rows of PRICE_LADDER are retained as
 * historical reference (notably the deliberate ~40% MXN market discount, which
 * was a pricing decision rather than an FX conversion) but are NOT used for
 * resolution. Reinstating multi-currency means changing this function first.
 */
export function currencyForLocale(_locale: string): Currency {
  return 'USD';
}
