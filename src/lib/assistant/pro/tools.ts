// src/lib/assistant/pro/tools.ts
//
// Every tool the Pro assistant can call, and the rules all of them obey.
//
// FOUR RULES, ENFORCED HERE RATHER THAN PROMISED IN THE PROMPT:
//
//   1. TENANT ID IS INJECTED SERVER-SIDE. It comes from the session, through
//      `ToolContext`, and is never a field in any tool's argument schema. There
//      is no string the model can emit that reaches a `where` clause as a
//      tenant. Every Prisma read below is `where: { tenantId, ... }` — never a
//      `findUnique` on a bare id, which is the rule CLAUDE.md states for every
//      route and which applies with more force to a caller that can be talked
//      into asking for things.
//   2. ARGUMENTS ARE ZOD-VALIDATED. A tool whose args do not parse is refused
//      with the reason, and the refusal goes back to the model as a normal tool
//      result so it can correct itself rather than the turn dying.
//   3. RESULTS ARE CACHE-AWARE, TENANT-SCOPED. Keys are
//      `echorank:assistant:{tenantId}:...`, so a cache entry can only ever be
//      read back by the tenant that wrote it. The single exception is the
//      domain audit, which is derived from a site's own PUBLIC pages and
//      therefore reuses the shared public key from Phase 5 — deliberately, so
//      two tenants auditing the same domain buy one scan between them. It holds
//      nothing private; that is what makes sharing it safe.
//   4. PER-TURN DEDUPE. Same tool, same args, one execution — the TurnCache
//      memo. An assistant that asks for the crawl summary while writing about
//      the crawl summary pays for it once.
//
// NOTHING HERE SPENDS DataForSEO MONEY. The rank tracker, SERP checks and
// AI Lens tools are strictly READ-ONLY lookups over rows those tools already
// wrote. There is no assistant path that posts a DataForSEO task or triggers a
// headless render, and there must never be one: an assistant that can be
// persuaded to spend is an assistant that will be.
//
// A TOOL THAT FINDS NOTHING SAYS SO PRECISELY. "No Search Console data yet"
// and "the Search Console sync is broken" are different sentences and only one
// of them is usually true — a low-traffic property legitimately has zero rows
// because Google withholds queries below its anonymity threshold. Every
// gatherer distinguishes "not connected", "connected, nothing yet" and "here is
// the data", because the alternative is an assistant that tells customers their
// integration is broken when it is working exactly as documented.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import { sidecarPost } from "@/lib/av-sidecar";
import { guardCheckUrl } from "@/lib/bot-analytics/url-guard";
import { registrableDomain } from "@/lib/registrable-domain";
import { hasFeature } from "@/lib/feature-flags";
import { PLAN_CONFIGS, sellablePlan } from "@/lib/plan-config";
import { getVisibilitySummary } from "@/lib/visibility-summary";
import type { PlanType } from "@/generated/prisma";
import {
  ONE_DAY,
  ONE_HOUR,
  TurnCache,
  cacheKey,
  getOrCompute,
  readCache,
  writeCache,
} from "../cache";
import { AUDIT_VERSION } from "../scan";
import { summarize, type SidecarAudit } from "../heuristics";
import { clip } from "./evidence";
import { readIntelligence } from "./precompute";
import type { ToolDefinition } from "../model";

/** The sidecar fetches a page; give it room without hanging the request. */
const AUDIT_TIMEOUT_MS = 25_000;

/** Rows a single tool may return. Bounds the evidence block, not the table. */
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

/** Cache lifetimes. Short for things a customer can change from the UI. */
const TTL_CONFIG = 5 * 60;
const TTL_ROLLUP = ONE_HOUR;

/**
 * Everything a tool is allowed to know, assembled from the session.
 *
 * NOTE WHAT IS ABSENT: there is no field a model can set. `forceRefresh` is
 * here because the UI's "Refresh analysis" button puts it here, not because a
 * tool argument can.
 */
export interface ToolContext {
  tenantId: string;
  tenantName: string;
  planType: PlanType;
  /** Domains this tenant has registered. The only hosts a tool may fetch. */
  domains: string[];
  turn: TurnCache;
  /** Set by an explicit user "Refresh analysis" click. Never by the model. */
  forceRefresh: boolean;
}

