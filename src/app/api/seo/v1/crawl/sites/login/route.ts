/**
 * Forms login for a crawled site (Phase 4e, crawl.login), scoped to the
 * caller's tenant and to VERIFIED hosts only.
 *
 * GET    ?host=…            → { login: view | null } (credentials as { set: true })
 * PUT    { host, login }    → save; { keep: true } keeps a saved credential
 * DELETE ?host=…            → forget it
 * POST   { host, login? }   → "Test login": one login through the sidecar with
 *                             the given (or saved) settings → { ok, reason }.
 *                             The cookies it gets are discarded, never returned.
 *
 * The login URL goes through the same SSRF guard as a crawl root and must be
 * on the verified host (or its registrable domain). Credentials are never
 * logged, never returned, never in an error.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { flag } from "@/lib/flags";
import { rateLimit } from "@/lib/rate-limit";
import { MissingKeptSecretError } from "@/lib/site-crawler/crawl-config-secrets";
import { InvalidCrawlUrlError, crawlRouteError } from "@/lib/site-crawler/http";
import { LoginInputSchema, viewLogin, type LoginInput } from "@/lib/site-crawler/login-config";
import { openLogin, readStoredLogin, sealLogin, sidecarLogin } from "@/lib/site-crawler/login";
import { getOrCreateSite, hostOf } from "@/lib/site-crawler/site-verify";
import { isInScope, validateRootUrl } from "@/lib/site-crawler/url";

const off = () => NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
// Never zod's issues: they would carry the received values, credentials included.
const bad = (code = "INVALID_REQUEST", error = "Invalid request body") => NextResponse.json({ error, code }, { status: 400 });

function guardedHost(raw: string | null): string {
  const host = hostOf(raw ?? "");
  const checked = host ? validateRootUrl(`https://${host}/`) : null;
  if (!host || !checked?.ok) throw new InvalidCrawlUrlError(checked?.reason ?? "not_a_url");
  return host;
}

/** The login URL passes the crawl-root guard and sits on the verified site. */
function loginUrlOk(url: string, host: string): boolean {
  const checked = validateRootUrl(url);
  return Boolean(checked.ok && checked.url && isInScope(checked.url, `https://${host}/`));
}

async function verifiedSite(tenantId: string, host: string) {
  const site = await getOrCreateSite(tenantId, host);
  const row = await prisma.crawlSiteDefault.findUnique({ where: { tenantId_host: { tenantId, host } }, select: { login: true } });
  return { verified: Boolean(site.verifiedAt), saved: readStoredLogin(row?.login) };
}

const notVerified = () => NextResponse.json({ error: "Forms login is for verified sites only.", code: "NOT_VERIFIED" }, { status: 403 });

export async function GET(request: Request) {
  try {
    if (!flag("crawl.login")) return off();
    const tenant = await requirePaidPlan();
    const host = guardedHost(new URL(request.url).searchParams.get("host"));
    const { saved } = await verifiedSite(tenant.tenantId, host);
    return NextResponse.json({ login: viewLogin(saved) });
  } catch (err) {
    return crawlRouteError(err);
  }
}

export async function PUT(request: Request) {
  try {
    if (!flag("crawl.login")) return off();
    const tenant = await requirePaidPlan();
    const parsed = z.object({ host: z.string().max(2000), login: LoginInputSchema }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad();
    const host = guardedHost(parsed.data.host);
    if (!loginUrlOk(parsed.data.login.loginUrl, host)) return bad("INVALID_LOGIN_URL", "The login page must be on this site.");
    const { verified, saved } = await verifiedSite(tenant.tenantId, host);
    if (!verified) return notVerified();
    const sealed = sealLogin(parsed.data.login as LoginInput, saved);
    await prisma.crawlSiteDefault.update({ where: { tenantId_host: { tenantId: tenant.tenantId, host } }, data: { login: sealed as object } });
    return NextResponse.json({ login: viewLogin(sealed) });
  } catch (err) {
    if (err instanceof MissingKeptSecretError) return bad("MISSING_SECRET", "Enter the username and password.");
    return crawlRouteError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!flag("crawl.login")) return off();
    const tenant = await requirePaidPlan();
    const host = guardedHost(new URL(request.url).searchParams.get("host"));
    await prisma.crawlSiteDefault.updateMany({ where: { tenantId: tenant.tenantId, host }, data: { login: Prisma.DbNull } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return crawlRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    if (!flag("crawl.login")) return off();
    const tenant = await requirePaidPlan();
    const parsed = z.object({ host: z.string().max(2000), login: LoginInputSchema.nullable().default(null) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return bad();
    const host = guardedHost(parsed.data.host);
    const { verified, saved } = await verifiedSite(tenant.tenantId, host);
    if (!verified) return notVerified();
    const input = parsed.data.login as LoginInput | null;
    if (input && !loginUrlOk(input.loginUrl, host)) return bad("INVALID_LOGIN_URL", "The login page must be on this site.");
    const stored = input ? sealLogin(input, saved) : saved;
    if (!stored) return bad("MISSING_SECRET", "Enter the username and password.");
    const limited = await rateLimit(`crawl-login-test:${tenant.tenantId}`, 5, 60_000);
    if (!limited.success) return NextResponse.json({ error: "Too many tests in a row. Wait a minute.", code: "RATE_LIMITED" }, { status: 429 });
    const out = await sidecarLogin(openLogin(stored));
    return NextResponse.json(out.ok ? { ok: true, reason: null } : { ok: false, reason: out.reason });
  } catch (err) {
    if (err instanceof MissingKeptSecretError) return bad("MISSING_SECRET", "Enter the username and password.");
    return crawlRouteError(err);
  }
}
