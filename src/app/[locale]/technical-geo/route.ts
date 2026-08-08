import { TECHNICAL_GEO_HTML } from "./landing-html";

/**
 * Standalone marketing landing page served as a raw HTML document. A route
 * handler (not page.tsx) because the markup is a complete document with its
 * own <head> and self-contained CSS — wrapping it in the app shell would
 * double the chrome. Same body for every locale (en-only copy, like other
 * first-pass pages); links inside it are locale-prefixed /en/... paths.
 */
export function GET() {
  return new Response(TECHNICAL_GEO_HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
