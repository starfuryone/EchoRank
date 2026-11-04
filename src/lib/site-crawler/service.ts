// src/lib/site-crawler/service.ts
//
// Start / cancel / read, so the route handlers stay thin and the guard order
// is written down once instead of once per endpoint.
//
// GUARD ORDER, and why: plan lock → URL validation → quota → create → enqueue.
// The lock comes first because a locked tier should hear "not on your plan"
// rather than "that URL is invalid" — the second is true but answers a
// question they did not ask. Quota comes after URL validation so a tenant with
// one crawl left does not spend it on a typo.

import type { PlanType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { addJob } from "@/infrastructure/queue/registry";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { crawlKeys, REDIS_KEY_TTL_SECONDS } from "./constants";
import { featureCapsForPlan, getCrawlQuota, metricCapsForPlan, parityCapsForPlan, renderFeatureCapsForPlan } from "./quota";
import { validateRootUrl } from "./url";
import type { RenderMode } from "./types";
import {
  CrawlLockedError,
  CrawlQuotaExceededError,
  InvalidCrawlConfigError,
  InvalidCrawlListError,
  InvalidCrawlUrlError,
} from "./errors";
import {
  DEFAULT_CRAWL_CONFIG,
  checkCrawlConfig,
  readSiteDefaults,
  readStoredConfig,
  siteDefaultColumns,
  viewCrawlConfig,
  type CrawlConfigInput,
  type CrawlConfigView,
  type StoredCrawlConfig,
} from "./crawl-config";
import { flag } from "@/lib/flags";
import { SegmentDefSchema, type SegmentDef } from "./segments";
import { getConnection } from "@/lib/gsc/service";
import { propertyCovers } from "./gsc-join";
import { healthOf } from "./site-health";
import { readStoredLogin } from "./login";
import { aiKeyStatus } from "./ai-keys";
import { planCanUseMarketing } from "@/lib/marketing/quota";
import { sealCrawlConfig } from "./crawl-config-secrets";
import { checkExtractorExpr } from "./extraction";
import { newVerifyToken } from "./site-verify";

export interface CrawlJobDto {
  id: string;
  rootUrl: string;
  status: string;
  urlCap: number;
  pagesCrawled: number;
  issueCount: number;
  stoppedReason: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  renderMode: RenderMode;
  renderCap: number;
  pagesRendered: number;
  /** Phase 4a. */
  mode: "spider" | "list";
  /** Secrets as { set: true }; null = the defaults. */
  config: CrawlConfigView | null;
  pinned: boolean;
  /** Set once retention deleted the crawl's pages: summary only from then on. */
  dataPurgedAt: string | null;
  /** Phase 4e forms login: how it went (failed = the crawl ran unauthenticated). Absent when no login was asked. */
  login?: { status: "ok" | "failed"; reason: string | null } | null;
  /** Site health 0–100 from the summary; null before it settles or on older crawls. */
  health?: number | null;
}

/** summary.login, when the crawl logged in (or tried to). */
function loginOf(summary: unknown): CrawlJobDto["login"] {
  const l = (summary as { login?: { status?: string; reason?: string } } | null)?.login;
  return l && (l.status === "ok" || l.status === "failed") ? { status: l.status, reason: l.reason ?? null } : null;
}

export function toCrawlDto(row: {
  id: string;
  rootUrl: string;
  status: string;
  urlCap: number;
  pagesCrawled: number;
  issueCount: number;
  stoppedReason: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  renderMode?: string;
  renderCap?: number;
  pagesRendered?: number;
  mode?: string;
  config?: unknown;
  pinned?: boolean;
  dataPurgedAt?: Date | null;
  summary?: unknown;
}): CrawlJobDto {
  return {
    id: row.id,
    rootUrl: row.rootUrl,
    status: row.status,
    urlCap: row.urlCap,
    pagesCrawled: row.pagesCrawled,
    issueCount: row.issueCount,
    stoppedReason: row.stoppedReason,
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    renderMode: row.renderMode === "thin" || row.renderMode === "all" ? row.renderMode : "none",
    renderCap: row.renderCap ?? 0,
    pagesRendered: row.pagesRendered ?? 0,
    mode: row.mode === "list" ? "list" : "spider",
    config: viewCrawlConfig(readStoredConfig(row.config)),
    pinned: row.pinned ?? false,
    dataPurgedAt: row.dataPurgedAt?.toISOString() ?? null,
    ...(row.summary !== undefined && loginOf(row.summary) ? { login: loginOf(row.summary) } : {}),
    ...(row.summary !== undefined ? { health: healthOf(row.summary) } : {}),
  };
}

export interface StartCrawlOptions {
  /** Phase 4a configuration; omitted = the defaults. */
  config?: CrawlConfigInput;
  /** Also store this configuration as the default for the root's host. */
  saveAsDefault?: boolean;
  /** "list": fetch `urls` once each, no discovery. rawUrl is ignored. */
  mode?: "spider" | "list";
  urls?: string[];
  /**
   * Phase 4c: a schedule's configuration, already checked and sealed when the
   * schedule was saved. Re-checked here against today's plan and the site's
   * verification (secrets are not re-entered), so a downgrade or a lost
   * verification refuses the run instead of crawling past the new limits.
   */
  sealed?: StoredCrawlConfig | null;
  /** Phase 4c: the schedule this run belongs to; rides the job payload to the completion hook. */
  scheduleId?: string;
}

/**
 * A list-mode list, each line through the same SSRF guard as a crawl root.
 * Lines that are not public http(s) URLs are skipped and counted; any host is
 * allowed (a list is a status check, not a crawl of someone's site).
 */
export function validateUrlList(lines: string[]): { urls: string[]; skipped: number } {
  const urls: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const line of lines) {
    const v = validateRootUrl(line);
    if (!v.ok || !v.url) {
      skipped++;
      continue;
    }
    if (seen.has(v.url)) continue;
    seen.add(v.url);
    urls.push(v.url);
  }
  return { urls, skipped };
}

