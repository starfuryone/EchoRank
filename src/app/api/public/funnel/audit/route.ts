// POST /api/public/funnel/audit?key=ef_<32hex>
//
// The white-label funnel's one write: capture a lead, then reveal a score.
//
// ═══════════════════════════════════════════════════════════════════════════
// THE ORIGIN ALLOWLIST REPLACES THE HOST CSRF CHECK. READ THIS BEFORE EDITING.
// ═══════════════════════════════════════════════════════════════════════════
//
// csrfProtection() in src/proxy.ts asks "is Origin one of OUR hosts". Every
// legitimate call here fails that by construction — the caller is a widget on
// an AGENCY's site — so the check would reject 100% of real traffic and 0% of
// attacks. src/proxy.ts exempts this exact path, the same way it already
// exempts /api/collect, and lists the reasoning there too.
//
// What replaces it is FunnelConfig.allowedOrigins, and it is strictly narrower
// than the rule it displaces: not "same origin as us" but "one of the exact
// https origins this specific funnel's owner listed". Three properties make
// that a real control rather than a decorative one:
//
//   1. Origin is set by the BROWSER and cannot be written by page script. That
//      is only true because the request is issued from the agency's own page —
//      see the note below on why the iframe does not make this call.
//   2. A missing Origin is REFUSED, never waved through. See originAllowed().
//   3. The route reads no cookie and holds no session, so a forged request has
//      no ambient authority to borrow even if it got past 1 and 2. The key in
//      the query string is an identifier, not a credential (lib/funnel/keys.ts).
//
// ── Why the PARENT page posts this, not the iframe ─────────────────────────
// The obvious design — let the /embed/audit iframe fetch this endpoint — makes
// the allowlist meaningless, and it is worth stating exactly how, because the
// failure is silent. The iframe is served from OUR origin. A fetch from inside
// it is same-origin to us, so the browser sets `Origin: https://echorank360.com`
// — our own host, on every request, from every site in the world. The allowlist
// would then either pass for everyone or, if the frame were sandboxed to an
// opaque origin, arrive as the literal string "null" and fail for everyone.
//
// So the loader on the agency's page issues this request and relays the result
// into the iframe over postMessage. That is what makes Origin genuinely the
// agency's, browser-set and unforgeable from script. The iframe stays for
// presentation only — it isolates our styling from the host page's, which is
// the reason to have one at all.
//
// ── text/plain, and therefore no preflight ─────────────────────────────────
// The body is JSON text sent as text/plain, which keeps this a CORS "simple
// request": no OPTIONS round trip in front of every submission. This is the
// same trick /api/public/attribution.js uses for the beacon, and the comment
// there is the other half of this one. The response still needs
// Access-Control-Allow-Origin because the widget READS the score back, and that
// header is reflected only for an origin that passed the allowlist.

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/infrastructure/observability/logger";
import { isFunnelKey } from "@/lib/funnel/keys";
import { originAllowed } from "@/lib/funnel/origins";
import { funnelByKey, recordLead } from "@/lib/funnel/store";
import {
  consumeFunnelIpLimit,
  reserveFunnelAudit,
  releaseFunnelAudit,
} from "@/lib/funnel/quota";
import {
  normalizeFunnelDomain,
  normalizeLeadEmail,
  runFunnelAudit,
} from "@/lib/funnel/audit";
import { notifyFunnelLead } from "@/lib/funnel/notify";

/** Small: the body is three short strings. Anything larger is not our widget. */
const MAX_BODY_BYTES = 4 * 1024;

/** CORS headers for an origin that already passed the allowlist. */
function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    // The response body differs by which origin asked, so a shared cache must
    // not serve one agency's answer to another's.
    Vary: "Origin",
    "Cache-Control": "no-store",
  };
}

/**
 * A refusal that reveals nothing.
 *
 * An unknown key, a key belonging to a disallowed origin, an inactive funnel
 * and a churned tenant all return this identical 403 with NO CORS header. The
 * uniformity is deliberate: distinguishing them would turn this endpoint into
 * an oracle for enumerating which keys exist and which origins each one trusts,
 * and the widget has nothing useful to do with the difference anyway.
 */
