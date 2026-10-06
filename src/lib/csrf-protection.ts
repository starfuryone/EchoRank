import { NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

export function validateOrigin(request: NextRequest): boolean {
  if (SAFE_METHODS.includes(request.method)) return true;

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin) {
    // Allow same-origin requests without Origin header (e.g., form submissions)
    // But require it for API calls via fetch
    const referer = request.headers.get("referer");
    if (!referer) {
      // No Origin and no Referer on a state-changing request. Browser clients
      // always send at least one; deny by default. Stripe webhooks are already
      // excluded upstream in middleware.ts. Set CSRF_ALLOW_NO_ORIGIN=true only
      // if a trusted non-browser caller legitimately needs this path.
      return process.env.CSRF_ALLOW_NO_ORIGIN === "true";
    }
    const refererHost = new URL(referer).host;
    return refererHost === host;
  }

  const originHost = new URL(origin).host;
  return originHost === host;
}

export function csrfProtection(request: NextRequest): NextResponse | null {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  return null; // Passed
}

/**
 * Auth.js session cookie, any spelling: authjs (v5) or next-auth (v4), with
 * the __Secure-/__Host- prefixes and the .0/.1 chunks a large JWT is split into.
 */
const SESSION_COOKIE_RE = /^(?:__Secure-|__Host-)?(?:authjs|next-auth)\.session-token(?:\.\d+)?$/;

/**
 * A server-to-server call: it authenticates with `Authorization: Bearer …` and
 * carries no session cookie. Such a request has no ambient browser authority
 * for a forged cross-site POST to borrow, so the origin check protects nothing
 * on it. A request that carries a session cookie is a browser and keeps the
 * check, Bearer header or not.
 */
export function isBearerWithoutSession(request: Pick<NextRequest, "headers" | "cookies">): boolean {
  const auth = request.headers.get("authorization") ?? "";
  if (!/^Bearer \S+/.test(auth)) return false;
  return !request.cookies.getAll().some((c) => SESSION_COOKIE_RE.test(c.name));
}
