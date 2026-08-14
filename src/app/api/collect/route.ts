// POST /api/collect — the attribution beacon endpoint.
//
// Called by the snippet at /api/public/attribution.js, from the customer's
// domain, on a page we do not control. Everything about this route follows from
// that: it is cookie-free, cross-origin by design, cheap, and it never trusts a
// single field in the body except as raw material to re-derive from.
//
// ── proxy.ts ────────────────────────────────────────────────────────────────
// "/api/collect" has no dot, so unlike the snippet route it DOES go through the
// proxy, and it needs two exemptions there, for two different mechanisms:
//   1. publicExactPaths — otherwise the missing session cookie 307s the POST to
//      /login. Exact-match, so nothing added later under /api/collect/* inherits
//      anonymity.
//   2. the CSRF origin check — that check runs BEFORE the public lists and
//      compares Origin host to Host. Every legitimate call here is cross-origin,
//      so without the exemption every beacon is a 403.
// The CSRF exemption is safe here because the route reads no cookie and holds
// no session: there is no ambient authority for a forged request to borrow. The
// only credential is the publishable key in the body, and possessing it is the
// entire authorization — which is also why the key can do nothing but append a
// row to its own tenant.
//
// ── What is NOT trusted ─────────────────────────────────────────────────────
// The snippet classifies before it sends, purely to avoid a request per page
// view on non-AI traffic, and that verdict is not in the payload and would be
// ignored if it were. classifyReferrer() runs here, on the referrer and landing
// URL, and its answer is what gets stored. A visitor hand-crafting a beacon can
// choose their own visitorId and their own landing page — both are already
// theirs — but they cannot choose a source, and they cannot reach another
// tenant, because the tenant comes from the key and the unique constraint is
// tenant-first.

import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { rateLimit } from "@/lib/rate-limit";
import { verifyAttributionKey } from "@/lib/attribution/keys";
import {
  classifyReferrer,
  extractUtm,
  landingPathOf,
  storableReferrer,
} from "@/lib/attribution/classify";

/** Beacons are ~400 bytes. Anything past this is not one. */
const MAX_BODY_BYTES = 4096;

/** Per (tenant, IP). A real visitor fires one beacon per page view. */
export const COLLECT_LIMIT_PER_TENANT_IP = 60;
/**
 * Per IP, before the key is resolved. Bounds how fast an unauthenticated caller
 * can make us hash-and-look-up keys it invented. Higher than the tenant limit
 * because one office NAT can legitimately carry several tenants' visitors.
 */
export const COLLECT_LIMIT_PER_IP = 300;
const WINDOW_MS = 60_000;

/** The er_vid cookie value: 16 random bytes, hex. Nothing else is accepted. */
const VISITOR_ID_PATTERN = /^[0-9a-f]{32}$/;

const CORS_HEADERS: Record<string, string> = {
  // No credentials are ever sent or read, so "*" grants nothing: there is no
  // ambient authority on this origin for a page to borrow.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

/**
 * Every outcome is 204 with no body.
 *
 * The caller is sendBeacon, which discards the response and cannot retry, so a
 * status code is not feedback to anyone who can act on it — while a
 * distinguishable error IS feedback to someone probing which keys exist. One
 * response for "stored", "not AI traffic", "unknown key" and "rate limited"
 * ends that. Real failures are logged server-side; setup problems surface in
 * the dashboard, where the tenant is authenticated.
 */
function noContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function OPTIONS(): Promise<NextResponse> {
  // The snippet sends text/plain to stay a CORS "simple request", so a preflight
  // should never happen. Answering one anyway costs nothing and keeps the fetch
  // fallback working if a future Content-Type stops being simple.
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const ip = getClientIp(request.headers);

    const ipBudget = await rateLimit(`collect:ip:${ip}`, COLLECT_LIMIT_PER_IP, WINDOW_MS);
    if (!ipBudget.success) return noContent();

    const raw = await request.text();
    if (!raw || raw.length > MAX_BODY_BYTES) return noContent();

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return noContent();
    }
    if (!body || typeof body !== "object") return noContent();

    const { k, v, u, r } = body as Record<string, unknown>;
    if (typeof v !== "string" || !VISITOR_ID_PATTERN.test(v)) return noContent();
    if (typeof u !== "string" || u.length > 2048) return noContent();
    const referrer = typeof r === "string" && r.length <= 2048 ? r : null;

    const verified = await verifyAttributionKey(k);
    if (!verified) return noContent();

    // Tenant-scoped budget, checked after the key resolves so it is charged to
    // the tenant that owns the traffic rather than to whoever sent the bytes.
    const tenantBudget = await rateLimit(
      `collect:${verified.tenantId}:${ip}`,
      COLLECT_LIMIT_PER_TENANT_IP,
      WINDOW_MS,
    );
    if (!tenantBudget.success) return noContent();

    // ── The authoritative classification ────────────────────────────────
    const { source } = classifyReferrer({ referrer, landingUrl: u });
    if (!source) return noContent();

    const landingPath = landingPathOf(u);
    if (!landingPath) return noContent();

    const utm = extractUtm(u);
    const now = new Date();

    const { prisma } = await import("@/lib/prisma");
    await prisma.aiVisit.upsert({
      where: {
        tenantId_visitorId_source_landingPath: {
          tenantId: verified.tenantId,
          visitorId: v,
          source,
          landingPath,
        },
      },
      create: {
        tenantId: verified.tenantId,
        visitorId: v,
        source,
        landingPath,
        referrer: storableReferrer(referrer),
        utm: Object.keys(utm).length > 0 ? utm : undefined,
        firstSeen: now,
        lastSeen: now,
      },
      // firstSeen is absent on purpose and must stay absent. It is the anchor
      // the 28-day "new AI-referred visitors" trend is built on; touching it
      // here would let a returning visitor re-date their own first arrival and
      // silently inflate every daily figure on the chart.
      update: {
        lastSeen: now,
        hits: { increment: 1 },
      },
    });

    return noContent();
  } catch (error) {
    // Never surface anything: see noContent(). Logged so a broken collector is
    // visible to us rather than only to the customer's empty dashboard.
    console.error("[collect]", error);
    return noContent();
  }
}
