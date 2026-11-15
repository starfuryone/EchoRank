// src/lib/mcp/capabilities.ts
//
// Binds the protocol handler's capability interface to real, tenant-scoped
// data. One place; the route below it does auth and nothing else.
//
// THE TENANT IS LOADED ONCE, LAZILY, AND SHARED. Almost every tool needs the
// plan (quota decisions) and the name (whoami), and a `tools/call` is one tool
// per HTTP request — so this memoises the lookup per capability object rather
// than per call. It is lazy because `initialize`, `ping` and `tools/list` need
// no tenant at all, and paying a database round-trip to answer `ping` would be
// a round-trip on every client's every reconnect.

import { crawlDataState } from "@/lib/site-crawler/data-state";
import "server-only";

import { prisma } from "@/lib/prisma";
import { sidecarPost } from "@/lib/av-sidecar";
import { getVisibilitySummary } from "@/lib/visibility-summary";
import type { McpCapabilities } from "./handler";
import * as reads from "./reads";
import { findPublicCrawl, listPublicCrawls, publicCrawlDetail, publicIssues, queueEstimate } from "@/lib/site-crawler/public-api";
import { acceptCallbackUrl, startViaApi, startedView } from "@/lib/site-crawler/public-start";
import { CrawlConfigInputSchema } from "@/lib/site-crawler/crawl-config";
import { getMemorySettings, searchMemories } from "@/lib/memory/client";
import { memoryAllowance, planHasMemory } from "@/lib/memory/limits";
import { memoryAddsUsed } from "@/lib/memory/quota";
import { rememberLater } from "@/lib/memory/recall";

