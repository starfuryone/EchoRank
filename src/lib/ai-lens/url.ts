// src/lib/ai-lens/url.ts
//
// URL normalization and the own-domain rule.
//
// AI Lens is per-PAGE, not per-domain, so unlike Site Explorer this keeps the
// path. Two pages on one site routinely have very different gaps — that is the
// point of the tool — so collapsing to a domain would destroy the measurement.
//
// The SSRF guard is NOT here. It lives in the sidecar (ai_lens.py), next to the
// code that opens the socket, because that is the only place it cannot be
// bypassed: the sidecar is also reachable from the worker and from a script.
// Duplicating it here would create a second copy to keep correct.

import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { CROSS_DOMAIN_PLANS } from "./options";

export class InvalidUrlError extends Error {
  readonly statusCode = 400;
  constructor(message = "Enter a full URL like https://example.com/pricing") {
    super(message);
    this.name = "InvalidUrlError";
  }
}

export class ForeignDomainError extends Error {
  readonly statusCode = 403;
  constructor(
    readonly plan: PlanType,
    readonly knownDomains: string[],
  ) {
    super(
      knownDomains.length > 0
        ? `Your plan can analyze pages on ${knownDomains.join(", ")}. Analyzing other domains is an Agency feature.`
        : "Run an AI Visibility audit on your site first, so we know which domain is yours.",
    );
    this.name = "ForeignDomainError";
  }
}

const MAX_URL_LENGTH = 2000;

/**
 * Normalize to scheme + host + path + query, dropping the fragment.
 *
 * The fragment is client-side only and never reaches a server, so keeping it
 * would fragment the cache into entries that fetch byte-identical pages. Query
 * strings ARE kept: `?variant=b` can legitimately render different content.
 */
export function normalizeLensUrl(input: string): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) throw new InvalidUrlError();

  // Bare hostnames are what people paste; assume https rather than rejecting.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new InvalidUrlError();
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InvalidUrlError("Only http:// and https:// URLs can be analyzed.");
  }
  if (!parsed.hostname || !parsed.hostname.includes(".")) throw new InvalidUrlError();

  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  return parsed.toString();
}

// registrableDomain lives in @/lib/registrable-domain — a module with no
// imports, so callers that only need the eTLD+1 rule do not pull Prisma in
// through this file. Re-exported here because that is where it was, and the
// sidecar comment above still describes it.
import { registrableDomain } from "@/lib/registrable-domain";
export { registrableDomain };

/**
 * Every registrable domain this tenant has demonstrated it owns: the domain
 * captured at signup, plus anything it has audited or set up monitoring for.
 *
 * Audits and monitors are the evidence available — the product has no domain
 * verification step, so "has audited it" is the strongest signal there is. That
 * is a deliberately loose bar and the reason cross-domain is a plan gate rather
 * than a security boundary: this stops a STARTER tenant using the tool as a free
 * competitor scanner, not a determined actor from analyzing a public page they
 * could have fetched with curl anyway.
 */
export async function tenantDomains(tenantId: string): Promise<string[]> {
  const [tenant, audits, monitors] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { auditDomain: true } }),
    prisma.visibilityAudit.findMany({
      where: { tenantId },
      select: { url: true },
      distinct: ["url"],
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
    prisma.visibilityMonitor.findMany({
      where: { tenantId },
      select: { url: true },
      take: 50,
    }),
  ]);

  const domains = new Set<string>();
  for (const candidate of [
    tenant?.auditDomain ?? "",
    ...audits.map((a) => a.url),
    ...monitors.map((m) => m.url),
  ]) {
    const root = registrableDomain(candidate);
    if (root && root.includes(".")) domains.add(root);
  }
  return [...domains].sort();
}

/**
 * Throws unless this tenant may analyze this URL.
 *
 * SERVER-SIDE ONLY GATE. The client hides the free-URL affordance below Agency,
 * but this is what makes it true.
 */
export async function assertUrlAllowed(
  tenantId: string,
  plan: PlanType,
  normalizedUrl: string,
): Promise<void> {
  if (CROSS_DOMAIN_PLANS.includes(plan)) return;

  const target = registrableDomain(normalizedUrl);
  const owned = await tenantDomains(tenantId);
  if (!owned.includes(target)) throw new ForeignDomainError(plan, owned);
}
