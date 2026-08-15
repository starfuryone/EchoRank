// src/lib/funnel/branding.ts
//
// The identity the embedded widget wears. ZERO Echorank chrome — see below.
//
// ── Same source as Prompt 7, one level deeper ───────────────────────────────
// src/lib/opportunity-scanner/branding.ts owns the tenant's white-label
// identity and the guarded logo fetch. This reuses inlineLogo() from it
// verbatim, so there is exactly one implementation of "turn a customer-typed
// logo URL into bytes safely" in the codebase, and its four brakes are stated
// once (guardCheckUrl, 5s timeout, content-type allowlist, byte cap on the
// BODY rather than on Content-Length).
//
// What is new here is the LAYER. brandingFor() answers "who is this tenant";
// a funnel needs "who is this funnel", because an agency runs one widget per
// client and each carries its client's mark, not the agency's. So:
//
//     FunnelConfig.branding  ->  Tenant white-label  ->  neutral defaults
//
// Neutral, not ours. A funnel with nothing configured renders as an unbranded
// grey form, never as an Echorank one — falling back to our own mark would put
// our brand on a stranger's marketing site, which is the precise failure this
// whole feature is defined by not having.
//
// ── Why the app fetches the logo and the sidecar never does ─────────────────
// Verbatim from Prompt 7's reasoning, which applies unchanged: the sidecar sits
// on 127.0.0.1 with no egress policy and no URL guard, so an outbound GET from
// there with a customer-controlled target is an SSRF primitive. The funnel makes
// this sharper, not softer — logoUrl here is reachable by anyone who can PATCH a
// funnel config, and the audit path talks to that same sidecar. Nothing in this
// file is ever forwarded to it.
//
// ── The logo is rendered in an <img>, and that is load-bearing ──────────────
// inlineLogo() returns an SVG data: URI. An SVG can carry <script>, so the tag
// it lands in decides whether that matters: inside <img src>, browsers render
// SVG in a restricted mode with scripting and external fetches disabled, while
// an inline <svg> element or an <object>/<embed> would execute it. Whoever
// changes the embed page must keep it an <img>. This is the only place a
// customer-supplied document reaches a visitor's browser.

import { inlineLogo } from "@/lib/opportunity-scanner/branding";
import { prisma } from "@/lib/prisma";

/** What the embed page renders. Every field is safe to interpolate. */
export interface FunnelBranding {
  /** Displayed name. Empty renders no wordmark rather than a placeholder. */
  name: string;
  /** Inlined data: URI, or null. Always rendered via <img>. */
  logoDataUri: string | null;
  /** `#rrggbb`, validated. Never interpolated unvalidated into CSS. */
  accentColor: string;
}

/**
 * Neutral grey. NOT an Echorank colour, and not brandPrimaryColor's default
 * either — this is what an unconfigured funnel wears on somebody else's site.
 */
const DEFAULT_ACCENT = "#334155";

/** Bounded so a long name cannot break the widget's layout on a live site. */
const MAX_NAME_LENGTH = 60;

/**
 * `#rgb` or `#rrggbb`, normalised to six lowercase digits.
 *
 * THIS VALUE IS INTERPOLATED INTO CSS. Anything that is not six hex digits is
 * discarded rather than escaped: a colour is a closed, tiny grammar, and an
 * allowlist over it removes the entire question of what `--accent: red;
 * } body { ... ` would do.
 */
export function normalizeAccentColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  const short = /^#([0-9a-f]{3})$/.exec(value);
  if (short) {
    const [r, g, b] = short[1];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return /^#[0-9a-f]{6}$/.test(value) ? value : null;
}

/** The `branding` jsonb column, as stored. Every field optional. */
export interface FunnelBrandingInput {
  name?: string | null;
  logoUrl?: string | null;
  accentColor?: string | null;
}

/**
 * Validate what an agency submitted for the branding column.
 *
 * logoUrl is stored RAW and guarded at fetch time rather than at write time.
 * That ordering is on purpose: guardCheckUrl's verdict depends on DNS, so a
 * host that resolves publicly today can resolve to 169.254.169.254 tomorrow,
 * and a check performed once at save would have approved it permanently. The
 * guard belongs immediately before the fetch, which is where inlineLogo puts
 * it. What we do enforce at write is the shape — http(s) and a length — so the
 * column cannot hold a `javascript:` or a multi-megabyte data: URI.
 */
export function sanitizeBrandingInput(raw: unknown): FunnelBrandingInput {
  const input = (raw ?? {}) as Record<string, unknown>;

  const name =
    typeof input.name === "string" ? input.name.trim().slice(0, MAX_NAME_LENGTH) : "";

  let logoUrl: string | null = null;
  if (typeof input.logoUrl === "string" && input.logoUrl.trim()) {
    const candidate = input.logoUrl.trim().slice(0, 2048);
    if (/^https?:\/\//i.test(candidate)) logoUrl = candidate;
  }

  return {
    name: name || null,
    logoUrl,
    accentColor: normalizeAccentColor(input.accentColor),
  };
}

/**
 * Resolve the branding one funnel renders with.
 *
 * `fetchImpl` is injectable for the same reason it is on inlineLogo: the guard
 * behaviour is the part worth asserting and it should be assertable without a
 * network.
 */
export async function resolveFunnelBranding(
  funnel: { tenantId: string; branding: unknown },
  fetchImpl: typeof fetch = fetch,
): Promise<FunnelBranding> {
  const own = sanitizeBrandingInput(funnel.branding);

  // Only read the tenant for the fields the funnel did not answer for itself.
  // A fully configured funnel costs no query.
  const needsFallback = !own.name || !own.accentColor || !own.logoUrl;
  const tenant = needsFallback
    ? await prisma.tenant.findUnique({
        where: { id: funnel.tenantId },
        select: {
          name: true,
          logo: true,
          brandPrimaryColor: true,
          whitelabel: true,
        },
      })
    : null;

  // Tenant fields apply ONLY when white-label is on. That flag is the tenant's
  // own switch, and brandingFor() reads it the same way: a tenant who has not
  // turned it on has not asked us to put their name on anything.
  const fallback = tenant?.whitelabel ? tenant : null;

  const logoSource = own.logoUrl ?? fallback?.logo ?? null;

  return {
    name: own.name ?? fallback?.name ?? "",
    logoDataUri: await inlineLogo(logoSource, fetchImpl),
    accentColor:
      own.accentColor ?? normalizeAccentColor(fallback?.brandPrimaryColor) ?? DEFAULT_ACCENT,
  };
}

export const __testing = { DEFAULT_ACCENT, MAX_NAME_LENGTH };
