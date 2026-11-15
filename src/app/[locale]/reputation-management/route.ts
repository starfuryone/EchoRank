import { REPUTATION_MANAGEMENT_HTML } from "./landing-html";
import { withPlanPriceSpans } from "./prices";

/**
 * Standalone reputation-management hub, served as a raw HTML document. A
 * route handler (not page.tsx) because the markup is a complete document with
 * its own <head> and self-contained CSS; the app shell would double the
 * chrome. Same body for every locale (en-only copy, canonical
 * /en/reputation-management), headers as technical-geo's.
 *
 * Two things its siblings do are left out on purpose, because the payload is
 * the owner's file served verbatim:
 *   - withThemeSchedule(): it swaps the legacy Night/Day init script, and this
 *     document has none (no script at all, no toggle). Nothing to swap.
 *   - withCompanyLine(): the footer's .legal line already carries the company
 *     name, number and office, so injecting COMPANY_LINE would print it twice.
 */
export function GET() {
  // Prices from PLAN_CONFIGS (./prices.ts); the payload's typed numbers are replaced.
  return new Response(withPlanPriceSpans(REPUTATION_MANAGEMENT_HTML), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
