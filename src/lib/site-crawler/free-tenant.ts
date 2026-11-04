// src/lib/site-crawler/free-tenant.ts
//
// The free public site crawler's system tenant. Every free crawl belongs to
// ONE workspace, slug `free-crawler`, source "free":
//   - no members, no subscription, billingStatus NONE, so no dashboard route
//     can ever open it (requirePaidPlan) and no paid tenant can see its crawls
//     (every crawl query is tenant-scoped);
//   - its crawls count toward no paid quota (quotas count per tenant);
//   - anything that counts tenants or revenue filters `source: "customer"`
//     (CUSTOMER_TENANTS below);
//   - in the queue its crawls carry FREE_CRAWL_PRIORITY, behind every paid
//     crawl, and fair share holds it to exactly one running at a time whatever
//     /admin says (tenantHasCrawlSlot);
//   - the runner gives its crawls FREE_CRAWL_MAX_DURATION_MS, never renders
//     and never runs an opt-in (free-crawl.ts creates them with no config).
// Created on first use, so a deploy needs no data step.

import "server-only";
import { prisma } from "@/lib/prisma";

export const FREE_TENANT_SLUG = "free-crawler";
export const FREE_TENANT_SOURCE = "free";

/** Where-clause for "real workspaces": the one place tenant counts start from. */
export const CUSTOMER_TENANTS = { source: "customer" } as const;

/**
 * BullMQ priority for a free crawl. BullMQ runs jobs added WITHOUT a priority
 * (every paid crawl) before any prioritized job, and prioritized jobs lowest
 * number first — so any value here is behind every paid crawl.
 */
export const FREE_CRAWL_PRIORITY = 1_000;

/** Wall-clock ceiling for a free crawl (a paid one gets MAX_CRAWL_DURATION_MS). */
export const FREE_CRAWL_MAX_DURATION_MS = 10 * 60_000;

let cached: string | null = null;

/** The system tenant's id, created the first time it is needed. */
export async function freeTenantId(): Promise<string> {
  if (cached) return cached;
  const t = await prisma.tenant.upsert({
    where: { slug: FREE_TENANT_SLUG },
    create: { slug: FREE_TENANT_SLUG, name: "Free site crawler (system)", source: FREE_TENANT_SOURCE },
    update: {},
    select: { id: true },
  });
  cached = t.id;
  return t.id;
}

export function isFreeSource(source: string | null | undefined): boolean {
  return source === FREE_TENANT_SOURCE;
}

/** Tests only. */
export function __resetFreeTenantCache(): void {
  cached = null;
}
