import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { csrfProtection } from "@/lib/csrf-protection";

const publicPaths = ["/", "/login", "/register", "/api/auth", "/api/feedback", "/f/"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // ── Origin validation for mutating API requests ────────────────────────
  // Exclude /api/webhooks/ since those come from external services (e.g., Stripe)
  if (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/webhooks/") &&
    req.method !== "GET" &&
    req.method !== "HEAD" &&
    req.method !== "OPTIONS"
  ) {
    const csrfResult = csrfProtection(req);
    if (csrfResult) return csrfResult;
  }

  const isPublic = publicPaths.some((path) => pathname.startsWith(path));
  if (isPublic) return NextResponse.next();

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
