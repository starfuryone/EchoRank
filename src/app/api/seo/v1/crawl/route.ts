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
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { MAX_URL_LENGTH } from "@/lib/site-crawler/url";
import { startCrawl, toCrawlDto } from "@/lib/site-crawler/service";
import { getCrawlQuota } from "@/lib/site-crawler/quota";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { RENDER_MODES } from "@/lib/site-crawler/types";
import { CrawlConfigInputSchema } from "@/lib/site-crawler/crawl-config";
import { MAX_LIST_LINES } from "@/lib/site-crawler/url-list";

/** Starts per tenant per minute. A floor under the monthly allowance, which
 * for STARTER is only 4 and could otherwise be burned by a double-click. */
const START_RATE_LIMIT = 3;
const START_RATE_WINDOW_MS = 60_000;

const LIST_LIMIT = 20;

const BodySchema = z.object({
  /** Spider mode's start URL. Ignored in list mode. */
  url: z.string().trim().max(MAX_URL_LENGTH).default(""),
  /** Phase 4a list mode: fetch `urls` once each, no discovery. */
  mode: z.enum(["spider", "list"]).default("spider"),
  urls: z.array(z.string().trim().max(MAX_URL_LENGTH)).max(MAX_LIST_LINES).optional(),
  /** Phase 3b. Capped by the plan's rendered pages per crawl. */
  renderMode: z.enum(RENDER_MODES).default("none"),
  /** Phase 4a. Omitted = the defaults. Secrets in clear here, sealed before storage. */
  config: CrawlConfigInputSchema.optional(),
  saveAsDefault: z.boolean().default(false),
});

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
      `site-crawl:${tenant.tenantId}`,
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

export async function GET() {
  try {
    const tenant = await requirePaidPlan();

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
