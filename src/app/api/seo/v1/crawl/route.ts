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
import type { CrawlStatus, Prisma } from "@/generated/prisma";
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
/** History view (?history=1): a cursor page of every crawl the tenant has, filtered. */
const HISTORY_PAGE_SIZE = 20;
/** Distinct sites offered by the host filter. */
const HISTORY_HOSTS_MAX = 100;
/** "Stopped at limit": the crawl ended on the page or time ceiling, not an empty frontier. */
const LIMIT_REASONS = ["url_cap", "time_cap"];
const HISTORY_STATUSES: Record<string, Prisma.CrawlJobWhereInput> = {
  COMPLETED: { status: "COMPLETED", stoppedReason: null },
  STOPPED: { status: "COMPLETED", stoppedReason: { in: LIMIT_REASONS } },
  // A list crawl whose list expired before it ran never crawled anything.
  FAILED: { OR: [{ status: "FAILED" }, { status: "COMPLETED", stoppedReason: "list_expired" }] },
  CANCELLED: { status: "CANCELLED" },
  ACTIVE: { status: { in: ["QUEUED", "RUNNING"] satisfies CrawlStatus[] } },
};

/** Host of a root URL, lower case; "" when it does not parse. */
function hostOf(rootUrl: string): string {
  try {
    return new URL(rootUrl).host.toLowerCase();
  } catch {
    return "";
  }
}

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
      // Exact site: the host of the root URL (with its port, if any), either scheme.
      const host = (params.get("host") ?? "").trim().toLowerCase().slice(0, 200);
      const status = HISTORY_STATUSES[params.get("status") ?? ""];
      const filters: Prisma.CrawlJobWhereInput[] = [];
      if (host) {
        filters.push({
          OR: ["http", "https"].flatMap((scheme) => [
            { rootUrl: { startsWith: `${scheme}://${host}/`, mode: "insensitive" as const } },
            { rootUrl: { equals: `${scheme}://${host}`, mode: "insensitive" as const } },
          ]),
        });
      }
      if (status) filters.push(status);
      const where: Prisma.CrawlJobWhereInput = { tenantId: tenant.tenantId, AND: filters };

      // Keyset cursor: the last crawl of the previous page, read tenant-scoped so
      // another workspace's id positions nothing. An unknown cursor is page 1.
      const cursorId = (params.get("cursor") ?? "").slice(0, 64);
      const cursor = cursorId
        ? await prisma.crawlJob.findFirst({ where: { id: cursorId, tenantId: tenant.tenantId }, select: { id: true, createdAt: true } })
        : null;
      const after: Prisma.CrawlJobWhereInput = cursor
        ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }
        : {};

      const [rows, total, sites, quota] = await Promise.all([
        prisma.crawlJob.findMany({
          where: { AND: [where, after] },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: HISTORY_PAGE_SIZE + 1,
        }),
        prisma.crawlJob.count({ where }),
        prisma.crawlJob.findMany({
          where: { tenantId: tenant.tenantId },
          distinct: ["rootUrl"],
          select: { rootUrl: true },
          orderBy: { rootUrl: "asc" },
          take: HISTORY_HOSTS_MAX * 3,
        }),
        getCrawlQuota(tenant.tenantId, tenant.tenant.planType),
      ]);
      const page = rows.slice(0, HISTORY_PAGE_SIZE);
      const nextCursor = rows.length > HISTORY_PAGE_SIZE ? page[page.length - 1].id : null;
      const hosts = [...new Set(sites.map((r) => hostOf(r.rootUrl)).filter(Boolean))].sort().slice(0, HISTORY_HOSTS_MAX);
      return NextResponse.json({ crawls: page.map(toCrawlDto), quota, total, nextCursor, pageSize: HISTORY_PAGE_SIZE, hosts });
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
