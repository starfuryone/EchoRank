// src/lib/opportunity-scanner/branding.ts
//
// The tenant's white-label identity, packaged for the sidecar's PDF renderer.
//
// ── Why the app fetches the logo and the sidecar does not ───────────────────
// Tenant.logo is a URL the customer typed into their own settings page. Somebody
// has to turn it into bytes, and it must not be the sidecar: that process sits
// on 127.0.0.1 with no egress policy and no URL guard of its own, so an
// outbound GET from there is an SSRF primitive with a customer-controlled
// target. The comment above _load_logo_data_uri in av-service/pdf_report.py is
// the other half of this one.
//
// So it happens here, where guardCheckUrl already exists, and the sidecar
// receives an inline data: URI it re-validates anyway.
//
// ── Four brakes on the fetch, none of them optional ─────────────────────────
//   1. guardCheckUrl — no file:, no credentials, no odd ports, no IP literals,
//      no localhost, no .internal, no metadata endpoint.
//   2. A 5s timeout. This runs inside a PDF download the agency is waiting on.
//   3. A content-type allowlist, and SVG only — the sidecar draws vector art,
//      and a raster path would need a second draw routine for one code path.
//   4. A byte cap enforced on the BODY, not on Content-Length, because a
//      hostile server can lie about the latter.
//
// Everything fails to `null`, which renders as a wordmark in the tenant's own
// colour. A broken logo URL must never fail an agency's outreach PDF.

import { logger } from "@/infrastructure/observability/logger";
import { guardCheckUrl } from "@/lib/bot-analytics/url-guard";
import { prisma } from "@/lib/prisma";

/** What the sidecar's _Branding reads. Field names are the wire contract. */
export interface BrandingPayload {
  enabled: boolean;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  website: string;
  logoDataUri: string | null;
}

const LOGO_TIMEOUT_MS = 5_000;
/** Matches _MAX_LOGO_BYTES in av-service/pdf_report.py. */
const MAX_LOGO_BYTES = 512 * 1024;
const ALLOWED_TYPES = ["image/svg+xml", "text/xml", "application/xml"];

/**
 * Fetch a tenant logo and inline it, or return null.
 *
 * Exported for the tests, which is most of why it is separate from the
 * assembler below: the guard behaviour is the part worth asserting and it
 * should be assertable without a tenant row.
 */
export async function inlineLogo(
  rawUrl: string | null | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (!rawUrl) return null;

  // Already inline (a tenant who pasted a data: URI into settings). Pass it
  // through for the sidecar to validate; never fetch it.
  if (rawUrl.startsWith("data:")) {
    return rawUrl.length <= MAX_LOGO_BYTES ? rawUrl : null;
  }

  const guarded = guardCheckUrl(rawUrl);
  if (!guarded.ok || !guarded.url) {
    logger.warn({ reason: guarded.reason }, "opportunity-scanner: logo URL rejected by guard");
    return null;
  }

  try {
    const res = await fetchImpl(guarded.url, {
      signal: AbortSignal.timeout(LOGO_TIMEOUT_MS),
      // No credentials, no cookies, and do not follow a redirect into
      // somewhere the guard never saw. A logo that only resolves through a
      // redirect is a logo we decline to fetch.
      redirect: "error",
      cache: "no-store",
    });
    if (!res.ok) return null;

    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.includes(type)) return null;

    const buf = await res.arrayBuffer();
    // The cap is on what actually arrived. Content-Length is a claim.
    if (buf.byteLength === 0 || buf.byteLength > MAX_LOGO_BYTES) return null;

    const b64 = Buffer.from(buf).toString("base64");
    return `data:image/svg+xml;base64,${b64}`;
  } catch (err) {
    logger.warn({ err }, "opportunity-scanner: logo fetch failed");
    return null;
  }
}

/**
 * The branding block for one tenant's outreach PDF.
 *
 * `enabled` follows Tenant.whitelabel, the flag the settings page already
 * writes. A tenant on AGENCY who has not switched white-label on gets our
 * branding, which is the correct reading of that checkbox — it is their
 * setting, not a consequence of their plan.
 */
export async function brandingFor(
  tenantId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BrandingPayload> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      name: true,
      logo: true,
      brandPrimaryColor: true,
      brandSecondaryColor: true,
      whitelabel: true,
      // The agency's own hostname, which is the one thing on the PDF that tells
      // the prospect who to reply to. Tenant has no generic `website` column;
      // customDomain is the white-label field and it is populated by the same
      // settings page as the flag above, so it is the right — and only —
      // source. A tenant with white-label on and no custom domain gets a
      // footer with no URL rather than ours (see _Branding in pdf_report.py).
      customDomain: true,
    },
  });

  if (!tenant?.whitelabel) {
    return {
      enabled: false,
      name: "",
      primaryColor: "",
      secondaryColor: "",
      website: "",
      logoDataUri: null,
    };
  }

  return {
    enabled: true,
    name: tenant.name ?? "",
    primaryColor: tenant.brandPrimaryColor ?? "",
    secondaryColor: tenant.brandSecondaryColor ?? "",
    website: tenant.customDomain ?? "",
    logoDataUri: await inlineLogo(tenant.logo, fetchImpl),
  };
}
