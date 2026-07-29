// GET /api/seo/v1/web-analytics/callback — OAuth redirect target.
//
// ⚠ This exact URL must be registered in Google Cloud Console under the OAuth
// client's Authorized redirect URIs, alongside the analytics.readonly scope on
// the consent screen. Without either, Google rejects the flow before this
// handler runs.
//
// Reached as a top-level GET navigation, so the SameSite=Lax session cookie IS
// sent and requirePaidPlan works — no proxy.ts public-list change needed.
// State must verify AND match the session tenant, so both CSRF and a stolen
// state replayed by another tenant fail closed. Every failure lands back on
// the tool page with a machine-readable ?ga_error the page renders localized.
import { NextRequest, NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { verifyState } from "@/lib/gsc/state";
import { exchangeCode, listProperties, GaScopeError } from "@/lib/ga/client";
import { saveConnection } from "@/lib/ga/service";

const PAGE = "/visibility/tools/web-analytics";
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://echorank360.com";

function back(params: string): NextResponse {
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
    // User declined on Google's screen, or the scope is not on the consent
    // screen at all — Google reports both here.
    return back("ga_error=denied");
  }

  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const stateTenant = verifyState(state);
  if (!code || !stateTenant || stateTenant !== tenantId) {
    return back("ga_error=bad_state");
  }

  try {
    const { accessToken, refreshToken } = await exchangeCode(code);
    if (!refreshToken) {
      // prompt=consent should always yield one; treat absence as a hard error
      // rather than storing a connection that cannot be refreshed.
      return back("ga_error=no_refresh_token");
    }

    const properties = await listProperties(accessToken);
    if (properties.length === 0) {
      return back("ga_error=no_properties");
    }

    // Auto-select when there is exactly one; otherwise the page shows a picker.
    const only = properties.length === 1 ? properties[0] : null;
    await saveConnection({
      tenantId,
      refreshToken,
      propertyId: only?.propertyId ?? null,
      propertyName: only?.displayName ?? null,
    });
    return back(only ? "connected=1" : "connected=1&pick=1");
  } catch (err) {
    if (err instanceof GaScopeError) {
      // Operator-fixable: the consent screen lacks analytics.readonly.
      return back("ga_error=missing_scope");
    }
    console.error(
      "[web-analytics/callback] connection failed:",
      err instanceof Error ? err.message : err,
    );
    return back("ga_error=exchange_failed");
  }
}