/** Phase 4g: whether the tenant's GSC property covers the host (only looked up when URL Inspection is asked for). */
async function inspectionChecks(tenantId: string, host: string, inspection: { pages: number } | null) {
  if (!inspection) return {};
  const conn = await getConnection(tenantId);
  return { gscCovers: Boolean(conn && conn.status === "ACTIVE" && conn.siteUrl && propertyCovers(conn.siteUrl, `https://${host}/`)) };
}

/** Phase 4e: what the AI prompts' provider check needs (only looked up when the crawl asks for AI). */
async function aiChecks(tenantId: string, plan: PlanType, ai: { provider: string } | null) {
  if (!ai) return {};
  const keys = await aiKeyStatus(tenantId);
  return { aiKeys: { openai: keys.openai.set, gemini: keys.gemini.set }, claudeAvailable: planCanUseMarketing(plan) };
}

/** Validate, enforce quota, create the row, enqueue the job. */
export async function startCrawl(
  tenantId: string,
  plan: PlanType,
  rawUrl: string,
  renderMode: RenderMode = "none",
  opts: StartCrawlOptions = {},
): Promise<CrawlJobDto & { listSkipped?: number }> {
  const quota = await getCrawlQuota(tenantId, plan);
  if (quota.locked) throw new CrawlLockedError(plan);

  const mode = opts.mode === "list" ? "list" : "spider";
  const list = mode === "list" ? validateUrlList(opts.urls ?? []) : null;
  if (list) {
    if (list.urls.length === 0) throw new InvalidCrawlListError("empty", quota.urlCap);
    const cap = Math.min(quota.urlCap, opts.config?.maxUrls ?? quota.urlCap);
    if (list.urls.length > cap) throw new InvalidCrawlListError("too_long", cap);
  }
  const validated = list ? { ok: true, url: list.urls[0] } : validateRootUrl(rawUrl);
  if (!validated.ok || !validated.url) {
    throw new InvalidCrawlUrlError((validated as { reason?: string }).reason ?? "not_a_url");
  }

  // Phase 4a configuration, checked before quota like the URL: a typo in a
  // pattern should not spend a crawl. Verified-only options are refused on
  // an unverified host; a custom robots.txt runs in test mode there.
  const host = new URL(validated.url).hostname;
  const site = opts.config || opts.saveAsDefault || opts.sealed
    ? await prisma.crawlSiteDefault.findUnique({
        where: { tenantId_host: { tenantId, host } },
        select: { verifiedAt: true, config: true, jsSnippets: true, login: true },
      })
    : null;
  let stored = null;
  if (opts.config) {
    const checked = checkCrawlConfig(opts.config, {
      urlCap: quota.urlCap,
      verified: Boolean(site?.verifiedAt),
      ...featureCapsForPlan(plan),
      ...metricCapsForPlan(plan),
      ...renderFeatureCapsForPlan(plan),
      renders: renderMode !== "none" && quota.renderCap > 0,
      ...parityCapsForPlan(plan),
      ...(await inspectionChecks(tenantId, host, opts.config.inspection ?? null)),
      ...(await aiChecks(tenantId, plan, opts.config.ai ?? (opts.config.semantic ? { provider: "openai" } : null))),
      checkExpr: checkExtractorExpr,
    });
    if (checked.problems.length) throw new InvalidCrawlConfigError(checked.problems);
    stored = sealCrawlConfig(checked.config, readSiteDefaults(site?.config, site?.jsSnippets));
  } else if (opts.sealed) {
    const checked = checkCrawlConfig({ ...opts.sealed, headers: [], cookies: null, basicAuth: null, login: null, useLogin: Boolean(opts.sealed.login) }, {
      urlCap: quota.urlCap,
      verified: Boolean(site?.verifiedAt),
      ...featureCapsForPlan(plan),
      ...metricCapsForPlan(plan),
      ...renderFeatureCapsForPlan(plan),
      renders: renderMode !== "none" && quota.renderCap > 0,
      ...parityCapsForPlan(plan),
      ...(await inspectionChecks(tenantId, host, opts.sealed.inspection ?? null)),
      ...(await aiChecks(tenantId, plan, opts.sealed.ai ?? (opts.sealed.semantic ? { provider: "openai" } : null))),
      checkExpr: checkExtractorExpr,
    });
    if (checked.problems.length) throw new InvalidCrawlConfigError(checked.problems);
    stored = { ...opts.sealed, maxUrls: checked.config.maxUrls, useLogin: checked.config.useLogin };
  }
  // Phase 4e forms login: the host's CURRENT saved login (credentials still
  // sealed) rides on the crawl; a crawl asking for one without it is refused.
  if (stored) {
    const wants = Boolean(stored.useLogin);
    delete stored.useLogin;
    stored.login = null;
    if (wants) {
      const saved = readStoredLogin(site?.login);
      if (!saved) throw new InvalidCrawlConfigError([{ field: "login", code: "login_missing" }]);
      stored.login = saved;
    }
  }

  if (!quota.allowed) {
    throw new CrawlQuotaExceededError(quota.monthlyLimit ?? 0, plan);
  }

  if (stored && opts.saveAsDefault) {
    await prisma.crawlSiteDefault.upsert({
      where: { tenantId_host: { tenantId, host } },
      create: { tenantId, host, verifyToken: newVerifyToken(), ...siteDefaultColumns(stored) },
      update: siteDefaultColumns(stored),
    });
  }

  // Phase 4b: the host's saved segments, copied onto the crawl so its
  // segmentIds keep meaning what they meant when it ran. Capped at the plan's
  // crawlSegments in case the plan shrank after they were saved.
  const segments = flag("crawl.segments") ? await segmentSnapshot(tenantId, host, featureCapsForPlan(plan).segmentCap) : [];
  const jobConfig: StoredCrawlConfig | null =
    stored || segments.length ? { ...(stored ?? DEFAULT_CRAWL_CONFIG), ...(segments.length ? { segments } : {}) } : null;
  const insSeg = jobConfig?.inspection?.segment;
  if (insSeg != null && insSeg >= segments.length) throw new InvalidCrawlConfigError([{ field: "inspection", code: "unknown_segment" }]);
  // Phase 4g: and the semantic opt-in's.
  const semSeg = jobConfig?.semantic?.segment;
  if (semSeg != null && semSeg >= segments.length) throw new InvalidCrawlConfigError([{ field: "semantic", code: "unknown_segment" }]);
  // Phase 4e: so may the AI prompts' top N.
  const aiSeg = jobConfig?.ai?.top.segment;
  if (aiSeg != null && aiSeg >= segments.length) throw new InvalidCrawlConfigError([{ field: "ai", code: "unknown_segment" }]);
  // Phase 4d: a top-N opt-in may name one of the segments just snapshotted.
  for (const key of ["psi", "backlinks"] as const) {
    const seg = jobConfig?.addData?.[key]?.segment;
    if (seg != null && seg >= segments.length) throw new InvalidCrawlConfigError([{ field: `addData.${key}` as const, code: "unknown_segment" }]);
  }

  const job = await prisma.crawlJob.create({
    data: {
      tenantId,
      rootUrl: validated.url,
      mode,
      ...(jobConfig
        ? { config: { ...jobConfig, customRobotsMode: site?.verifiedAt ? "replace" : "test" } as object }
        : {}),
      // Copied from the plan at creation: the crawl keeps reporting the ceiling
      // it ran under even if the tenant changes tier tomorrow. A configured
      // max URLs lowers it, never raises it.
      urlCap: list ? list.urls.length : Math.min(quota.urlCap, stored?.maxUrls ?? quota.urlCap),
      // Same rule for the render ceiling. A tier without one crawls raw only,
      // whatever was asked for.
      renderMode: quota.renderCap > 0 ? renderMode : "none",
      renderCap: quota.renderCap,
      status: "QUEUED",
    },
  });

  // List mode: the list rides the frontier, seeded here rather than stored on
  // the row (25,000 URLs is megabytes the row would carry forever). Same TTL
  // as every other crawl key: a job still queued a day later finds it gone
  // and ends with stoppedReason "list_expired".
  if (list) {
    const redis = getRedisConnection();
    const keys = crawlKeys(job.id);
    for (let i = 0; i < list.urls.length; i += 1000) {
      const chunk = list.urls.slice(i, i + 1000);
      await redis.rpush(keys.queue, ...chunk.map((url) => JSON.stringify({ url, depth: 0 })));
      await redis.sadd(keys.seen, ...chunk);
    }
    await redis.expire(keys.queue, REDIS_KEY_TTL_SECONDS);
    await redis.expire(keys.seen, REDIS_KEY_TTL_SECONDS);
  }

  await addJob("site-crawl", "crawl", { crawlJobId: job.id, tenantId, ...(opts.scheduleId ? { scheduleId: opts.scheduleId } : {}) });

  return { ...toCrawlDto(job), ...(list ? { listSkipped: list.skipped } : {}) };
}

