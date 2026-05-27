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
    if (!referer) return true; // Server-to-server calls have neither
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
