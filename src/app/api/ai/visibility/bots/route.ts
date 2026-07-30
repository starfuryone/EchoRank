// src/app/api/ai/visibility/bots/route.ts
//
// GET  — everything the Bot Analytics page needs in one call: the resolved
//        domain and where it came from, the latest stored access check (with a
//        freshness flag), this month's allowances, and the log-analysis history.
// POST — runs a new access check against the tenant's own domain.
//
// The tool no longer gates on /visibility. It used to return {url: null} when
// the workspace had no audited site, and the page turned that into a dead-end
// button pointing at another product surface. Now a null domain is a prompt to
// enter one, and this route reports which of the three sources answered so the
// UI can say so.
//
// No URL parameter is accepted on either verb. The domain always comes from
// tenant-owned rows via resolveBotAnalyticsDomain(), and runAccessCheck() runs
// the SSRF guard again before anything leaves the box.

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { enforcementErrorResponse } from "@/lib/plan-enforcement";
import { prisma } from "@/lib/prisma";
import { resolveBotAnalyticsDomain } from "@/lib/bot-analytics/domain";
import { runAccessCheck } from "@/lib/bot-analytics/check";
import { isCheckFresh } from "@/lib/bot-analytics/verdict";
import {
  BOT_CHECK_MONTHLY_LIMIT,
  BotCheckQuotaUnavailableError,
  botChecksUsed,
  releaseBotCheck,
  reserveBotCheck,
} from "@/lib/bot-analytics/quota";
import { canUploadLogs, uploadLimit, uploadsUsed } from "@/lib/bot-analytics/upload";

const HISTORY_LIMIT = 10;

function unauthorized(error: unknown): NextResponse | null {
  if (error instanceof Error && error.message === "Not authenticated or no tenant access") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  try {
    const membership = await requirePaidPlan();
    const tenantId = membership.tenantId;
    const plan = membership.tenant.planType;

    const { domain, source } = await resolveBotAnalyticsDomain(tenantId);

    const [latest, analyses, checksUsedCount, uploadsUsedCount] = await Promise.all([
      prisma.botAccessCheck.findFirst({
        where: { tenantId },
        orderBy: { checkedAt: "desc" },
      }),
      prisma.botLogAnalysis.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
      }),
      botChecksUsed(tenantId),
      uploadsUsed(tenantId),
    ]);

    // A stored check for a domain the tenant has since changed is not this
    // domain's posture, so it is not served as if it were.
    const checkMatchesDomain = latest && domain && latest.domain === domain;

    return NextResponse.json({
      domain,
      domainSource: source,
      check: checkMatchesDomain
        ? {
            domain: latest.domain,
            results: latest.results,
            robotsPresent: latest.robotsPresent,
            sitemapFound: latest.sitemapFound,
            llmsTxt: latest.llmsTxt,
            checkedAt: latest.checkedAt.toISOString(),
            fresh: isCheckFresh(latest.checkedAt),
            error: latest.error,
          }
        : null,
      checks: { used: checksUsedCount, limit: BOT_CHECK_MONTHLY_LIMIT },
      logs: {
        enabled: canUploadLogs(plan),
        used: uploadsUsedCount,
        limit: uploadLimit(plan),
        analyses: analyses.map((a) => ({
          id: a.id,
          filename: a.filename,
          sizeBytes: a.sizeBytes,
          status: a.status,
          error: a.error,
          periodStart: a.periodStart?.toISOString() ?? null,
          periodEnd: a.periodEnd?.toISOString() ?? null,
          linesParsed: a.linesParsed,
          linesSkipped: a.linesSkipped,
          botHits: a.botHits,
          aggregates: a.aggregates,
          createdAt: a.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    const resp = enforcementErrorResponse(error) ?? unauthorized(error);
    if (resp) return resp;
    console.error("[visibility/bots GET]", error);
    return NextResponse.json({ error: "Failed to load Bot Analytics." }, { status: 500 });
  }
}

export async function POST() {
  let tenantId: string | null = null;
  let reserved = false;
  try {
    const membership = await requirePaidPlan();
    tenantId = membership.tenantId;

    const { domain } = await resolveBotAnalyticsDomain(tenantId);
    if (!domain) {
      return NextResponse.json(
        { error: "Set a domain before running a check." },
        { status: 400 },
      );
    }

    // Reserve before probing: the cost we are capping is the dozen requests we
    // are about to aim at the customer's origin, so the counter has to move
    // first or two concurrent clicks both get through.
    const quota = await reserveBotCheck(tenantId);
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: `Monthly access-check limit reached (${quota.limit}).`,
          code: "BotCheckQuotaExceededError",
          checks: { used: quota.used, limit: quota.limit },
        },
        { status: 429 },
      );
    }
    reserved = true;

    const result = await runAccessCheck(domain);

    const stored = await prisma.botAccessCheck.create({
      data: {
        tenantId,
        domain: result.domain,
        results: result.results as unknown as object,
        robotsPresent: result.robotsPresent,
        sitemapFound: result.sitemapFound,
        llmsTxt: result.llmsTxt,
      },
    });
    reserved = false; // the check ran and is stored; the reservation is earned

    return NextResponse.json({
      check: {
        domain: stored.domain,
        results: stored.results,
        robotsPresent: stored.robotsPresent,
        sitemapFound: stored.sitemapFound,
        llmsTxt: stored.llmsTxt,
        checkedAt: stored.checkedAt.toISOString(),
        fresh: true,
        error: null,
      },
      checks: { used: quota.used, limit: quota.limit },
    });
  } catch (error) {
    const resp = enforcementErrorResponse(error) ?? unauthorized(error);
    if (resp) return resp;
    if (error instanceof BotCheckQuotaUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("[visibility/bots POST]", error);
    return NextResponse.json(
      { error: "Could not complete the access check." },
      { status: 502 },
    );
  } finally {
    // Nothing was stored, so the tenant should not have paid for it.
    if (reserved && tenantId) await releaseBotCheck(tenantId);
  }
}
