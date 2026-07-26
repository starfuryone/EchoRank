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
  USD: { starter: 49,  growth: 149,   agency: 349,   enterprise: 999 },
  EUR: { starter: 49,  growth: 149,   agency: 349,   enterprise: 999 },
  GBP: { starter: 49,  growth: 149,   agency: 349,   enterprise: 999 },
  CAD: { starter: 69,  growth: 209,   agency: 479,   enterprise: 1379 },
  CHF: { starter: 39,  growth: 119,   agency: 279,   enterprise: 799 },
  MXN: { starter: 499, growth: 1549,  agency: 5999,  enterprise: 17299 },
};

export function currencyForLocale(locale: string): Currency {
  return LOCALE_CURRENCY[locale] ?? 'USD';
}
