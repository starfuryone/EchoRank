// The sales contact form's fixed choices and its link builder. Dependency-free:
// the form (a Client Component), the API route and every "Talk to us" link use it.

export const INQUIRY_SIZES = ["1-5", "6-25", "26-100", "100+"] as const;
export type InquirySize = (typeof INQUIRY_SIZES)[number];

export const INQUIRY_NEEDS = ["higher_limits", "white_label", "api_mcp", "annual_billing", "dpa", "other"] as const;
export type InquiryNeed = (typeof INQUIRY_NEEDS)[number];

/** The form's path under a locale. */
export const SALES_CONTACT_PATH = "/enterprise/contact";

/** ?src= values: lower-case words and dashes, at most 64 characters. Anything else is dropped. */
export function cleanSource(src: string | null | undefined): string | null {
  const s = (src ?? "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(s) ? s : null;
}

/**
 * The form's URL, with ?src= naming the link that led there. `locale` is any
 * site locale (en, en-CA, fr, fr-CA, de-CH); the dashboard's three work too.
 */
export function salesContactHref(locale: string, src: string): string {
  const s = cleanSource(src);
  if (!s) throw new Error(`salesContactHref: bad src "${src}"`);
  return `/${locale}${SALES_CONTACT_PATH}?src=${s}`;
}
