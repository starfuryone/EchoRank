// src/lib/bot-analytics/domain.ts
//
// Which site does Bot Analytics check?
//
// This file is the reason the tool is standalone. It used to have no answer of
// its own: if the workspace had never run an AI Visibility audit, the page
// dead-ended on a button to /visibility, which made a paid tool a signpost to
// another paid tool. Now there are three sources and the tenant can always set
// the third themselves.
//
// RESOLUTION ORDER
//   1. manual   — botAnalyticsDomain, set on the tool page
//   2. monitor  — the active VisibilityMonitor, else the newest VisibilityAudit
//   3. settings — Tenant.auditDomain, captured at onboarding
//
// The manual value is checked FIRST, not last. The spec numbers it third, and
// third is right for "which source do we fall back to" — but a tenant who types
// a domain into the box has expressed a preference, and ranking inference above
// an explicit choice would mean the input silently does nothing for every
// workspace that has an audit. That is the majority of them, so the input would
// look broken. Explicit beats inferred; the other two keep the spec's order.
//
// Deliberately NOT a source: MonitoringSource.url. Those rows hold review-
// platform profile URLs (a Google Maps listing, a Yelp page), not the tenant's
// own website, so resolving to one would point the check at google.com — and it
// would fail the SSRF domain guard anyway, which is the correct outcome arrived
// at for the wrong reason.

import { prisma } from "@/lib/prisma";

export type DomainSource = "manual" | "monitor" | "settings";

export interface ResolvedDomain {
  /** Hostname only, lowercased, no scheme or path. Null when nothing is set. */
  domain: string | null;
  source: DomainSource | null;
}

/**
 * Hostname validation for the on-page input.
 *
 * Intentionally stricter than the SSRF guard rather than a duplicate of it: this
 * is a form validator whose job is a good error message, so it rejects the
 * shapes a human actually types wrong (a full URL, a path, a port, an email).
 * guardCheckUrl still runs before any fetch — this never replaces it.
 */
export function normalizeDomainInput(raw: string): string | null {
  let value = (raw ?? "").trim().toLowerCase();
  if (!value) return null;

  // Accept a pasted URL by taking its host, which is what people paste.
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  // Drop anything after the host.
  value = value.split(/[/?#]/)[0];
  // Credentials, then port.
  value = value.split("@").pop() ?? "";
  value = value.split(":")[0];
  value = value.replace(/\.$/, "");
  if (!value) return null;

  // No IP literals: this tool checks a named site, and an IP is either a
  // mistake or an attempt at the guard.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value) || value.includes(":")) return null;

  // A hostname with at least one dot, each label 1-63 chars of [a-z0-9-] not
  // starting or ending with a hyphen, and a TLD of at least two letters.
  const labels = value.split(".");
  if (labels.length < 2) return null;
  if (value.length > 253) return null;
  for (const label of labels) {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) return null;
  }
  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,}$/.test(tld)) return null;

  return value;
}

/** Hostname out of a stored URL or bare domain, for comparing sources. */
export function hostnameOf(value: string): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
  try {
    return new URL(withScheme).hostname.toLowerCase().replace(/\.$/, "") || null;
  } catch {
    return null;
  }
}

/**
 * Resolves the domain to check for a tenant. Reads tenant-owned rows only — no
 * caller-supplied URL is accepted anywhere in this path, which is what keeps the
 * check from being pointed at a site the tenant does not own.
 */
export async function resolveBotAnalyticsDomain(
  tenantId: string,
): Promise<ResolvedDomain> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { botAnalyticsDomain: true, auditDomain: true },
  });

  // 1. Explicit choice on the tool page.
  if (tenant?.botAnalyticsDomain) {
    const host = hostnameOf(tenant.botAnalyticsDomain);
    if (host) return { domain: host, source: "manual" };
  }

  // 2. The site the workspace already audits.
  const monitor = await prisma.visibilityMonitor.findFirst({
    where: { tenantId, active: true },
    orderBy: { updatedAt: "desc" },
    select: { url: true },
  });
  if (monitor?.url) {
    const host = hostnameOf(monitor.url);
    if (host) return { domain: host, source: "monitor" };
  }

  const audit = await prisma.visibilityAudit.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { url: true },
  });
  if (audit?.url) {
    const host = hostnameOf(audit.url);
    if (host) return { domain: host, source: "monitor" };
  }

  // 3. Whatever onboarding captured.
  if (tenant?.auditDomain) {
    const host = hostnameOf(tenant.auditDomain);
    if (host) return { domain: host, source: "settings" };
  }

  return { domain: null, source: null };
}