/**
 * Flag a crawl for cancellation.
 *
 * A RUNNING crawl is stopped cooperatively: the worker checks this Redis key
 * once per batch, so cancellation takes effect within a batch rather than
 * instantly. A QUEUED crawl is marked CANCELLED here directly, because no
 * worker has picked it up to notice the flag.
 */
export async function cancelCrawl(tenantId: string, crawlJobId: string): Promise<boolean> {
  const job = await prisma.crawlJob.findFirst({
    where: { id: crawlJobId, tenantId },
    select: { id: true, status: true },
  });
  if (!job) return false;

  if (job.status === "COMPLETED" || job.status === "FAILED" || job.status === "CANCELLED") {
    return true; // already terminal — nothing to do, and not an error
  }

  const redis = getRedisConnection();
  const keys = crawlKeys(crawlJobId);
  await redis.set(keys.cancel, "1", "EX", REDIS_KEY_TTL_SECONDS);

  if (job.status === "QUEUED") {
    await prisma.crawlJob.update({
      where: { id: crawlJobId },
      data: { status: "CANCELLED", stoppedReason: "cancelled", finishedAt: new Date() },
    });
  }

  return true;
}

/** A host's saved segments, in order, at most `cap`. Rows that no longer parse are skipped. */
export async function segmentSnapshot(tenantId: string, host: string, cap: number): Promise<SegmentDef[]> {
  if (cap <= 0) return [];
  const rows = await prisma.crawlSegment.findMany({
    where: { tenantId, host },
    orderBy: { position: "asc" },
    take: cap,
    select: { name: true, rule: true },
  });
  return rows.flatMap((r) => {
    const parsed = SegmentDefSchema.safeParse(r);
    return parsed.success ? [parsed.data] : [];
  });
}
