// src/lib/site-crawler/quota.ts
//
// Per-tier Site Crawler limits: how big one crawl may be, and how many a tenant
// may start this month.
//
// COUNTED IN POSTGRES, for the reason seo-quota.ts spells out at length: this
// box restarts several times a day, so an in-process tally hands every tenant a
// fresh allowance on each deploy. The CrawlJob rows are already there and
// counting them cannot drift from what actually happened.
//
// WHICH RUNS CONSUME QUOTA. QUEUED, RUNNING and COMPLETED count. FAILED and
// CANCELLED do not. This is implemented by EXCLUDING those two statuses from
// the count rather than by decrementing a counter — there is no counter to
// decrement, and a query that names the statuses it charges for stays correct
// when a job changes status after the fact. The consequence worth stating: a
// tenant who cancels a crawl gets the slot back, which is the forgiving
// direction and the one that does not punish someone for stopping a crawl they
// misconfigured.

import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { planConfig, type CrawlCadence } from "@/lib/plan-config";
import { planAllowsArea } from "@/lib/plan-access";
import { auditsUsedThisHour } from "@/lib/lighthouse/usage";
import { AUDITS_PER_HOUR } from "@/lib/lighthouse/options";
import { flag } from "@/lib/flags";
import { OBSERVED_BACKLINK_UNIT_USD, backlinkUnitCostUsd, seoBudgetLeftUsd } from "./backlink-cost";
import { aiKeyStatus } from "./ai-keys";
import { marketingTokenLimit, marketingTokensUsed, planCanUseMarketing } from "@/lib/marketing/quota";
import { effectiveCaps, tenantOverrides } from "./tenant-caps";
import { allowanceFrom, pagesUsedThisMonth, type PageAllowance } from "./page-allowance";


/** Statuses that consume a monthly slot. */
export const QUOTA_CONSUMING_STATUSES = ["QUEUED", "RUNNING", "COMPLETED"] as const;

export interface CrawlQuota {
  /** URLs one crawl may fetch. 0 = the tool is locked for this tier. */
  urlCap: number;
  /** Pages one crawl may render (Phase 3b). 0 = render mode off for the tier. */
  renderCap: number;
  /** Crawls per calendar month, or null for unlimited. */
  monthlyLimit: number | null;
  /** Crawls already started this month that consume quota. */
  used: number;
  /** null when unlimited. */
  remaining: number | null;
  /** False when the tier is locked, the month's crawls are used or its pages are (page-allowance.ts). */
  allowed: boolean;
  /** The month's page allowance across every crawl: "x / y pages this month". */
  pages: PageAllowance;
  locked: boolean;
  /** Phase 4a: completed crawls kept with full data (plan-config crawlsKept). */
  crawlsKept: number;
  /** Crawls this workspace may run at once (plan-config crawlConcurrency, override first); more wait in order. */
  concurrency: number;
  /** Phase 4b caps: extractors and searches per crawl, segments per site. */
  extractorCap: number;
  searchCap: number;
  segmentCap: number;
  /** Phase 4c: schedules per tenant and the cadences the tier allows. */
  scheduleCap: number;
  scheduleCadences: readonly CrawlCadence[];
  /** Phase 4d: pages per crawl for PageSpeed and for backlink metrics. */
  psiCap: number;
  backlinkCap: number;
  /** Phase 4e: custom JS snippets and AI-prompted pages per crawl. */
  jsSnippetCap: number;
  aiPageCap: number;
  /** Phase 4g: semantic-duplicate pages and URL Inspection pages per crawl. */
  semanticCap: number;
  inspectionCap: number;
  /** Phase 4d: the Lighthouse tool's hourly allowance, which PSI opt-ins draw from. */
  lighthouseUsed: number;
  lighthouseLimit: number;
  /** Phase 4d backlink estimate: last metered unit cost and the monthly SEO data budget left. */
  backlinkUnitUsd: number;
  seoBudgetLeftUsd: number;
  /** Phase 4e AI prompts: the Marketing Studio token budget (limit null = unmetered), whether Claude is on the plan, which own keys are saved. */
  aiTokensUsed?: number;
  aiTokenLimit?: number | null;
  aiClaude?: boolean;
  aiKeys?: { openai: boolean; gemini: boolean };
}

export function urlCapForPlan(plan: PlanType): number {
  return planConfig(plan).crawlUrlCap;
}

/** Phase 4b caps (plan-config crawlExtractors / crawlSearches / crawlSegments). */
export function featureCapsForPlan(plan: PlanType): { extractorCap: number; searchCap: number; segmentCap: number } {
  const c = planConfig(plan);
  return { extractorCap: c.crawlExtractors, searchCap: c.crawlSearches, segmentCap: c.crawlSegments };
}

/** Phase 4c caps (plan-config crawlSchedules / crawlScheduleCadences). */
export function scheduleCapsForPlan(plan: PlanType): { scheduleCap: number; scheduleCadences: readonly CrawlCadence[] } {
  const c = planConfig(plan);
  return { scheduleCap: c.crawlSchedules, scheduleCadences: c.crawlScheduleCadences };
}

