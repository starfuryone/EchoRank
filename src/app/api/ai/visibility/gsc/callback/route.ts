// GET /api/ai/visibility/gsc/callback — OAuth redirect target (registered in
// Google Cloud). Reached as a top-level GET navigation, so the SameSite=Lax
// session cookie IS sent and requirePaidPlan works — no proxy.ts public-list
// change needed. State must verify AND match the session tenant (CSRF + a
// stolen-state flow for another tenant both fail closed). All failure modes
// land back on the tool page with a machine-readable ?gsc_error code that the
// page renders localized.
import { NextRequest, NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { verifyState } from "@/lib/gsc/state";
import { exchangeCode, listSites } from "@/lib/gsc/client";
import { saveConnection } from "@/lib/gsc/service";

const PAGE = "/visibility/tools/gsc-insights";
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://echorank360.com";
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://echorank360.com";

function back(req: NextRequest, params: string): NextResponse {
  return NextResponse.redirect(new URL(`${PAGE}?${params}`, BASE));
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
    // User declined on Google's screen.
    return back(req, "gsc_error=denied");
  }
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const stateTenant = verifyState(state);
  if (!code || !stateTenant || stateTenant !== tenantId) {
    return back(req, "gsc_error=bad_state");
  }

  try {
    const { accessToken, refreshToken } = await exchangeCode(code);
    if (!refreshToken) {
      // prompt=consent should always yield one; treat absence as a hard error.
      return back(req, "gsc_error=no_refresh_token");
    }
    const sites = await listSites(accessToken);
    if (sites.length === 0) {
      return back(req, "gsc_error=no_properties");
    }
    // googleEmail: not available — the webmasters.readonly-only scope carries
    // no identity claim, and adding openid/email scopes is out of scope here.
    const siteUrl = sites.length === 1 ? sites[0].siteUrl : null;
    await saveConnection({ tenantId, refreshToken, googleEmail: null, siteUrl });
    return back(req, siteUrl ? "connected=1" : "connected=1&pick=1");
  } catch (err) {
    console.error("[gsc/callback] connection failed:", err instanceof Error ? err.message : err);
    return back(req, "gsc_error=exchange_failed");
  }
}