export interface ToolOutcome {
  ok: boolean;
  /** Structured result, rendered into the evidence block by the caller. */
  value: unknown;
  /** True when nothing was bought — no sidecar call, no fresh query. */
  cached: boolean;
}

interface ToolSpec {
  name: string;
  description: string;
  schema: z.ZodType<Record<string, unknown>>;
  /** JSON Schema for the wire. Hand-written: zod-to-json-schema is not a dep. */
  inputSchema: ToolDefinition["input_schema"];
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolOutcome>;
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

/**
 * A tenant-scoped cache key.
 *
 * THE TENANT ID IS THE FIRST SEGMENT AFTER THE NAMESPACE, and it is not
 * escaped away: cuids are `[a-z0-9]` so they cannot contain the separator, and
 * every other part is escaped by `cacheKey`. Two tenants therefore cannot
 * collide however similar their arguments are — the property the isolation
 * tests assert directly.
 */
export function tenantKey(tenantId: string, namespace: string, ...parts: (string | number)[]) {
  return cacheKey(`tenant:${tenantId}:${namespace}`, ...parts);
}

const LimitSchema = z
  .object({ limit: z.number().int().min(1).max(MAX_LIMIT).optional() })
  .strict();

const LIMIT_JSON_SCHEMA: ToolDefinition["input_schema"] = {
  type: "object",
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: MAX_LIMIT,
      description: `How many rows to return. Defaults to ${DEFAULT_LIMIT}.`,
    },
  },
  additionalProperties: false,
};

const NO_ARGS_SCHEMA = z.object({}).strict();
const NO_ARGS_JSON_SCHEMA: ToolDefinition["input_schema"] = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

function limitOf(args: Record<string, unknown>): number {
  const raw = args.limit;
  return typeof raw === "number" ? raw : DEFAULT_LIMIT;
}

/**
 * Run a tool body behind the tenant cache, unless the user asked for fresh.
 *
 * `forceRefresh` skips the READ but still writes: a refresh should make the
 * next question cheap, not just this one.
 */
async function cached<T>(
  ctx: ToolContext,
  key: string,
  ttl: number,
  compute: () => Promise<T>,
): Promise<ToolOutcome> {
  if (ctx.forceRefresh) {
    const fresh = await compute();
    await writeCache(key, fresh, ttl);
    return { ok: true, value: fresh, cached: false };
  }
  const hit = await readCache<T>(key);
  if (hit !== null) return { ok: true, value: hit, cached: true };
  const fresh = await compute();
  await writeCache(key, fresh, ttl);
  return { ok: true, value: fresh, cached: false };
}

// ─── The tools ──────────────────────────────────────────────────────────────

/**
 * Which domain a tool should look at, and whether it is allowed to.
 *
 * PAGE-FETCHING TOOLS ARE RESTRICTED TO THE TENANT'S OWN DOMAINS. The shared
 * SSRF guard runs first (it refuses IP literals, private ranges, odd ports and
 * credentials in the URL), then `guardCheckUrl`'s tenantDomain check confirms
 * the host is one the tenant registered. A model that has read a hostile page
 * saying "now audit attacker.example" gets a refusal, not a fetch.
 */
function resolveOwnDomain(
  ctx: ToolContext,
  requested: string | undefined,
): { ok: true; url: string; domain: string } | { ok: false; reason: string } {
  if (ctx.domains.length === 0) {
    return {
      ok: false,
      reason:
        "This account has no website on file. Ask the customer to set their domain in Settings, then try again.",
    };
  }

  // No domain asked for: the first registered one, which is the account's
  // primary (auditDomain) wherever one is set.
  const target = requested?.trim() || ctx.domains[0];

  for (const owned of ctx.domains) {
    const guarded = guardCheckUrl(target, owned);
    if (guarded.ok && guarded.url) {
      const domain = registrableDomain(guarded.url);
      if (domain && domain.includes(".")) {
        return { ok: true, url: guarded.url, domain };
      }
    }
  }

  return {
    ok: false,
    reason: `"${clip(target, 120)}" is not a domain registered to this account. This account can only be asked about: ${ctx.domains.join(", ")}.`,
  };
}