/** Phase 4d caps (plan-config crawlPsiPages / crawlBacklinkPages). */
export function metricCapsForPlan(plan: PlanType): { psiCap: number; backlinkCap: number } {
  const c = planConfig(plan);
  return { psiCap: c.crawlPsiPages, backlinkCap: c.crawlBacklinkPages };
}

/** Phase 4g per-crawl caps: semantically compared pages and URL Inspection pages. */
export function parityCapsForPlan(plan: PlanType): { semanticCap: number; inspectionCap: number } {
  const c = planConfig(plan);
  return { semanticCap: c.crawlSemanticPages, inspectionCap: c.crawlInspectionPages };
}

/** Phase 4e per-crawl caps: custom JS snippets and AI-prompted pages. */
export function renderFeatureCapsForPlan(plan: PlanType): { jsSnippetCap: number; aiPageCap: number } {
  const c = planConfig(plan);
  return { jsSnippetCap: c.crawlJsSnippets, aiPageCap: c.crawlAiPages };
}

export function monthlyLimitForPlan(plan: PlanType): number | null {
  return planConfig(plan).crawlsPerMonth;
}

/** First instant of the current UTC calendar month. */
export function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Crawls this tenant has started this month that count against the limit. */
export async function crawlsUsedThisMonth(
  tenantId: string,
  now: Date = new Date(),
): Promise<number> {
  return prisma.crawlJob.count({
    where: {
      tenantId,
      createdAt: { gte: monthStart(now) },
      status: { in: [...QUOTA_CONSUMING_STATUSES] },
    },
  });
}

/** Everything the UI and the POST route need to decide whether to start. */
export async function getCrawlQuota(
  tenantId: string,
  plan: PlanType,
  now: Date = new Date(),
): Promise<CrawlQuota> {
  // Phase 3d-A: staff overrides (tenant-caps.ts) replace the plan's URL cap and crawls kept.
  const caps0 = effectiveCaps(plan, await tenantOverrides(tenantId));
  const urlCap = caps0.urlCap;
  const renderCap = planConfig(plan).crawlRenderedPages;
  const monthlyLimit = monthlyLimitForPlan(plan);
  // A staff URL-cap override changes a limit INSIDE an area the plan has; it
  // never opens the crawler to a plan that excludes it (src/lib/plan-access.ts).
  const locked = urlCap <= 0 || !planAllowsArea(plan, "crawler");
  const crawlsKept = caps0.crawlsKept;
  const concurrency = caps0.concurrency;
  const caps = { ...featureCapsForPlan(plan), ...scheduleCapsForPlan(plan), ...metricCapsForPlan(plan), ...renderFeatureCapsForPlan(plan), ...parityCapsForPlan(plan) };

  // A locked tier never runs a query it cannot act on.
  if (locked) {
    return {
      urlCap,
      renderCap,
      monthlyLimit,
      used: 0,
      remaining: 0,
      allowed: false,
      pages: allowanceFrom(caps0.pagesPerMonth, 0, now),
      locked: true,
      crawlsKept,
      concurrency,
      ...caps,
      lighthouseUsed: 0,
      lighthouseLimit: AUDITS_PER_HOUR,
      backlinkUnitUsd: OBSERVED_BACKLINK_UNIT_USD,
      seoBudgetLeftUsd: 0,
    };
  }

  const [used, pagesUsed] = await Promise.all([crawlsUsedThisMonth(tenantId, now), pagesUsedThisMonth(tenantId, now)]);
  const remaining = monthlyLimit === null ? null : Math.max(0, monthlyLimit - used);
  const pages = allowanceFrom(caps0.pagesPerMonth, pagesUsed, now);

  return {
    urlCap,
    renderCap,
    monthlyLimit,
    used,
    remaining,
    allowed: (monthlyLimit === null || used < monthlyLimit) && (pages.remaining === null || pages.remaining > 0),
    pages,
    locked: false,
    crawlsKept,
    concurrency,
    ...caps,
    lighthouseUsed: await auditsUsedThisHour(tenantId, now.getTime()),
    lighthouseLimit: AUDITS_PER_HOUR,
    backlinkUnitUsd: await backlinkUnitCostUsd().catch(() => OBSERVED_BACKLINK_UNIT_USD),
    seoBudgetLeftUsd: await seoBudgetLeftUsd(tenantId).catch(() => 0),
    ...(flag("crawl.ai") || flag("crawl.semantic") ? await aiQuota(tenantId, plan) : {}),
  };
}

/** Phase 4e: what the AI prompts' estimate and provider choice need. */
async function aiQuota(tenantId: string, plan: PlanType) {
  const keys = await aiKeyStatus(tenantId).catch(() => null);
  return {
    aiTokensUsed: await marketingTokensUsed(tenantId),
    aiTokenLimit: marketingTokenLimit(plan),
    aiClaude: planCanUseMarketing(plan),
    aiKeys: { openai: Boolean(keys?.openai.set), gemini: Boolean(keys?.gemini.set) },
  };
}
