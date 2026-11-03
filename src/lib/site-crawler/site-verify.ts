// src/lib/site-crawler/site-verify.ts
//
// Site ownership for the crawler (Phase 4a). Options that change how the
// crawler treats a server — another user agent, ignoring robots.txt, a custom
// robots.txt that replaces the live one (and, in 4e, forms login and custom
// JavaScript) — run only on a host the tenant has shown it controls:
//
//   gsc   the tenant's ACTIVE Search Console connection has a property that
//         covers the host (sc-domain:example.com covers it and its
//         subdomains; a URL-prefix property covers its own host);
//   meta  <meta name="echorank-verify" content="TOKEN"> on the host's home page;
//   dns   a TXT record "echorank-verify=TOKEN" on the host.
//
// One token per tenant + host, kept in crawl_site_defaults with the site's
// saved configuration. A verification stays valid until the token is reset.
// Everything else stays read-only on an unverified site: the Echorank360Bot
// user agent, robots.txt obeyed, 2 req/s at most.

import "server-only";
import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";
import { prisma } from "@/lib/prisma";
import { CRAWLER_USER_AGENT } from "./constants";
import { isFetchableUrl } from "./url";

export const VERIFY_META_NAME = "echorank-verify";
export const VERIFY_TXT_PREFIX = "echorank-verify=";
export type VerifyMethod = "gsc" | "meta" | "dns";

const META_TIMEOUT_MS = 10_000;
const META_MAX_BYTES = 256 * 1024;
const META_MAX_HOPS = 3;

export function newVerifyToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Lowercased hostname of a URL or a bare host; null when neither parses. */
export function hostOf(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

/** Does a Search Console property string cover this host? */
export function gscPropertyCovers(siteUrl: string | null, host: string): boolean {
  if (!siteUrl) return false;
  const h = host.toLowerCase();
  if (siteUrl.startsWith("sc-domain:")) {
    const d = siteUrl.slice("sc-domain:".length).toLowerCase();
    return h === d || h.endsWith(`.${d}`);
  }
  return hostOf(siteUrl) === h;
}

/** Find the token in a home page's HTML (any attribute order, either quote). */
export function pageHasMetaToken(html: string, token: string): boolean {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const name = /\bname\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1];
    const content = /\bcontent\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1];
    if (name?.toLowerCase() === VERIFY_META_NAME && content === token) return true;
  }
  return false;
}

export function txtHasToken(records: string[][], token: string): boolean {
  return records.some((chunks) => chunks.join("").trim() === `${VERIFY_TXT_PREFIX}${token}`);
}

export interface VerifyDeps {
  gscSiteUrl: (tenantId: string) => Promise<string | null>;
  fetchHome: (host: string) => Promise<string | null>;
  txt: (host: string) => Promise<string[][]>;
}

const defaultDeps: VerifyDeps = {
  async gscSiteUrl(tenantId) {
    const c = await prisma.gscConnection.findUnique({ where: { tenantId }, select: { siteUrl: true, status: true } });
    return c?.status === "ACTIVE" ? c.siteUrl : null;
  },
  fetchHome,
  txt: (host) => resolveTxt(host).catch(() => []),
};

/** The home page's HTML, same host only, bounded in time and size. */
async function fetchHome(host: string): Promise<string | null> {
  let url = `https://${host}/`;
  for (let hop = 0; hop <= META_MAX_HOPS; hop++) {
    if (!isFetchableUrl(url)) return null;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "user-agent": CRAWLER_USER_AGENT, accept: "text/html" },
        redirect: "manual",
        signal: AbortSignal.timeout(META_TIMEOUT_MS),
      });
    } catch {
      return null;
    }
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel().catch(() => {});
      let next: URL;
      try {
        next = new URL(location, url);
      } catch {
        return null;
      }
      // http→https and path moves are fine; another host is not this site.
      if (next.hostname.toLowerCase() !== host) return null;
      url = next.toString();
      continue;
    }
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
      if (done || !value) break;
      chunks.push(value);
      total += value.byteLength;
      if (total >= META_MAX_BYTES) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  return null;
}

/** The method that proves ownership right now, or null. Tried cheapest first. */
export async function checkOwnership(
  tenantId: string,
  host: string,
  token: string,
  deps: VerifyDeps = defaultDeps,
): Promise<VerifyMethod | null> {
  if (gscPropertyCovers(await deps.gscSiteUrl(tenantId), host)) return "gsc";
  if (txtHasToken(await deps.txt(host), token)) return "dns";
  const html = await deps.fetchHome(host);
  if (html && pageHasMetaToken(html, token)) return "meta";
  return null;
}

export interface SiteRecord {
  host: string;
  verifyToken: string;
  verifiedAt: Date | null;
  verifyMethod: string | null;
  config: unknown;
}

/** The tenant's record for a host, created (with a fresh token) on first use. */
export async function getOrCreateSite(tenantId: string, host: string): Promise<SiteRecord> {
  return prisma.crawlSiteDefault.upsert({
    where: { tenantId_host: { tenantId, host } },
    create: { tenantId, host, verifyToken: newVerifyToken() },
    update: {},
    select: { host: true, verifyToken: true, verifiedAt: true, verifyMethod: true, config: true },
  });
}

/** Run the checks and record the result. A failed check does not clear an earlier success. */
export async function verifySite(tenantId: string, host: string, deps?: VerifyDeps): Promise<SiteRecord> {
  const site = await getOrCreateSite(tenantId, host);
  const method = await checkOwnership(tenantId, host, site.verifyToken, deps);
  if (!method) return site;
  return prisma.crawlSiteDefault.update({
    where: { tenantId_host: { tenantId, host } },
    data: { verifiedAt: new Date(), verifyMethod: method },
    select: { host: true, verifyToken: true, verifiedAt: true, verifyMethod: true, config: true },
  });
}

/** Is this host verified for this tenant? Read at crawl creation and copied into the job's config. */
export async function isSiteVerified(tenantId: string, host: string): Promise<boolean> {
  const row = await prisma.crawlSiteDefault.findUnique({
    where: { tenantId_host: { tenantId, host } },
    select: { verifiedAt: true },
  });
  return Boolean(row?.verifiedAt);
}