function forbidden(): NextResponse {
  return NextResponse.json(
    { error: "forbidden" },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  // Shape first, before any database call. 32 hex characters cannot be an
  // injection, and a malformed key never becomes a query.
  if (!isFunnelKey(key)) return forbidden();

  const origin = request.headers.get("origin");

  const funnel = await funnelByKey(key);
  if (!funnel) return forbidden();

  // ── 1. Authorization. The allowlist, standing in for the CSRF check. ──────
  if (!originAllowed(origin, funnel.allowedOrigins)) return forbidden();
  // Past this point the origin is known-good and safe to reflect.
  const cors = corsHeaders(origin as string);

  // An off switch and a churned tenant are the same answer to the visitor: the
  // widget simply does not work. Checked after the origin so that neither state
  // is distinguishable from outside.
  if (!funnel.active || !funnel.billingActive) return forbidden();

  // ── 2. Burst limit, per key + IP. Before anything that costs. ─────────────
  // cf-connecting-ip only, per src/lib/free-tools/limits.ts: x-forwarded-for is
  // client-controllable, and accepting it as a fallback would make this limit
  // opt-out. No IP means no limit can be enforced, so the request is refused
  // rather than served uncapped.
  const ip = request.headers.get("cf-connecting-ip")?.trim() || null;
  if (!ip) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: cors });
  }
  const burst = await consumeFunnelIpLimit(key, ip);
  if (!burst.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: cors });
  }

  // ── 3. Parse and validate. Free, and it decides whether to reserve. ───────
  const raw = await request.text().catch(() => "");
  if (!raw || raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: cors });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: cors });
  }

  // THE EMAIL GATE. This is the lead capture and it is not optional: no address,
  // no audit, no score. Checked before the domain so a visitor who typed a good
  // domain and no email is told about the email, which is the field they left
  // blank.
  const email = normalizeLeadEmail(body.email);
  if (!email) {
    return NextResponse.json({ error: "email_required" }, { status: 400, headers: cors });
  }

  const domain = normalizeFunnelDomain(body.domain);
  if (!domain) {
    return NextResponse.json({ error: "invalid_domain" }, { status: 400, headers: cors });
  }

  // ── 4. Monthly cap, BEFORE the sidecar call. ─────────────────────────────
  const quota = await reserveFunnelAudit(funnel.tenantId, funnel.plan);
  if (!quota.allowed) {
    // The tenant is out of audits (or Redis is down and we failed closed). The
    // visitor is not told which — that is the agency's billing problem, not
    // something to surface on the agency's own marketing site.
    return NextResponse.json(
      { error: "unavailable" },
      { status: quota.unavailable ? 503 : 429, headers: cors },
    );
  }

  // ── 5. The audit. Never throws; a failure still capture the lead below. ──
  const audit = await runFunnelAudit(domain);
  if (!audit.ok) {
    // Give the slot back. The tenant is not charged for our sidecar being down,
    // and the IP's burst allowance is NOT refunded — that one exists to stop
    // hammering, and a failed attempt is still an attempt.
    await releaseFunnelAudit(funnel.tenantId);
  }
  const summary = audit.ok ? audit.summary : null;

  // ── 6. The lead. The whole point, and the one write that may not fail. ───
  // Stored even when the audit did not complete: the email is the asset, and
  // dropping it because the sidecar returned 502 would throw away the only
  // thing the agency is paying for. See the note on FunnelLead in the schema.
  let leadId: string;
  try {
    const lead = await recordLead({
      tenantId: funnel.tenantId,
      funnelId: funnel.id,
      email,
      domain,
      summary,
      ip,
    });
    leadId = lead.id;
  } catch (err) {
    logger.error(
      { funnelId: funnel.id, tenantId: funnel.tenantId, err },
      "funnel lead write failed - the visitor is told nothing was captured",
    );
    if (audit.ok) await releaseFunnelAudit(funnel.tenantId);
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: cors });
  }

  // ── 7. Notify. NEVER blocks the response. ────────────────────────────────
  // Not awaited: a visitor is watching a spinner on somebody else's marketing
  // site, and neither an SMTP timeout nor a notifications-table hiccup may be
  // in front of their score. notifyFunnelLead() is documented as never
  // rejecting; the .catch() is belt-and-braces so an unhandled rejection can
  // never take the process down.
  void notifyFunnelLead({
    tenantId: funnel.tenantId,
    funnelId: funnel.id,
    funnelLabel: funnel.label,
    leadId,
    email,
    domain,
    score: summary?.score ?? null,
    notifyEmail: funnel.notifyEmail,
  }).catch(() => {});

  // ── 8. The reveal. ───────────────────────────────────────────────────────
  if (!summary) {
    // Captured, but there is no score to show. Said plainly rather than
    // dressed up as a zero — a fabricated score on an agency's own site is the
    // worst possible failure mode for this feature.
    return NextResponse.json(
      { error: "audit_failed", captured: true },
      { status: 502, headers: cors },
    );
  }

  return NextResponse.json(
    { domain, score: summary.score, grade: summary.grade, gaps: summary.gaps },
    { status: 200, headers: cors },
  );
}
