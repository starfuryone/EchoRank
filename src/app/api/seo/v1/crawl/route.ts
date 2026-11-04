/**
 * POST /api/seo/v1/crawl — start a full-site crawl.
 * GET  /api/seo/v1/crawl — this tenant's crawls, newest first.
 *
 * Returns 202 on POST: a crawl runs for minutes to an hour, so this never
 * waits for it. The worker owns the run and the UI polls GET /[id].
 *
 * Guard chain: requirePaidPlan (session + tenant + ACTIVE billing) → zod →
 * request rate limit → plan lock → SSRF/URL validation → monthly quota.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import type { CrawlStatus } from "@/generated/prisma";
import { startCrawl, toCrawlDto } from "@/lib/site-crawler/service";
import { getCrawlQuota } from "@/lib/site-crawler/quota";
import { crawlRouteError } from "@/lib/site-crawler/http";
import {
  START_RATE_LIMIT,
  START_RATE_WINDOW_MS,
  StartCrawlBodySchema as BodySchema,
  startRateKey,
} from "@/lib/site-crawler/start-body";

const LIST_LIMIT = 20;
/** History view (?history=1): a page of every crawl the tenant has, filtered. */
const HISTORY_PAGE_SIZE = 50;
const HISTORY_STATUSES: Record<string, CrawlStatus[]> = {
  COMPLETED: ["COMPLETED"],
  FAILED: ["FAILED"],
  CANCELLED: ["CANCELLED"],
  ACTIVE: ["QUEUED", "RUNNING"],
};

export async function POST(request: Request) {
  try {
    const tenant = await requirePaidPlan();

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", code: "INVALID_REQUEST", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const limited = await rateLimit(
      startRateKey(tenant.tenantId),
      START_RATE_LIMIT,
      START_RATE_WINDOW_MS,
    );
    if (!limited.success) {
      return NextResponse.json(
        { error: "Too many crawls in a row. Wait a minute.", code: "RATE_LIMITED" },
        { status: 429 },
      );
    }

    const job = await startCrawl(
      tenant.tenantId,
      tenant.tenant.planType,
      parsed.data.url,
      parsed.data.renderMode,
      {
        config: parsed.data.config,
        saveAsDefault: parsed.data.saveAsDefault,
        mode: parsed.data.mode,
        urls: parsed.data.urls,
      },
    );
    return NextResponse.json(job, { status: 202 });
  } catch (err) {
    return crawlRouteError(err);
  }
}

export async function GET(request?: Request) {
  try {
    const tenant = await requirePaidPlan();

    const params = request ? new URL(request.url).searchParams : null;
    if (params?.get("history") === "1") {
      const host = (params.get("host") ?? "").trim().slice(0, 200);
      const statuses = HISTORY_STATUSES[params.get("status") ?? ""];
      const page = Math.max(1, Math.min(10_000, Number.parseInt(params.get("page") ?? "1", 10) || 1));
      const where = {
        tenantId: tenant.tenantId,
        ...(host ? { rootUrl: { contains: host, mode: "insensitive" as const } } : {}),
        ...(statuses ? { status: { in: statuses } } : {}),
      };
      const [rows, total, quota] = await Promise.all([
        prisma.crawlJob.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * HISTORY_PAGE_SIZE,
          take: HISTORY_PAGE_SIZE,
        }),
        prisma.crawlJob.count({ where }),
        getCrawlQuota(tenant.tenantId, tenant.tenant.planType),
      ]);
      return NextResponse.json({ crawls: rows.map(toCrawlDto), quota, total, page, pageSize: HISTORY_PAGE_SIZE });
    }

    const [rows, quota] = await Promise.all([
      prisma.crawlJob.findMany({
        where: { tenantId: tenant.tenantId },
        orderBy: { createdAt: "desc" },
        take: LIST_LIMIT,
      }),
      getCrawlQuota(tenant.tenantId, tenant.tenant.planType),
    ]);

    return NextResponse.json({ crawls: rows.map(toCrawlDto), quota });
  } catch (err) {
    return crawlRouteError(err);
  }
}
