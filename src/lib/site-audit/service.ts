// src/lib/site-audit/service.ts
//
// Site Audit start path, shared by the POST route, the e2e script and tests.
//
// Order of operations:
//   1. 24 h cache      — free, and never touches the monthly allowance
//   2. monthly quota   — Redis reservation, rolled back if nothing was posted
//   3. task_post       — starts the crawl; billed PER PAGE CRAWLED
//   4. persist row     — status=queued; src/lib/site-audit/poll.ts finishes it
//
// The crawl itself is asynchronous and takes MINUTES, so this function returns
// as soon as the task is accepted. Everything after that is the poller's job.

import type { PlanType, SiteAudit } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { ONPAGE } from "@/lib/dataforseo/endpoints";
import { seoMeteredCallResult } from "@/lib/dataforseo/metering";
import { normalizeDomain } from "@/lib/site-explorer/domain";
import { crawlPageLimit, SITE_AUDIT_CACHE_TTL_MS } from "./options";
import {
  releaseSiteAudit,
  reserveSiteAudit,
  SiteAuditQuotaExceededError,
} from "./quota";
import type {
  IssuesSection,
  PagesSection,
  SiteAuditDto,
  SiteAuditStatus,
  SummarySection,
} from "./types";

export { SITE_AUDIT_CACHE_TTL_MS } from "./options";

/** Prisma row -> API shape. Decimal and Date never cross the wire raw. */
export function toAuditDto(
  row: SiteAudit,
  extra?: { cached?: boolean; now?: Date },
): SiteAuditDto {
  const dto: SiteAuditDto = {
    id: row.id,
    domain: row.domain,
    maxPages: row.maxPages,
    status: row.status as SiteAuditStatus,
    pagesCrawled: row.pagesCrawled,
    summary: (row.summary as SummarySection | null) ?? null,
    issues: (row.issues as IssuesSection | null) ?? null,
    pages: (row.pages as PagesSection | null) ?? null,
    costUsd: Number(row.costUsd),
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };

  if (extra?.cached) {
    dto.cached = true;
    const elapsed = (extra.now ?? new Date()).getTime() - row.createdAt.getTime();
    dto.reRunAvailableInMs = Math.max(SITE_AUDIT_CACHE_TTL_MS - elapsed, 0);
  }

  return dto;
}

/**
 * Newest audit for this domain inside the cache window.
 *
 * `failed` rows are excluded on purpose: replaying a failure for 24 h would
 * trap the tenant with no way to retry a crawl that broke for a transient
 * reason. An in-flight crawl IS returned, so a double-click joins the running
 * audit instead of starting a second paid one.
 */
export async function findCachedAudit(
  tenantId: string,
  domain: string,
  now = new Date(),
): Promise<SiteAudit | null> {
  return prisma.siteAudit.findFirst({
    where: {
      tenantId,
      domain,
      status: { in: ["queued", "crawling", "completed"] },
      createdAt: { gte: new Date(now.getTime() - SITE_AUDIT_CACHE_TTL_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Cache hit -> the stored (or running) audit; otherwise reserve quota and post
 * a crawl.
 *
 * Throws SiteAuditQuotaExceededError (429), SiteAuditQuotaUnavailableError
 * (503), InvalidDomainError (400), or DataforseoError (mapped by the route).
 */
export async function startAudit(
  tenantId: string,
  plan: PlanType,
  rawDomain: string,
  now = new Date(),
): Promise<{ audit: SiteAuditDto; cached: boolean }> {
  // Throws InvalidDomainError (-> 400) before anything can cost money.
  const domain = normalizeDomain(rawDomain);

  const cached = await findCachedAudit(tenantId, domain, now);
  if (cached) {
    return { audit: toAuditDto(cached, { cached: true, now }), cached: true };
  }

  const quota = await reserveSiteAudit(tenantId, plan, now);
  if (!quota.allowed) {
    throw new SiteAuditQuotaExceededError(quota.limit, plan);
  }

  // The page cap comes from the PLAN, never from the request — it is what the
  // crawl costs.
  const maxPages = crawlPageLimit(plan);

  let posted;
  try {
    posted = await seoMeteredCallResult<unknown[]>(tenantId, ONPAGE.taskPost, {
      target: domain,
      max_crawl_pages: maxPages,
      // JavaScript rendering multiplies the per-page price several times over
      // and is not needed for the technical checks this tool reports.
      enable_javascript: false,
      // Respect the site's own crawl rules; a tool that ignores robots.txt is
      // a liability, not a feature.
      respect_sitemap: true,
      load_resources: true,
      enable_browser_rendering: false,
    });
  } catch (err) {
    // Nothing was crawled, so the reservation must not be spent.
    await releaseSiteAudit(tenantId, now);
    throw err;
  }

  const row = await prisma.siteAudit.create({
    data: {
      tenantId,
      domain,
      maxPages,
      dataforseoTaskId: posted.taskId ?? null,
      status: "queued",
      // task_post itself is cheap; the per-page charge lands as the crawl
      // proceeds and is reconciled by the poller from the summary envelope.
      costUsd: posted.billing.costUsd,
      createdAt: now,
    },
  });

  console.info(
    `[site-audit] tenant=${tenantId} domain=${domain} maxPages=${maxPages} ` +
      `task=${posted.taskId ?? "—"} postCost=$${posted.billing.costUsd.toFixed(6)}`,
  );

  return { audit: toAuditDto(row), cached: false };
}
