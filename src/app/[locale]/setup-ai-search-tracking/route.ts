import { SETUP_AI_SEARCH_TRACKING_HTML } from "./landing-html";

/**
 * Standalone marketing landing page served as a raw HTML document. A route
 * handler (not page.tsx) because the markup is a complete document with its own
 * <head> and self-contained CSS — wrapping it in the app shell would double the
 * chrome. Same body for every locale (en-only copy, like other first-pass
 * pages); links inside it are locale-prefixed /en/... paths.
 *
 * Cache shape copied from /glossary: force-static and nothing else. Deliberately
 * NOT the "public, s-maxage=31536000" that /methodology and the two playbook
 * pages carry — a one-year edge TTL makes a Cloudflare purge mandatory on every
 * copy edit, and this page's copy is expected to move with the pricing it
 * quotes.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(SETUP_AI_SEARCH_TRACKING_HTML, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
