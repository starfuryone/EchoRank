// The white-label audit widget, as rendered inside an iframe on an AGENCY's site.
//
// ═══════════════════════════════════════════════════════════════════════════
// ZERO ECHORANK CHROME. THIS IS THE ENTIRE PRODUCT PROMISE.
// ═══════════════════════════════════════════════════════════════════════════
// Nothing on this page may name us, link to us, or look like us. That is the
// same contract the outreach PDF is held to (see the filename note in
// src/app/api/agency/scan/[id]/rows/[rowId]/report/route.ts), and it is
// asserted the same way — tests/funnel.test.ts renders this page and greps the
// output for the brand, in the text, in the footer, and in every asset name.
//
// TWO LEAKS SPECIFIC TO BEING A NEXT PAGE, both handled below:
//
//   1. The root layout's title template appends "| Echorank360" to any bare
//      string title, and its default description is our marketing copy. Both
//      reach the DOM. `title.absolute` bypasses the template; `description` is
//      overridden explicitly. A page that simply omitted metadata would inherit
//      both and ship the brand inside the iframe.
//   2. No shared header, footer or nav component may be imported here, ever.
//      This page lives outside (dashboard) and outside [locale] precisely so
//      that no layout above it can add one.
//
// ── Proxy ───────────────────────────────────────────────────────────────────
// "/embed/audit" contains no dot, so unlike /api/public/funnel.js it IS matched
// by the proxy and would be 307'd to /login for every visitor — rendering our
// login page inside the agency's site. It is listed in publicExactPaths in
// src/proxy.ts for that reason. Exact-match, so nothing added later under
// /embed/ inherits anonymous access.
//
// ── This page never calls the audit endpoint ────────────────────────────────
// The submit is relayed to the PARENT window over postMessage and issued there,
// because that is the only way the Origin header carries the agency's origin
// rather than ours. The full reasoning is at the top of
// src/app/api/public/funnel/audit/route.ts.

import type { Metadata } from "next";
import { dashboardLocale, EMBED_AUDIT_COPY } from "@/lib/i18n/dashboard";
import { isFunnelKey } from "@/lib/funnel/keys";
import { funnelByKey } from "@/lib/funnel/store";
import { resolveFunnelBranding } from "@/lib/funnel/branding";
import { EmbedAuditClient } from "@/components/funnel/embed-audit-client";

/**
 * Absolute title and an explicit description, both brand-free. See leak 1 above.
 * noindex because this URL is a widget, not a page, and a search result for it
 * would be a dead end for whoever clicked it.
 */
export const metadata: Metadata = {
  title: { absolute: "Website audit" },
  description: "Check how AI assistants see a website.",
  robots: { index: false, follow: false },
};

/** Never prerendered: every render depends on a key and a database row. */
export const dynamic = "force-dynamic";

/**
 * What an unusable key renders.
 *
 * Deliberately silent about WHY. An unknown key, a paused funnel and a churned
 * tenant look identical here for the same reason they do in the audit route:
 * this markup is public, and telling a stranger which keys exist would make the
 * page an enumeration oracle. It is also the friendlier failure — a visitor on
 * an agency's site can do nothing with our diagnostics.
 */
function Unavailable() {
  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        padding: "24px",
        color: "#64748b",
        fontSize: "14px",
      }}
    >
      This audit form is not available right now.
    </div>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;

  // Shape before lookup. 32 hex characters cannot be an injection, and this
  // value is echoed back into the client component as the postMessage channel
  // id.
  if (!isFunnelKey(key)) return <Unavailable />;

  const funnel = await funnelByKey(key);
  if (!funnel || !funnel.active || !funnel.billingActive) return <Unavailable />;

  // The logo fetch happens HERE, server-side and behind guardCheckUrl — never
  // in the sidecar and never in the visitor's browser. See branding.ts.
  const branding = await resolveFunnelBranding(funnel);
  const locale = dashboardLocale(funnel.defaultLanguage);

  return (
    <EmbedAuditClient
      funnelKey={key}
      branding={branding}
      c={EMBED_AUDIT_COPY[locale]}
    />
  );
}