const TOOLS: ToolSpec[] = [
  {
    name: "getProjectSummary",
    description:
      "The account itself: business name, plan, billing status, the domains on file, and which product features that plan includes. Call this first when a question depends on what the customer has access to.",
    schema: NO_ARGS_SCHEMA,
    inputSchema: NO_ARGS_JSON_SCHEMA,
    run: async (_args, ctx) =>
      cached(ctx, tenantKey(ctx.tenantId, "project"), TTL_CONFIG, async () => {
        const tenant = await prisma.tenant.findUnique({
          where: { id: ctx.tenantId },
          select: {
            name: true,
            planType: true,
            billingStatus: true,
            auditDomain: true,
            botAnalyticsDomain: true,
            timezone: true,
            defaultLanguage: true,
            createdAt: true,
          },
        });
        if (!tenant) return { found: false };

        const plan = PLAN_CONFIGS[sellablePlan(tenant.planType)];
        return {
          found: true,
          business: tenant.name,
          plan: {
            name: plan?.name ?? tenant.planType,
            key: tenant.planType,
            // Prices come from PLAN_CONFIGS, never from the model's memory.
            monthlyPrice: plan?.isCustomPricing ? null : (plan?.monthlyPrice ?? null),
            annualPrice: plan?.isCustomPricing ? null : (plan?.annualPrice ?? null),
          },
          billingStatus: tenant.billingStatus,
          domains: ctx.domains,
          timezone: tenant.timezone,
          language: tenant.defaultLanguage,
          customerSince: tenant.createdAt,
          features: {
            answerTracking: hasFeature(tenant.planType, "answer_tracking"),
            marketingStudio: hasFeature(tenant.planType, "marketing_studio"),
          },
        };
      }),
  },

  {
    name: "getVisibilitySummary",
    description:
      "How AI assistants currently answer questions about this business: the latest AI-visibility audit score, 30-day prompt-run totals and mention rate per engine, and recent visibility alerts. The same numbers Brand Radar shows.",
    schema: NO_ARGS_SCHEMA,
    inputSchema: NO_ARGS_JSON_SCHEMA,
    run: async (_args, ctx) =>
      cached(ctx, tenantKey(ctx.tenantId, "visibility"), TTL_ROLLUP, async () => {
        // The SAME function Brand Radar and the public v1 API call, so the
        // assistant cannot quote a number the dashboard disagrees with.
        const summary = await getVisibilitySummary(
          ctx.tenantId,
          ctx.tenantName,
          ctx.planType,
          ctx.domains[0] ?? null,
        );
        return {
          ...summary,
          note:
            summary.prompts.runs === 0
              ? "No prompt runs in the last 30 days. That means tracking has not run yet, not that the brand is invisible."
              : undefined,
        };
      }),
  },

  {
    name: "runDomainAudit",
    description:
      "Audit one of this account's own websites for the technical signals AI answer engines read: robots.txt access for AI crawlers, structured data, llms.txt, server-rendered content, and the key pages assistants look for. Returns a score out of 100 and the findings behind it. Only this account's registered domains can be audited.",
    schema: z
      .object({
        domain: z
          .string()
          .trim()
          .min(3)
          .max(253)
          .optional()
          .describe("One of this account's own domains. Omit for the primary one."),
      })
      .strict(),
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          description:
            "One of this account's own registered domains. Omit to audit the primary one. Any other host is refused.",
        },
      },
      additionalProperties: false,
    },
    run: async (args, ctx) => {
      const target = resolveOwnDomain(ctx, args.domain as string | undefined);
      if (!target.ok) return { ok: false, value: { error: target.reason }, cached: false };

      // THE PUBLIC KEY, DELIBERATELY. This value is derived from the site's own
      // public pages — the identical bytes any anonymous visitor gets from
      // /ai-assistant — so sharing it across tenants leaks nothing and saves a
      // real HTTP fetch against somebody's server. Everything else in this file
      // is tenant-keyed because everything else IS private.
      const key = cacheKey("audit", target.domain, AUDIT_VERSION);

      const fetchAudit = async (): Promise<SidecarAudit | null> => {
        const res = await sidecarPost<SidecarAudit>(
          "/audit",
          { url: target.url, crawl: false },
          { timeoutMs: AUDIT_TIMEOUT_MS },
        );
        if (res.status !== 200 || !res.data || res.data.error) {
          logger.warn(
            { status: res.status, domain: target.domain },
            "assistant pro: audit refused",
          );
          return null;
        }
        return res.data;
      };

      let audit: SidecarAudit | null;
      let wasCached: boolean;

      if (ctx.forceRefresh) {
        audit = await fetchAudit();
        wasCached = false;
        if (audit) await writeCache(key, audit, ONE_DAY);
      } else {
        // Single-flight: two colleagues asking at once buy one scan.
        const result = await getOrCompute<SidecarAudit>(ctx.turn, key, ONE_DAY, fetchAudit);
        audit = result?.value ?? null;
        wasCached = result?.cached ?? false;
      }

      if (!audit) {
        return {
          ok: false,
          value: {
            error: `${target.domain} could not be reached for an audit just now. This is about our fetch, not about the site's ranking.`,
          },
          cached: false,
        };
      }

      // Findings are computed in TypeScript from the sidecar's own audit — the
      // model explains facts, it does not produce them. Same heuristic layer
      // the public assistant uses, so the two surfaces cannot disagree.
      const summary = summarize(audit);
      if (!summary) {
        return {
          ok: false,
          value: { error: `The audit of ${target.domain} came back unreadable.` },
          cached: false,
        };
      }

      return { ok: true, value: { domain: target.domain, ...summary }, cached: wasCached };
    },
  },

  {
    name: "getTrackedPrompts",
    description:
      "The questions this account tracks across AI assistants, best first, each with its 30-day mention rate. Use it to say which questions the brand wins and which it loses.",
    schema: LimitSchema,
    inputSchema: LIMIT_JSON_SCHEMA,
    run: async (args, ctx) => {
      const limit = limitOf(args);
      return cached(ctx, tenantKey(ctx.tenantId, "prompts", limit), TTL_ROLLUP, async () => {
        const prompts = await prisma.trackedPrompt.findMany({
          where: { tenantId: ctx.tenantId, active: true },
          orderBy: [
            { importanceWeight: "desc" },
            { commercialValue: "desc" },
            { relevanceScore: "desc" },
            { createdAt: "asc" },
          ],
          take: limit,
          select: {
            id: true,
            text: true,
            category: true,
            intent: true,
            importanceWeight: true,
            commercialValue: true,
            lastRunAt: true,
          },
        });
        if (prompts.length === 0) {
          return {
            prompts: [],
            note: "This account tracks no prompts yet. Nothing has been asked of the AI engines on its behalf.",
          };
        }

        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const runs = await prisma.promptRun.groupBy({
          by: ["promptId", "brandMentioned"],
          where: {
            tenantId: ctx.tenantId,
            promptId: { in: prompts.map((p) => p.id) },
            createdAt: { gte: since },
            error: null,
          },
          _count: { _all: true },
        });

        const tally = new Map<string, { runs: number; mentioned: number }>();
        for (const row of runs) {
          const entry = tally.get(row.promptId) ?? { runs: 0, mentioned: 0 };
          entry.runs += row._count._all;
          if (row.brandMentioned) entry.mentioned += row._count._all;
          tally.set(row.promptId, entry);
        }

        return {
          windowDays: 30,
          prompts: prompts.map((p) => {
            const t = tally.get(p.id);
            return {
              // Customer-typed free text: untrusted, clipped, quarantined by
              // the evidence wrapper like everything else here.
              question: clip(p.text, 300),
              category: p.category,
              intent: p.intent,
              importanceWeight: p.importanceWeight,
              commercialValue: p.commercialValue,
              lastRunAt: p.lastRunAt,
              runs: t?.runs ?? 0,
              mentioned: t?.mentioned ?? 0,
              mentionRate: t && t.runs > 0 ? Math.round((t.mentioned / t.runs) * 100) : null,
            };
          }),
        };
      });
    },
  },

  {
    name: "getCompetitorSnapshots",
    description:
      "Tracked competitors and their most recent Google Places rating and review count, with the change over the last 7 and 30 days. Use it for 'how are we doing against X' questions.",
    schema: LimitSchema,
    inputSchema: LIMIT_JSON_SCHEMA,
    run: async (args, ctx) => {
      const limit = limitOf(args);
      return cached(ctx, tenantKey(ctx.tenantId, "competitors", limit), TTL_ROLLUP, async () => {
        const competitors = await prisma.competitor.findMany({
          where: { tenantId: ctx.tenantId, active: true },
          orderBy: { createdAt: "asc" },
          take: limit,
          select: {
            id: true,
            name: true,
            address: true,
            platform: true,
            snapshots: {
              orderBy: { day: "desc" },
              take: 31,
              select: { day: true, rating: true, reviewCount: true },
            },
          },
        });

        if (competitors.length === 0) {
          return {
            competitors: [],
            note: "No competitors are tracked on this account yet.",
          };
        }

        const delta = (
          rows: { rating: number | null; reviewCount: number | null }[],
          back: number,
        ) => {
          const latest = rows[0];
          const then = rows[Math.min(back, rows.length - 1)];
          if (!latest || !then || latest === then) return null;
          return {
            rating:
              latest.rating !== null && then.rating !== null
                ? Number((latest.rating - then.rating).toFixed(2))
                : null,
            reviews:
              latest.reviewCount !== null && then.reviewCount !== null
                ? latest.reviewCount - then.reviewCount
                : null,
          };
        };

        return {
          competitors: competitors.map((c) => ({
            // Places-sourced, i.e. written by strangers. Clipped like any other
            // third-party string.
            name: clip(c.name, 160),
            address: clip(c.address, 200),
            platform: c.platform,
            latest: c.snapshots[0]
              ? {
                  day: c.snapshots[0].day,
                  rating: c.snapshots[0].rating,
                  reviewCount: c.snapshots[0].reviewCount,
                }
              : null,
            change7d: delta(c.snapshots, 7),
            change30d: delta(c.snapshots, 30),
            snapshotDays: c.snapshots.length,
          })),
        };
      });
    },
  },

  {
    name: "getGscQueryStats",
    description:
      "Google Search Console query performance for this account: top queries by clicks over a recent window, with impressions, CTR and average position. Only available when Search Console is connected.",
    schema: z
      .object({
        days: z.number().int().min(1).max(90).optional(),
        limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
      })
      .strict(),
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          minimum: 1,
          maximum: 90,
          description: "Days back to aggregate. Defaults to 28.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: MAX_LIMIT,
          description: `How many queries to return. Defaults to ${DEFAULT_LIMIT}.`,
        },
      },
      additionalProperties: false,
    },
    run: async (args, ctx) => {
      const days = typeof args.days === "number" ? args.days : 28;
      const limit = limitOf(args);
      return cached(
        ctx,
        tenantKey(ctx.tenantId, "gsc", days, limit),
        TTL_ROLLUP,
        async () => {
          const connection = await prisma.gscConnection.findUnique({
            where: { tenantId: ctx.tenantId },
            select: { status: true, siteUrl: true, lastSyncAt: true, lastRowsSynced: true },
          });

          // THREE DISTINCT ANSWERS, and conflating them is the failure this
          // whole block exists to prevent.
          if (!connection) {
            return {
              connected: false,
              note: "Search Console is not connected on this account. Connecting it is a setting, not a purchase.",
            };
          }
          if (connection.status === "NEEDS_REAUTH") {
            return {
              connected: true,
              needsReauth: true,
              note: "The Search Console connection needs to be re-authorised before new data arrives.",
            };
          }

          const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          const rows = await prisma.gscQueryStat.groupBy({
            by: ["query"],
            where: {
              tenantId: ctx.tenantId,
              date: { gte: since },
              // page = "" is the query-only aggregate row; summing the
              // per-page rows on top of it would double every number.
              page: "",
            },
            _sum: { clicks: true, impressions: true },
            _avg: { position: true, ctr: true },
            orderBy: { _sum: { clicks: "desc" } },
            take: limit,
          });

          if (rows.length === 0) {
            return {
              connected: true,
              property: connection.siteUrl,
              lastSyncAt: connection.lastSyncAt,
              queries: [],
              note:
                connection.lastSyncAt === null
                  ? "Search Console is connected but has not synced yet. Data appears after the first nightly sync."
                  : "Search Console is connected and syncing, and has no query rows for this window. This is normal for a low-traffic property: Google withholds queries below its anonymity threshold. It does not mean the sync is broken.",
            };
          }

          return {
            connected: true,
            property: connection.siteUrl,
            windowDays: days,
            lastSyncAt: connection.lastSyncAt,
            queries: rows.map((r) => ({
              // Typed by strangers into Google. Untrusted text, clipped.
              query: clip(r.query, 200),
              clicks: r._sum.clicks ?? 0,
              impressions: r._sum.impressions ?? 0,
              ctr: r._avg.ctr !== null ? Number((r._avg.ctr * 100).toFixed(2)) : null,
              avgPosition: r._avg.position !== null ? Number(r._avg.position.toFixed(1)) : null,
            })),
          };
        },
      );
    },
  },

  {
    name: "getCrawlSummary",
    description:
      "The newest completed site crawl for this account: pages crawled, issue count, and the most common issues by type and severity. Use it for 'what is wrong with my site' questions.",
    schema: LimitSchema,
    inputSchema: LIMIT_JSON_SCHEMA,
    run: async (args, ctx) => {
      const limit = limitOf(args);
      return cached(ctx, tenantKey(ctx.tenantId, "crawl", limit), TTL_ROLLUP, async () => {
        const job = await prisma.crawlJob.findFirst({
          where: { tenantId: ctx.tenantId, status: "COMPLETED" },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            rootUrl: true,
            pagesCrawled: true,
            issueCount: true,
            stoppedReason: true,
            finishedAt: true,
          },
        });

        if (!job) {
          return {
            crawled: false,
            note: "This account has no completed site crawl. Running one is a tool the customer starts themselves.",
          };
        }

        // Grouped in the database rather than fetched and counted here: a
        // 25,000-page crawl's issues do not belong in this process's memory.
        const issues = await prisma.crawlIssue.groupBy({
          by: ["type", "severity"],
          where: { crawlPage: { crawlJobId: job.id } },
          _count: { _all: true },
          orderBy: { _count: { id: "desc" } },
          take: limit,
        });

        return {
          crawled: true,
          rootUrl: job.rootUrl,
          pagesCrawled: job.pagesCrawled,
          issueCount: job.issueCount,
          stoppedReason: job.stoppedReason,
          finishedAt: job.finishedAt,
          topIssues: issues.map((i) => ({
            type: i.type,
            severity: i.severity,
            pages: i._count._all,
          })),
        };
      });
    },
  },

  {
    name: "getRankTracking",
    description:
      "Read-only rank-tracking results already on file: tracked projects, their keywords, and each keyword's latest recorded position. Never starts a new check — positions come from runs that already happened.",
    schema: LimitSchema,
    inputSchema: LIMIT_JSON_SCHEMA,
    run: async (args, ctx) => {
      const limit = limitOf(args);
      return cached(ctx, tenantKey(ctx.tenantId, "ranks", limit), TTL_ROLLUP, async () => {
        const projects = await prisma.rankProject.findMany({
          where: { tenantId: ctx.tenantId, active: true },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            name: true,
            domain: true,
            device: true,
            frequency: true,
            lastRunAt: true,
            overCap: true,
            keywords: {
              take: limit,
              select: {
                keyword: true,
                snapshots: {
                  where: { status: "completed" },
                  orderBy: { runDate: "desc" },
                  take: 2,
                  select: { runDate: true, position: true, url: true },
                },
              },
            },
          },
        });

        if (projects.length === 0) {
          return {
            projects: [],
            note: "No rank-tracking projects on this account. Setting one up is a tool the customer starts themselves; the assistant cannot start a check.",
          };
        }

        return {
          projects: projects.map((p) => ({
            name: clip(p.name, 120),
            domain: p.domain,
            device: p.device,
            frequency: p.frequency,
            lastRunAt: p.lastRunAt,
            pausedByPlanCap: p.overCap,
            keywords: p.keywords.map((k) => {
              const [latest, previous] = k.snapshots;
              return {
                keyword: clip(k.keyword, 160),
                // null position is a real answer — "not in the top 100" —
                // and must never be rendered as 0 or as missing data.
                position: latest ? latest.position : null,
                positionMeaning:
                  latest && latest.position === null ? "not in the top 100" : undefined,
                checkedAt: latest?.runDate ?? null,
                previousPosition: previous ? previous.position : null,
                url: latest?.url ?? null,
              };
            }),
          })),
        };
      });
    },
  },

  {
    name: "getAiLensResults",
    description:
      "Read-only AI Lens results already on file: for pages that were analysed, the percentage of rendered words that are missing from the raw HTML a crawler sees. Never runs a new analysis.",
    schema: LimitSchema,
    inputSchema: LIMIT_JSON_SCHEMA,
    run: async (args, ctx) => {
      const limit = limitOf(args);
      return cached(ctx, tenantKey(ctx.tenantId, "ailens", limit), TTL_ROLLUP, async () => {
        const rows = await prisma.aiLensAnalysis.findMany({
          where: { tenantId: ctx.tenantId },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            url: true,
            gapPercent: true,
            rawWordCount: true,
            renderedWordCount: true,
            createdAt: true,
          },
        });

        if (rows.length === 0) {
          return {
            analyses: [],
            note: "No AI Lens analyses on this account yet. Running one costs a render and is started from the AI Lens page, not from here.",
          };
        }

        return {
          analyses: rows.map((r) => ({
            url: r.url,
            gapPercent: Number(r.gapPercent),
            rawWords: r.rawWordCount,
            renderedWords: r.renderedWordCount,
            analysedAt: r.createdAt,
          })),
        };
      });
    },
  },

  {
    name: "getCitations",
    description:
      "Which sources AI assistants cited when they answered this account's tracked questions: the domains and pages behind the answers, whether each supported this brand or a rival, and whether the citation verified.",
    schema: z
      .object({
        days: z.number().int().min(1).max(90).optional(),
        limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
      })
      .strict(),
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          minimum: 1,
          maximum: 90,
          description: "Days back to aggregate. Defaults to 30.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: MAX_LIMIT,
          description: `How many source domains to return. Defaults to ${DEFAULT_LIMIT}.`,
        },
      },
      additionalProperties: false,
    },
    run: async (args, ctx) => {
      const days = typeof args.days === "number" ? args.days : 30;
      const limit = limitOf(args);
      return cached(
        ctx,
        tenantKey(ctx.tenantId, "citations", days, limit),
        TTL_ROLLUP,
        async () => {
          const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          const byDomain = await prisma.citation.groupBy({
            by: ["domain"],
            where: { tenantId: ctx.tenantId, createdAt: { gte: since } },
            _count: { _all: true },
            orderBy: { _count: { id: "desc" } },
            take: limit,
          });

          if (byDomain.length === 0) {
            return {
              windowDays: days,
              sources: [],
              note: "No citations recorded in this window. Citations only exist for accounts whose tracked prompts have run against engines that cite sources.",
            };
          }

          const supporting = await prisma.citation.groupBy({
            by: ["domain", "supportsBrand"],
            where: {
              tenantId: ctx.tenantId,
              createdAt: { gte: since },
              domain: { in: byDomain.map((d) => d.domain) },
            },
            _count: { _all: true },
          });

          const brandTally = new Map<string, number>();
          for (const row of supporting) {
            if (row.supportsBrand) {
              brandTally.set(row.domain, (brandTally.get(row.domain) ?? 0) + row._count._all);
            }
          }

          return {
            windowDays: days,
            sources: byDomain.map((d) => ({
              domain: d.domain,
              citations: d._count._all,
              supportingThisBrand: brandTally.get(d.domain) ?? 0,
            })),
          };
        },
      );
    },
  },

  {
    name: "getBrandMentions",
    description:
      "Which other companies AI assistants named alongside — or instead of — this brand when answering its tracked questions, with how often and how prominently. Only entities the classifier judged to be rivals are counted as competitors.",
    schema: z
      .object({
        days: z.number().int().min(1).max(90).optional(),
        limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
      })
      .strict(),
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          minimum: 1,
          maximum: 90,
          description: "Days back to aggregate. Defaults to 30.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: MAX_LIMIT,
          description: `How many entities to return. Defaults to ${DEFAULT_LIMIT}.`,
        },
      },
      additionalProperties: false,
    },
    run: async (args, ctx) => {
      const days = typeof args.days === "number" ? args.days : 30;
      const limit = limitOf(args);
      return cached(
        ctx,
        tenantKey(ctx.tenantId, "mentions", days, limit),
        TTL_ROLLUP,
        async () => {
          const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          const rows = await prisma.competitorMention.groupBy({
            by: ["name", "classification"],
            where: { tenantId: ctx.tenantId, createdAt: { gte: since } },
            _count: { _all: true },
            _sum: { mentionCount: true },
            _avg: { prominenceScore: true },
            orderBy: { _sum: { mentionCount: "desc" } },
            take: limit,
          });

          if (rows.length === 0) {
            return {
              windowDays: days,
              entities: [],
              note: "No competitor mentions recorded in this window. That needs tracked prompts that have actually run.",
            };
          }

          return {
            windowDays: days,
            entities: rows.map((r) => ({
              // Model-generated third-party text. Untrusted, clipped.
              name: clip(r.name, 160),
              // null classification means "not yet judged", NOT "a rival" —
              // asserting an unexamined entity is a competitor is the error
              // the classifier exists to stop.
              classification: r.classification ?? "unclassified",
              appearances: r._count._all,
              mentions: r._sum.mentionCount ?? 0,
              avgProminence:
                r._avg.prominenceScore !== null ? Math.round(r._avg.prominenceScore) : null,
            })),
          };
        },
      );
    },
  },

  {
    name: "getWeeklyIntelligence",
    description:
      "The precomputed weekly read on this account: visibility delta week over week, prompts that gained or lost ground, competitor movement, and whether the site audit changed. Cheapest way to answer 'what changed' and 'why'.",
    schema: NO_ARGS_SCHEMA,
    inputSchema: NO_ARGS_JSON_SCHEMA,
    run: async (_args, ctx) => {
      const summary = await readIntelligence(ctx.tenantId);
      if (!summary) {
        return {
          ok: true,
          value: {
            available: false,
            note: "No weekly summary has been computed for this account yet. It is written by a background job after visibility, crawl or competitor data is ingested — a new account will not have one.",
          },
          cached: false,
        };
      }
      return { ok: true, value: { available: true, ...summary }, cached: true };
    },
  },
];

const BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

/** Every tool name, in wire order. Stable: the prompt cache prefix depends on it. */
export const TOOL_NAMES: readonly string[] = TOOLS.map((tool) => tool.name);

/** The tool list sent to the model. Order is fixed, for the prompt cache. */
export function toolDefinitions(): ToolDefinition[] {
  return TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

export interface ToolCallResult {
  ok: boolean;
  value: unknown;
  cached: boolean;
  /** Set when the call never reached the tool body. */
  rejected?: "unknown_tool" | "invalid_args";
}

/**
 * Execute one tool call from the model.
 *
 * NEVER THROWS. An unknown tool, bad arguments, or a database that refused all
 * come back as a `tool_result` the model can read and react to. Throwing would
 * end the turn on a recoverable mistake, and the model's most likely next move
 * after a clear error message is a corrected call.
 *
 * PER-TURN DEDUPE lives here rather than in each tool, so it cannot be
 * forgotten by the next tool somebody adds.
 */
export async function runTool(
  name: string,
  rawArgs: unknown,
  ctx: ToolContext,
): Promise<ToolCallResult> {
  const tool = BY_NAME.get(name);
  if (!tool) {
    return {
      ok: false,
      cached: false,
      rejected: "unknown_tool",
      value: {
        error: `There is no tool called "${clip(name, 60)}". Available tools: ${TOOL_NAMES.join(", ")}.`,
      },
    };
  }

  const parsed = tool.schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      cached: false,
      rejected: "invalid_args",
      value: {
        error: `Those arguments are not valid for ${tool.name}: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join("; ")}`,
      },
    };
  }

  const args = parsed.data as Record<string, unknown>;
  // Same tool, same args, one execution. Keyed on the PARSED args so
  // `{}` and `{ limit: undefined }` dedupe to the same call.
  const memoKey = `tool:${tool.name}:${JSON.stringify(args, Object.keys(args).sort())}`;

  try {
    const outcome = await ctx.turn.memo(memoKey, () => tool.run(args, ctx));
    return { ok: outcome.ok, value: outcome.value, cached: outcome.cached };
  } catch (err) {
    logger.warn(
      { tool: tool.name, tenantId: ctx.tenantId, err: String(err) },
      "assistant pro: tool failed",
    );
    return {
      ok: false,
      cached: false,
      value: {
        error: `${tool.name} could not be read just now. Answer from what you already have and say that this part is missing.`,
      },
    };
  }
}

/**
 * The domains a tenant is allowed to be asked about, most authoritative first.
 *
 * Read from the tenant's own rows and nowhere else. This is the list
 * `resolveOwnDomain` checks every fetch against, so anything added here widens
 * what the assistant can point at a network socket.
 */
export async function tenantDomains(tenantId: string): Promise<string[]> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { auditDomain: true, botAnalyticsDomain: true, customDomain: true },
  });
  if (!tenant) return [];

  const seen = new Set<string>();
  for (const raw of [tenant.auditDomain, tenant.botAnalyticsDomain, tenant.customDomain]) {
    if (!raw) continue;
    const domain = registrableDomain(raw);
    if (domain && domain.includes(".")) seen.add(domain);
  }
  return [...seen];
}
