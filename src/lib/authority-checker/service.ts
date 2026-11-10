// src/lib/authority-checker/service.ts — one Link Authority check, in order,
// with the cache read before any allowance or money moves.
//
//   1. Read the 7-day domain cache for everything the report needs: the
//      Echorank Authority of every domain, every domain's summary, and the
//      checked domain's top referring domains. Free.
//   2. All cached → the report, `cached: true`, no allowance used.
//   3. Otherwise reserve one check from the month's allowance (quota.ts),
//      refused at the limit, then buy only what was missing, metered to the
//      tenant (data.ts). A failed purchase gives the check back: the tenant
//      paid nothing for an answer they did not get, and what was bought before
//      the failure is cached, so the retry costs less.
//
// The route decides who may run a check (session, paid plan, plan area); this
// module only reads, counts and buys.

import "server-only";

import type { PlanType } from "@/generated/prisma";
import { buyLinks, buyRanks, buyRefDomains, cachedLinks, cachedRanks, cachedRefDomains } from "./data";
import type { PdfReport } from "./pdf";
import { linkAuthorityUsage, releaseLinkAuthorityCheck, reserveLinkAuthorityCheck } from "./quota";
import type { DomainRow, LinkAuthorityReport, LinkMetrics, ReferringDomainRow } from "./types";

export interface CheckInput {
  tenantId: string;
  plan: PlanType;
  domain: string;
  competitors: string[];
}

function comparisonRows(domains: string[], authority: Record<string, number | null>, links: Map<string, LinkMetrics>): DomainRow[] {
  return domains.map((d) => ({ domain: d, authority: authority[d] ?? null, ...(links.get(d) as LinkMetrics) }));
}

/**
 * The report rebuilt from the 7-day domain cache alone, for the PDF: no
 * allowance, no purchase. Null when any piece has left the cache (the page
 * then asks for the check to be run again).
 */
export async function cachedLinkAuthorityReport(
  input: { domain: string; competitors: string[] },
  checkedAt: string,
  now = new Date(),
): Promise<PdfReport | null> {
  const domains = [input.domain, ...input.competitors];
  const { known: authority, missing } = await cachedRanks(domains, now);
  if (missing.length > 0) return null;
  const links = new Map<string, LinkMetrics>();
  for (const d of domains) {
    const hit = await cachedLinks(d, now);
    if (!hit) return null;
    links.set(d, hit);
  }
  const refDomains = await cachedRefDomains(input.domain, now);
  if (refDomains === null) return null;
  return {
    domain: input.domain,
    checkedAt,
    authority: authority[input.domain] ?? null,
    links: links.get(input.domain) as LinkMetrics,
    comparison: comparisonRows(domains, authority, links),
    referringDomains: refDomains,
  };
}

export async function runLinkAuthorityCheck(input: CheckInput, now = new Date()): Promise<LinkAuthorityReport> {
  const domains = [input.domain, ...input.competitors];

  const { known: authority, missing: missingRanks } = await cachedRanks(domains, now);
  const links = new Map<string, LinkMetrics>();
  const missingLinks: string[] = [];
  for (const d of domains) {
    const hit = await cachedLinks(d, now);
    if (hit) links.set(d, hit);
    else missingLinks.push(d);
  }
  let refDomains: ReferringDomainRow[] | null = await cachedRefDomains(input.domain, now);

  const cached = missingRanks.length === 0 && missingLinks.length === 0 && refDomains !== null;
  let usage;
  if (cached) {
    usage = await linkAuthorityUsage(input.tenantId, input.plan, now);
  } else {
    // Throws LinkAuthorityQuotaExceededError at the limit, before any purchase.
    usage = await reserveLinkAuthorityCheck(input.tenantId, input.plan, now);
    try {
      Object.assign(authority, await buyRanks(input.tenantId, missingRanks, now));
      for (const d of missingLinks) links.set(d, await buyLinks(input.tenantId, d, now));
      if (refDomains === null) refDomains = await buyRefDomains(input.tenantId, input.domain, now);
    } catch (err) {
      await releaseLinkAuthorityCheck(input.tenantId, now);
      throw err;
    }
  }

  const comparison: DomainRow[] = comparisonRows(domains, authority, links);
  return {
    domain: input.domain,
    competitors: input.competitors,
    checkedAt: now.toISOString(),
    authority: authority[input.domain] ?? null,
    links: links.get(input.domain) as LinkMetrics,
    comparison,
    referringDomains: refDomains ?? [],
    cached,
    usage,
  };
}
