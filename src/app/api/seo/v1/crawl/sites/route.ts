/**
 * Per-site crawler settings (Phase 4a), scoped to the caller's tenant.
 *
 * GET    /api/seo/v1/crawl/sites?host=example.com — verification state, the
 *        token to publish, and the saved default configuration (secrets as
 *        { set: true }, never their values).
 * POST   /api/seo/v1/crawl/sites  {host}          — run the ownership checks
 *        (Search Console, DNS TXT, home-page meta tag) and record the result.
 * PUT    /api/seo/v1/crawl/sites  {host, config}  — "Save as default for this
 *        site". Validated like a crawl start; secrets sealed at rest.
 * DELETE /api/seo/v1/crawl/sites?host=example.com — forget the saved defaults
 *        (the verification stays).
 *
 * `host` may be a URL or a bare hostname; it goes through the same SSRF guard
 * as a crawl root before anything is stored or fetched.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { CrawlConfigInputSchema, checkCrawlConfig, readStoredConfig, viewCrawlConfig } from "@/lib/site-crawler/crawl-config";
import { sealCrawlConfig } from "@/lib/site-crawler/crawl-config-secrets";
import { InvalidCrawlConfigError, InvalidCrawlUrlError, crawlRouteError } from "@/lib/site-crawler/http";
import { urlCapForPlan } from "@/lib/site-crawler/quota";
import {
  VERIFY_META_NAME,
  VERIFY_TXT_PREFIX,
  getOrCreateSite,
  hostOf,
  verifySite,
  type SiteRecord,
} from "@/lib/site-crawler/site-verify";
import { validateRootUrl } from "@/lib/site-crawler/url";

const VERIFY_RATE_LIMIT = 10;
const VERIFY_RATE_WINDOW_MS = 60_000;

/** A host the crawler could be pointed at, or a 400. */
function guardedHost(raw: string | null): string {
  const host = hostOf(raw ?? "");
  const checked = host ? validateRootUrl(`https://${host}/`) : null;
  if (!host || !checked?.ok) throw new InvalidCrawlUrlError(checked?.reason ?? "not_a_url");
  return host;
}

function siteDto(site: SiteRecord) {
  return {
    host: site.host,
    verified: Boolean(site.verifiedAt),
    verifiedAt: site.verifiedAt?.toISOString() ?? null,
    verifyMethod: site.verifyMethod,
    metaTag: `<meta name="${VERIFY_META_NAME}" content="${site.verifyToken}">`,
    dnsRecord: `${VERIFY_TXT_PREFIX}${site.verifyToken}`,
    defaults: viewCrawlConfig(readStoredConfig(site.config)),
  };
}

const bad = (issues: unknown) =>
  NextResponse.json({ error: "Invalid request body", code: "INVALID_REQUEST", issues }, { status: 400 });

export async function GET(request: Request) {
  try {
    const tenant = await requirePaidPlan();
    const host = guardedHost(new URL(request.url).searchParams.get("host"));
    return NextResponse.json(siteDto(await getOrCreateSite(tenant.tenantId, host)));
  } catch (err) {
    return crawlRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requirePaidPlan();
    const parsed = z.object({ host: z.string().max(2000) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues);
    const host = guardedHost(parsed.data.host);
    const limited = await rateLimit(`site-crawl-verify:${tenant.tenantId}`, VERIFY_RATE_LIMIT, VERIFY_RATE_WINDOW_MS);
    if (!limited.success) {
      return NextResponse.json({ error: "Too many checks in a row. Wait a minute.", code: "RATE_LIMITED" }, { status: 429 });
    }
    return NextResponse.json(siteDto(await verifySite(tenant.tenantId, host)));
  } catch (err) {
    return crawlRouteError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const tenant = await requirePaidPlan();
    const parsed = z
      .object({ host: z.string().max(2000), config: CrawlConfigInputSchema })
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad(parsed.error.issues);
    const host = guardedHost(parsed.data.host);
    const site = await getOrCreateSite(tenant.tenantId, host);
    const { config, problems } = checkCrawlConfig(parsed.data.config, {
      urlCap: urlCapForPlan(tenant.tenant.planType),
      verified: Boolean(site.verifiedAt),
    });
    if (problems.length) throw new InvalidCrawlConfigError(problems);
    const stored = sealCrawlConfig(config, readStoredConfig(site.config));
    const saved = await prisma.crawlSiteDefault.update({
      where: { tenantId_host: { tenantId: tenant.tenantId, host } },
      data: { config: stored as object },
      select: { host: true, verifyToken: true, verifiedAt: true, verifyMethod: true, config: true },
    });
    return NextResponse.json(siteDto(saved));
  } catch (err) {
    return crawlRouteError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const tenant = await requirePaidPlan();
    const host = guardedHost(new URL(request.url).searchParams.get("host"));
    await prisma.crawlSiteDefault.updateMany({
      where: { tenantId: tenant.tenantId, host },
      data: { config: Prisma.DbNull },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return crawlRouteError(err);
  }
}
