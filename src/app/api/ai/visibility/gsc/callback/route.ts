// GET /api/ai/visibility/gsc/callback — OAuth redirect target (registered in
// Google Cloud). Reached as a top-level GET navigation, so the SameSite=Lax
// session cookie IS sent and requirePaidPlan works — no proxy.ts public-list
// change needed. State must verify AND match the session tenant (CSRF + a
// stolen-state flow for another tenant both fail closed). All failure modes
// land back on the tool page with a machine-readable ?gsc_error code that the
// page renders localized.
import { NextRequest, NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { verifyStatePurpose } from "@/lib/gsc/state";
import { exchangeCode, listSites } from "@/lib/gsc/client";
import { getConnection, saveConnection } from "@/lib/gsc/service";

const PAGE = "/visibility/tools/gsc-insights";
/** Search Console connected from Settings → Integrations (the crawler-only plan has no GSC tool page). */
const SETTINGS = "/settings";
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://echorank360.com";

function back(req: NextRequest, params: string, page: string = PAGE): NextResponse {
  return NextResponse.redirect(new URL(`${page}?${params}`, BASE));
}

export async function GET(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = (await requirePaidPlan()).tenantId;
  } catch {
    return NextResponse.redirect(new URL("/login", BASE));
  }

  const url = req.nextUrl;
  if (url.searchParams.get("error")) {
    // User declined on Google's screen. A Sheets connect goes back to the crawler.
    const purpose = verifyStatePurpose(url.searchParams.get("state") ?? "")?.purpose;
    if (purpose === "sheets") return NextResponse.redirect(new URL("/crawler?sheets_error=denied", BASE));
    if (purpose === "ga4") return NextResponse.redirect(new URL("/settings?ga4_error=denied", BASE));
    return back(req, "gsc_error=denied", purpose === "gsc_settings" ? SETTINGS : PAGE);
  }
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const verified = verifyStatePurpose(state);
  if (!code || !verified || verified.tenantId !== tenantId) {
    return back(req, "gsc_error=bad_state");
  }
  // Where the plain Search Console connect lands: the GSC tool page, or
  // Settings when it was started there.
  const page = verified.purpose === "gsc_settings" ? SETTINGS : PAGE;

  // Phase 4c: the Site Crawler's "Connect Google Sheets" (crawl.sheets). The
  // same refresh token, now carrying spreadsheets too; the chosen property
  // is kept, and having no property is fine here.
  // Phase 4d: Google Analytics, same token, now carrying analytics.readonly
  // too; back to Settings → Integrations to pick a property.
  if (verified.purpose === "sheets" || verified.purpose === "ga4") {
    const p = verified.purpose;
    const crawler = (q: string) =>
      NextResponse.redirect(new URL(p === "ga4" ? `/settings?${q.replace(/^sheets/, "ga4")}` : `/crawler?${q}`, BASE));
    try {
      const { refreshToken } = await exchangeCode(code);
      if (!refreshToken) return crawler("sheets_error=no_refresh_token");
      const prev = await getConnection(tenantId);
      await saveConnection({ tenantId, refreshToken, googleEmail: prev?.googleEmail ?? null, siteUrl: prev?.siteUrl ?? null });
      return crawler("sheets=connected");
    } catch (err) {
      console.error("[gsc/callback] sheets connection failed:", err instanceof Error ? err.message : err);
      return crawler("sheets_error=exchange_failed");
    }
  }

  try {
    const { accessToken, refreshToken } = await exchangeCode(code);
    if (!refreshToken) {
      // prompt=consent should always yield one; treat absence as a hard error.
      return back(req, "gsc_error=no_refresh_token", page);
    }
    const sites = await listSites(accessToken);
    if (sites.length === 0) {
      return back(req, "gsc_error=no_properties", page);
    }
    // googleEmail: not available — the webmasters.readonly-only scope carries
    // no identity claim, and adding openid/email scopes is out of scope here.
    const siteUrl = sites.length === 1 ? sites[0].siteUrl : null;
    await saveConnection({ tenantId, refreshToken, googleEmail: null, siteUrl });
    return back(req, siteUrl ? "connected=1" : "connected=1&pick=1", page);
  } catch (err) {
    console.error("[gsc/callback] connection failed:", err instanceof Error ? err.message : err);
    return back(req, "gsc_error=exchange_failed", page);
  }
}
