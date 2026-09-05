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

import "server-only";

import { prisma } from "@/lib/prisma";
import { sidecarPost } from "@/lib/av-sidecar";
import { getVisibilitySummary } from "@/lib/visibility-summary";
import type { McpCapabilities } from "./handler";
import * as reads from "./reads";

export function capsFor(tenantId: string): McpCapabilities {
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
        select: { url: true, score: true, grade: true, checks: true, createdAt: true },
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
  };
}
