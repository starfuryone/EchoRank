// hreflang alternates with x-default = English (unprefixed).
// Import in your root layout's generateMetadata so search engines serve the
// English default to every non-targeted market, regardless of CDN cache.

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://echorank360.com';

const ALTERNATES: Record<string, string> = {
  'en': '/',
  'en-CA': '/en-CA',
  'fr': '/fr',
  'fr-CA': '/fr-CA',
  'de-CH': '/de-CH',
  'es-419': '/es-419',
  'es-ES': '/es-ES',
  'es-MX': '/es-MX',
};

export function hreflangLanguages(path = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [lang, prefix] of Object.entries(ALTERNATES)) {
    out[lang] = `${SITE}${prefix}${path}`.replace(/\/+$/, '') || SITE;
  }
  out['x-default'] = `${SITE}${path}`.replace(/\/+$/, '') || SITE;
  return out;
}
