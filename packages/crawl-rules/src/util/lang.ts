// hreflang value validation: ISO 639-1 language, optional ISO 15924 script
// (shape only), optional ISO 3166-1 alpha-2 region or UN M49 numeric region.
// The code lists come from two data packages, never from tables in this repo.
//
// `i18n-iso-countries/index` on purpose: the package's Node entry registers
// every country-name locale (~600 KB); the codes are all a validator needs.

import ISO6391 from "iso-639-1";
import countries from "i18n-iso-countries/index";

/** UN M49 numeric regions the app's own locales use (es-419), plus world and Europe. */
const M49_REGIONS = new Set([
  "001", // World
  "150", // Europe
  "419", // Latin America and the Caribbean
]);

export function isValidHreflang(value: string): boolean {
  const tag = value.trim().toLowerCase();
  if (tag === "x-default") return true;
  const [lang, ...rest] = tag.split("-");
  if (!lang || !ISO6391.validate(lang)) return false;
  let i = 0;
  if (rest[i] && /^[a-z]{4}$/.test(rest[i]!)) i++; // script, e.g. zh-hant
  const region = rest[i];
  if (region !== undefined) {
    const ok = /^[a-z]{2}$/.test(region) ? countries.isValid(region.toUpperCase()) : M49_REGIONS.has(region);
    if (!ok) return false;
    i++;
  }
  return i === rest.length;
}

/** Primary language subtag, lowercased; "x-default" stays itself. */
export const primaryLang = (value: string) => {
  const t = value.trim().toLowerCase();
  return t === "x-default" ? t : t.split("-")[0]!;
};
