// src/lib/geo/blocked-countries.ts
//
// Where Echorank does not take NEW customers: the 27 EU member states, the
// three other EEA states (IS, LI, NO) and the United Kingdom. Switzerland is
// NOT on it, and stays allowed. One list, read by:
//
//   - signup (POST /api/auth/register): the declared country and Cloudflare's
//     CF-IPCountry are both checked;
//   - the Stripe webhook (checkout.session.completed): the billing address
//     country collected by Checkout;
//   - the email-gated free-tool unlocks: a lead from a blocked country is not
//     stored.
//
// Existing tenants are not touched by any of this. People invited into an
// existing workspace are not new customers and are not checked.
//
// ISO 3166-1 alpha-2, upper case. No React and no server imports.

export const EU_MEMBER_STATES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
] as const;
export const OTHER_EEA_STATES = ["IS", "LI", "NO"] as const;
export const UNITED_KINGDOM = "GB" as const;

export const BLOCKED_COUNTRIES: ReadonlySet<string> = new Set<string>([
  ...EU_MEMBER_STATES,
  ...OTHER_EEA_STATES,
  UNITED_KINGDOM,
]);

/** True for a blocked country code. Unknown, empty and Cloudflare's XX/T1 are not blocked. */
export function isBlockedCountry(code: string | null | undefined): boolean {
  if (!code) return false;
  return BLOCKED_COUNTRIES.has(code.trim().toUpperCase());
}

/** The refusal, everywhere it is shown or emailed. */
export const COUNTRY_NOT_AVAILABLE: Record<"en" | "fr" | "de-CH", string> = {
  en: "Echorank isn't available in your country yet.",
  fr: "Echorank n'est pas encore disponible dans votre pays.",
  "de-CH": "Echorank ist in Ihrem Land noch nicht verfügbar.",
};

export function countryNotAvailable(locale: string | null | undefined): string {
  if (locale?.startsWith("fr")) return COUNTRY_NOT_AVAILABLE.fr;
  if (locale?.startsWith("de")) return COUNTRY_NOT_AVAILABLE["de-CH"];
  return COUNTRY_NOT_AVAILABLE.en;
}

/** Cloudflare's visitor country, upper case, or null (header absent, XX unknown, T1 Tor). */
export function cfCountry(headers: Headers): string | null {
  const v = headers.get("cf-ipcountry")?.trim().toUpperCase();
  return v && /^[A-Z]{2}$/.test(v) && v !== "XX" && v !== "T1" ? v : null;
}

/** The countries a signup form offers: every ISO code Intl knows, blocked ones included (they are refused with the message). */
export const SIGNUP_COUNTRY_CODES: readonly string[] = (() => {
  const codes: string[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const c = String.fromCharCode(a, b);
      try {
        const name = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" }).of(c);
        if (name && name !== c && !/^(EU|EZ|UN|QO|XA|XB|ZZ|AA|AN|BU|CS|DD|FX|NT|SU|TP|YD|YU|ZR)$/.test(c)) codes.push(c);
      } catch {
        /* not a region */
      }
    }
  }
  return codes;
})();

export function isSignupCountry(code: string | null | undefined): boolean {
  return !!code && SIGNUP_COUNTRY_CODES.includes(code.toUpperCase());
}
