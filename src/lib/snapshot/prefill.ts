// src/lib/snapshot/prefill.ts
//
// Category / location / brand guesses for the check's form, read from the
// homepage's <title>, meta description and schema.org JSON-LD. One page, one
// GET, no model call: the form is anonymous and pre-Turnstile, so nothing it
// triggers may cost money. The visitor edits whatever this gets wrong.
//
// SSRF: every hop is re-checked with guardPublicUrl (DNS included). The site
// crawler's fetchPage follows redirects unguarded, which is fine for a crawl
// root a tenant already passed through validateRootUrl, and not fine for an
// anonymous endpoint that a redirect could point at 127.0.0.1.
import "server-only";

import * as cheerio from "cheerio";
import { guardPublicUrl } from "@/lib/public-url";

export interface Prefill {
  brand: string | null;
  category: string | null;
  location: string | null;
}

const MAX_HOPS = 4;
const MAX_BYTES = 512 * 1024;
const UA = "Mozilla/5.0 (compatible; EchorankBot/1.0; +https://echorank360.com/bot)";

async function fetchHomepage(domain: string): Promise<string | null> {
  let url = `https://${domain}/`;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const guard = await guardPublicUrl(url);
    if (!guard.ok) return null;
    const res = await fetch(guard.url, {
      headers: { "user-agent": UA, accept: "text/html" },
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      await res.body?.cancel().catch(() => {});
      url = new URL(loc, guard.url).toString();
      continue;
    }
    if (!res.ok || !/html/i.test(res.headers.get("content-type") ?? "")) {
      await res.body?.cancel().catch(() => {});
      return null;
    }
    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
      if (size >= MAX_BYTES) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  return null;
}

/** schema.org types that say nothing about what the business does. */
const GENERIC_TYPES = new Set([
  "organization", "corporation", "website", "webpage", "localbusiness", "store", "onlinestore",
  "professionalservice", "thing", "brand", "person", "place", "searchaction", "breadcrumblist",
  "imageobject", "sitenavigationelement", "faqpage", "collectionpage", "itemlist", "product", "offer",
]);

/** "HVACBusiness" → "HVAC business", "LegalService" → "legal service". */
export function typeToCategory(type: string): string | null {
  if (GENERIC_TYPES.has(type.toLowerCase())) return null;
  const words = type
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(" ")
    .map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase()));
  return words.join(" ");
}

/* eslint-disable @typescript-eslint/no-explicit-any -- arbitrary JSON-LD */
function jsonLdNodes(raw: string): any[] {
  try {
    const v = JSON.parse(raw);
    const list = Array.isArray(v) ? v : [v];
    return list.flatMap((n) => (Array.isArray(n?.["@graph"]) ? n["@graph"] : [n])).filter((n) => n && typeof n === "object");
  } catch {
    return [];
  }
}

const clean = (s: string | null | undefined, max = 60) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t && t.length <= max ? t : null;
};

/** Pure: the guesses from one homepage's HTML. */
export function prefillFromHtml(html: string, domain: string): Prefill {
  const $ = cheerio.load(html);
  let brand: string | null = clean($('meta[property="og:site_name"]').attr("content"));
  let category: string | null = null;
  let location: string | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    for (const n of jsonLdNodes($(el).text())) {
      const types: string[] = (Array.isArray(n["@type"]) ? n["@type"] : [n["@type"]]).filter((t: any) => typeof t === "string");
      for (const t of types) category ??= typeToCategory(t);
      if (types.some((t) => !["WebSite", "WebPage", "BreadcrumbList"].includes(t))) brand ??= clean(n.name);
      const addr = Array.isArray(n.address) ? n.address[0] : n.address;
      location ??= clean(typeof addr === "object" ? addr?.addressLocality : null, 40);
    }
  });

  const title = $("title").first().text().replace(/\s+/g, " ").trim();
  const label = domain.split(".")[0].toLowerCase();
  const parts = title.split(/\s+[|·•–—-]\s+|:\s+/).map((p) => p.trim()).filter(Boolean);
  const isBrandPart = (p: string) =>
    p.toLowerCase().replace(/[^a-z0-9]/g, "").includes(label) || (!!brand && p.toLowerCase() === brand.toLowerCase());
  brand ??= clean(parts.find(isBrandPart) ?? null);
  if (!category) {
    const descriptive = parts.find((p) => !isBrandPart(p));
    if (descriptive) {
      const m = descriptive.match(/^(.*?)\s+(?:in|near|serving|à|en)\s+([\p{Lu}][\p{L}' -]{1,38})$/u);
      category = clean((m ? m[1] : descriptive).toLowerCase().replace(/^(the|best|top|your|le|la|les|votre)\s+/, ""));
      if (m) location ??= clean(m[2], 40);
    }
  }
  return { brand, category, location };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function prefill(domain: string): Promise<Prefill> {
  try {
    const html = await fetchHomepage(domain);
    return html ? prefillFromHtml(html, domain) : { brand: null, category: null, location: null };
  } catch {
    return { brand: null, category: null, location: null };
  }
}
