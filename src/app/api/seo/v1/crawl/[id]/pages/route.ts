/**
 * GET /api/seo/v1/crawl/[id]/pages — paginated crawled pages.
 *
 * Filters: inSitemap, minInlinks/maxInlinks, depth. Each is validated rather
 * than coerced — an unparseable depth is a 400, not a silent "all pages",
 * which would look like the filter had been applied and found everything.
 *
 * Tenant scoping is on the PARENT crawl, same as the issues endpoint.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { crawlRouteError } from "@/lib/site-crawler/http";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;

    const crawl = await prisma.crawlJob.findFirst({
      where: { id, tenantId: tenant.tenantId },
      select: { id: true },
    });
    if (!crawl) {
      return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE),
    );

    // ── Filters ──────────────────────────────────────────────────────────
    const inSitemapParam = url.searchParams.get("inSitemap");
    const depthParam = url.searchParams.get("depth");
    const minInlinksParam = url.searchParams.get("minInlinks");
    const maxInlinksParam = url.searchParams.get("maxInlinks");

    if (inSitemapParam !== null && inSitemapParam !== "true" && inSitemapParam !== "false") {
      return NextResponse.json(
        { error: "inSitemap must be true or false", code: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    const numeric = (raw: string | null, name: string) => {
      if (raw === null) return { ok: true as const, value: undefined };
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) {
        return { ok: false as const, name };
      }
      return { ok: true as const, value: n };
    };

    const depth = numeric(depthParam, "depth");
    const minInlinks = numeric(minInlinksParam, "minInlinks");
    const maxInlinks = numeric(maxInlinksParam, "maxInlinks");
    for (const parsed of [depth, minInlinks, maxInlinks]) {
      if (!parsed.ok) {
        return NextResponse.json(
          { error: `${parsed.name} must be a non-negative integer`, code: "INVALID_REQUEST" },
          { status: 400 },
        );
      }
    }

    const inlinkRange = {
      ...(minInlinks.value !== undefined ? { gte: minInlinks.value } : {}),
      ...(maxInlinks.value !== undefined ? { lte: maxInlinks.value } : {}),
    };

    const where = {
      crawlJobId: crawl.id,
      ...(inSitemapParam !== null ? { inSitemap: inSitemapParam === "true" } : {}),
      ...(depth.value !== undefined ? { depth: depth.value } : {}),
      ...(Object.keys(inlinkRange).length > 0 ? { inlinkCount: inlinkRange } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.crawlPage.count({ where }),
      prisma.crawlPage.findMany({
        where,
        orderBy: [{ depth: "asc" }, { url: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          url: true,
          statusCode: true,
          title: true,
          titleLength: true,
          metaDescLength: true,
          h1Count: true,
          wordCount: true,
          depth: true,
          internalLinks: true,
          fetchMs: true,
          contentType: true,
          redirectTarget: true,
          canonical: true,
          inlinkCount: true,
          inSitemap: true,
          _count: { select: { issues: true } },
        },
      }),
    ]);

    return NextResponse.json({
      pages: rows.map((r) => ({
        id: r.id,
        url: r.url,
        statusCode: r.statusCode,
        title: r.title,
        titleLength: r.titleLength,
        metaDescLength: r.metaDescLength,
        h1Count: r.h1Count,
        wordCount: r.wordCount,
        depth: r.depth,
        internalLinks: r.internalLinks,
        fetchMs: r.fetchMs,
        contentType: r.contentType,
        redirectTarget: r.redirectTarget,
        canonical: r.canonical,
        inlinkCount: r.inlinkCount,
        inSitemap: r.inSitemap,
        issueCount: r._count.issues,
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    return crawlRouteError(err);
  }
}