export function capsFor(tenantId: string, keyId = ""): McpCapabilities {
  let tenantPromise: Promise<reads.McpTenant> | null = null;
  const tenant = () => (tenantPromise ??= reads.loadMcpTenant(tenantId));

  return {
    async whoami() {
      return reads.whoami(await tenant());
    },

    async suggestKeywords(url, depth) {
      const { status, data } = await sidecarPost<{ error?: string }>("/keywords", {
        url,
        depth,
        ai: false,
      });
      if (status !== 200 || (data as { error?: string }).error) {
        throw new Error((data as { error?: string }).error || "Keyword analysis failed.");
      }
      return data;
    },

    async getLatestAudit() {
      const audit = await prisma.visibilityAudit.findFirst({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        // scoreVersion 2 = the AI readiness score (Nov 2026); compare within one version.
        select: { url: true, score: true, grade: true, scoreVersion: true, checks: true, createdAt: true },
      });
      if (!audit) throw new Error("No audit stored yet — run one on the AI Visibility page.");
      return audit;
    },

    async getVisibilitySummary() {
      const t = await tenant();
      const auditDomain = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { auditDomain: true },
      });
      return getVisibilitySummary(t.id, t.name, t.plan, auditDomain?.auditDomain ?? null);
    },

    async getSerpCheck(args) {
      return reads.getSerpCheck(await tenant(), args);
    },
    async startSerpCheck(args) {
      return reads.startSerpCheck(await tenant(), args);
    },
    async getRankTracker(args) {
      return reads.getRankTracker(await tenant(), args);
    },
    async addRankTrackingKeywords(args) {
      return reads.addRankTrackingKeywords(await tenant(), args);
    },
    async removeRankTrackingKeywords(args) {
      return reads.removeRankTrackingKeywords(await tenant(), args);
    },
    async getBacklinksOverview(args) {
      return reads.getBacklinksOverview(await tenant(), args);
    },
    async getDomainOverview(args) {
      return reads.getDomainOverview(await tenant(), args);
    },
    async listKeywordOpportunities(args) {
      return reads.listKeywordOpportunities(await tenant(), args);
    },
    async getAiCitations(args) {
      return reads.getAiCitations(await tenant(), args);
    },
    async getResearchLog(args) {
      return reads.getResearchLog(await tenant(), args);
    },
    async getGscQueries(args) {
      return reads.getGscQueries(await tenant(), args);
    },
    async getCrawlSummary(args) {
      return reads.getCrawlSummary(await tenant(), args);
    },

    // Phase 3d-A: the public crawl API as tools (src/lib/site-crawler/public-*.ts).
    async startCrawl(args) {
      const callbackUrl = acceptCallbackUrl(args.callbackUrl as string | undefined);
      const { crawlId } = await startViaApi(
        { tenantId, keyId },
        {
          url: (args.url as string) ?? "",
          mode: (args.mode as "spider" | "list") ?? "spider",
          urls: args.urls as string[] | undefined,
          renderMode: (args.renderMode as "none" | "thin" | "all") ?? "none",
          // Through the dashboard's schema, so its defaults and checks apply.
          config: typeof args.maxUrls === "number" ? CrawlConfigInputSchema.parse({ maxUrls: args.maxUrls }) : undefined,
          saveAsDefault: false,
        },
        callbackUrl,
      );
      return startedView(crawlId);
    },
    async getCrawlStatus(args) {
      const row = await findPublicCrawl(tenantId, args.crawlId as string);
      if (!row) throw new Error("No crawl with that id in this workspace.");
      const [detail, queue] = await Promise.all([publicCrawlDetail(row), queueEstimate(row)]);
      return { ...detail, ...queue };
    },
    async getCrawlIssues(args) {
      const crawl = await prisma.crawlJob.findFirst({ where: { id: args.crawlId as string, tenantId }, select: { id: true, config: true, storageState: true, dataPurgedAt: true } });
      if (!crawl) throw new Error("No crawl with that id in this workspace.");
      if (crawlDataState(crawl) === "archived") throw new Error("This crawl is archived. Restore it from History on the Site Crawler page to list its findings.");
      return publicIssues(crawl, {
        ruleId: (args.ruleId as string) ?? null,
        family: (args.family as string) ?? null,
        kind: (args.kind as string) ?? null,
        segment: typeof args.segment === "number" ? String(args.segment) : null,
        cursor: (args.cursor as string) ?? null,
        limit: (args.limit as number) ?? null,
      });
    },
    async listCrawls(args) {
      return { crawls: await listPublicCrawls(tenantId, { host: (args.host as string) ?? null, limit: (args.limit as number) ?? null }) };
    },

    // AI memory (src/lib/memory/). The scope is this key's tenantId, closed
    // over above; nothing in `args` can name another tenant.
    async remember(args) {
      const t = await tenant();
      const { addsPerMonth } = memoryAllowance(t.plan);
      if (!planHasMemory(t.plan)) throw new Error(`AI memory is not included in the ${t.plan} plan.`);
      const settings = await getMemorySettings(tenantId).catch(() => null);
      if (!settings) throw new Error("AI memory is unavailable right now; nothing was saved. Try again shortly.");
      if (!settings.enabled) throw new Error("AI memory is switched off for this workspace (Settings → AI memory); nothing was saved.");
      const used = await memoryAddsUsed(tenantId);
      if (addsPerMonth !== null && used >= addsPerMonth) {
        throw new Error(`This month's AI memory allowance (${addsPerMonth} adds) is used up; nothing was saved.`);
      }
      const queued = await rememberLater({ tenantId, plan: t.plan, surface: "mcp", locale: "en", text: args.text as string });
      if (!queued) throw new Error("AI memory is unavailable right now; nothing was saved. Try again shortly.");
      return { queued: true, addsUsed: used + 1, addsLimit: addsPerMonth };
    },
    async recall(args) {
      const t = await tenant();
      if (!planHasMemory(t.plan)) throw new Error(`AI memory is not included in the ${t.plan} plan.`);
      const { ok, results } = await searchMemories({
        tenantId,
        query: args.query as string,
        limit: (args.limit as number) ?? 5,
      });
      return {
        available: ok,
        memories: results.map((r) => ({
          id: r.id,
          memory: r.memory,
          score: typeof r.score === "number" ? r.score : null,
          createdAt: r.created_at ?? null,
          surface: r.surface ?? null,
        })),
      };
    },
  };
}
