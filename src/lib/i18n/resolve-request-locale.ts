import { cookies, headers } from "next/headers";
import { isSupportedLocale, resolveTarget, type Locale } from "./config";

/**
 * Resolve the visitor's locale for pages outside the /[locale] tree
 * (login, register …). Same precedence as the homepage proxy logic:
 * explicit echorank_locale cookie wins, then Cloudflare geo + Accept-Language.
 */
export async function resolveRequestLocale(): Promise<Locale> {
  const jar = await cookies();
  const cookieLocale = jar.get("echorank_locale")?.value;
  if (isSupportedLocale(cookieLocale)) return cookieLocale;

  const h = await headers();
  return resolveTarget(
    h.get("cf-ipcountry"),
    h.get("cf-region-code"),
    h.get("accept-language"),
  ).locale;
}
