/**
 * GET /api/seo/v1/crawl/[id]/pages — paginated crawled pages.
 *
 * Filters: inSitemap, minInlinks/maxInlinks, depth, and (Phase 4b)
 * search=N&hit=true|false — custom search N matched / did not, and
 * segment=N (the CSV then carries a Segment column), and (Phase 4c)
 * urlPrefix=… — URLs starting with it (the Structure tab's click-through),
 * and rule=<id> — pages with a finding of that rule (Issues' "See all pages").
 * Pages view: q=… (URL or title contains, any case) and scope=indexable |
 * nonindexable | errors | redirects | orphans (pages-sort.ts PAGE_SCOPES).
 * Sorts: a metric key, linkScore, or status | issues | score | inlinks
 * (crawl_pages columns; score and issues are written in the summary pass).
 * status=2xx|3xx|4xx|5xx|none — a status class (the public API's filter).
 * Paging: `cursor` (the Pages view, 50 a page) — a keyset on the sort column
 * and id, or "o:<offset>" for a metric sort; the legacy `page` still works.
 * Phase 4d: every row carries its joined metrics (GSC, PSI, GA4, backlinks);
 * sort=<metric key>&dir=asc|desc orders by one (pages-sort.ts); the CSV
 * carries every metric column of each source the crawl has data from. Each is validated rather
 * than coerced — an unparseable depth is a 400, not a silent "all pages",
 * which would look like the filter had been applied and found everything.
 *
 * Tenant scoping is on the PARENT crawl, same as the issues endpoint.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma";
import { RULE_BY_ID } from "@/lib/crawl-rules";
import { flag } from "@/lib/flags";
import { requirePaidPlan } from "@/lib/paid-plan";
import { csvFilename } from "@/lib/csv-export";
import { LINK_SCORE_COLUMN, metricCsvColumns, pageColumns, withSegmentColumn, type CrawlPageRow } from "@/lib/site-crawler/csv-columns";
import { METRIC_SORT_KEYS, METRIC_SOURCES } from "@/lib/site-crawler/metrics-shared";
import { metricCoverage } from "@/lib/site-crawler/metrics";
import {
  PAGE_SCOPES,
  STATUS_CLASSES,
  pageIdsByMetric,
  pageScopeWhere,
  pageSearchWhere,
  statusClassWhere,
  type PageScope,
  type StatusClass,
} from "@/lib/site-crawler/pages-sort";
import { pageInSegment, segmentScope } from "@/lib/site-crawler/segment-filter";
import { readStoredConfig } from "@/lib/site-crawler/crawl-config";
import { csvStreamResponse, wantsCsv } from "@/lib/csv-stream";
import { prisma } from "@/lib/prisma";
import { archivedGuard, crawlRouteError } from "@/lib/site-crawler/http";
import { DATA_STATE_SELECT } from "@/lib/site-crawler/data-state";
import { ruleIssueOnPage } from "@/lib/site-crawler/rule-summary";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/** Sorts on crawl_pages columns (nullable ones sort nulls last). */
const NATIVE_SORTS = { status: "statusCode", issues: "issueTotal", score: "pageScore", inlinks: "inlinkCount", linkScore: "linkScore" } as const;
type NativeSort = keyof typeof NATIVE_SORTS;
type NativeColumn = (typeof NATIVE_SORTS)[NativeSort];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;

    const crawl = await prisma.crawlJob.findFirst({
      where: { id, tenantId: tenant.tenantId },
      select: { id: true, config: true, ...DATA_STATE_SELECT },
    });
    if (!crawl) {
      return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    }
    // The rows are in the archive: 409 ARCHIVED, never a query (data-state.ts).
    const archived = archivedGuard(crawl);
    if (archived) return archived;

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

    // Phase 4b custom search: every HTML page stores a count per search (0 included).
    const searches = readStoredConfig(crawl.config)?.searches ?? [];
    const segment = segmentScope(url, crawl.config);
    const searchParam = url.searchParams.get("search");
    const hitParam = url.searchParams.get("hit");
    const searchIndex = searchParam === null ? null : Number(searchParam);
    if (searchIndex !== null && !(Number.isInteger(searchIndex) && searchIndex >= 0 && searchIndex < searches.length)) {
      return NextResponse.json({ error: "Unknown search", code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (searchIndex !== null && hitParam !== "true" && hitParam !== "false") {
      return NextResponse.json({ error: "hit must be true or false", code: "INVALID_REQUEST" }, { status: 400 });
    }
    const searchFilter =
      searchIndex === null
        ? {}
        : { searchHits: hitParam === "true" ? { path: [String(searchIndex)], gt: 0 } : { path: [String(searchIndex)], equals: 0 } };

    // Phase 4c: the Structure tab filters Pages to a directory or one URL.
    const urlPrefix = url.searchParams.get("urlPrefix");
    if (urlPrefix !== null && (urlPrefix === "" || urlPrefix.length > 2048)) {
      return NextResponse.json({ error: "urlPrefix must be 1–2048 characters", code: "INVALID_REQUEST" }, { status: 400 });
    }

    // Issues view: pages with a finding of one rule ("See all pages").
    const ruleParam = url.searchParams.get("rule");
    if (ruleParam !== null && !RULE_BY_ID.has(ruleParam)) {
      return NextResponse.json({ error: "Unknown rule", code: "INVALID_REQUEST" }, { status: 400 });
    }

    // Pages view: search and scope.
    const q = (url.searchParams.get("q") ?? "").trim();
    if (q.length > 200) {
      return NextResponse.json({ error: "q must be at most 200 characters", code: "INVALID_REQUEST" }, { status: 400 });
    }
    const scopeParam = url.searchParams.get("scope");
    const scope: PageScope | null = scopeParam && scopeParam !== "all" ? (scopeParam as PageScope) : null;
    if (scope !== null && !PAGE_SCOPES.includes(scope)) {
      return NextResponse.json({ error: "Unknown scope", code: "INVALID_REQUEST" }, { status: 400 });
    }

    const statusParam = url.searchParams.get("status");
    const statusClass: StatusClass | null = statusParam ? (statusParam as StatusClass) : null;
    if (statusClass !== null && !STATUS_CLASSES.includes(statusClass)) {
      return NextResponse.json({ error: "Unknown status class", code: "INVALID_REQUEST" }, { status: 400 });
    }

    // Phase 4d: sort by a joined metric.
    const sort = url.searchParams.get("sort");
    const dir = url.searchParams.get("dir") ?? "desc";
    // Phase 4g: or by Link Score; Pages view: or by status, issues, score, inlinks.
    const native: NativeColumn | null =
      sort !== null && sort in NATIVE_SORTS && (sort !== "linkScore" || flag("crawl.linkScore")) ? NATIVE_SORTS[sort as NativeSort] : null;
    if (sort !== null && !METRIC_SORT_KEYS.has(sort) && native === null) {
      return NextResponse.json({ error: "Unknown sort", code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (dir !== "asc" && dir !== "desc") {
      return NextResponse.json({ error: "dir must be asc or desc", code: "INVALID_REQUEST" }, { status: 400 });
    }

    const inlinkRange = {
      ...(minInlinks.value !== undefined ? { gte: minInlinks.value } : {}),
      ...(maxInlinks.value !== undefined ? { lte: maxInlinks.value } : {}),
    };

    const where: Prisma.CrawlPageWhereInput = {
      crawlJobId: crawl.id,
      ...(inSitemapParam !== null ? { inSitemap: inSitemapParam === "true" } : {}),
      ...(depth.value !== undefined ? { depth: depth.value } : {}),
      ...(Object.keys(inlinkRange).length > 0 ? { inlinkCount: inlinkRange } : {}),
      ...searchFilter,
      ...(urlPrefix !== null ? { url: { startsWith: urlPrefix } } : {}),
      ...(ruleParam !== null ? { issues: { some: ruleIssueOnPage(ruleParam) } } : {}),
      ...pageInSegment(segment),
      // Each carries its own OR, so they go under AND rather than spread.
      ...(q || scope || statusClass
        ? { AND: [...(q ? [pageSearchWhere(q)] : []), ...(scope ? [pageScopeWhere(scope)] : []), ...(statusClass ? [statusClassWhere(statusClass)] : [])] }
        : {}),
    };

    // CSV branches after validation and the tenant-scoped crawl lookup, so it
    // inherits the same requirePaidPlan, the same 404 and the same 400 on an
    // unparseable filter. A response format, not a second access surface.
    if (wantsCsv(url)) {
      // Every metric column of every source this crawl has data from; a crawl
      // with none exports exactly the columns it did before Phase 4d.
      const coverage = await metricCoverage(crawl.id);
      const sources = METRIC_SOURCES.filter((s) => coverage[s] > 0);
      const scored = flag("crawl.linkScore") && (await prisma.crawlPage.count({ where: { crawlJobId: crawl.id, linkScore: { not: null } }, take: 1 })) > 0;
      return csvStreamResponse<CrawlPageRow>({
        columns: withSegmentColumn([...pageColumns(searches.map((s) => s.name)), ...(scored ? [LINK_SCORE_COLUMN] : []), ...metricCsvColumns(sources)], segment.defs, (r) => r.segmentIds),
        filename: csvFilename("site-crawler-pages"),
        cursorOf: (row) => row.id,
        fetchPage: (cursor, take) =>
          prisma.crawlPage.findMany({
            // The same `where` the JSON path built, so the two formats cannot
            // disagree about which rows a filter selects.
            where: { ...where, ...(cursor ? { id: { gt: cursor } } : {}) },
            orderBy: { id: "asc" },
            take,
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
              inlinkCount: true,
              inSitemap: true,
              canonical: true,
              redirectTarget: true,
              contentType: true,
              foundOn: true,
              pageScore: true,
              issueTotal: true,
              issueHigh: true,
              searchHits: true,
              segmentIds: true,
              metrics: { select: { source: true, data: true } },
            },
          }),
      });
    }

    // Paging. `cursor` (Pages view): a keyset after that row for the default
    // and native orders, an offset ("o:N") for a metric sort. `page` otherwise.
    const cursorParam = url.searchParams.get("cursor");
    const offsetCursor = cursorParam?.startsWith("o:") ? Math.max(0, Number.parseInt(cursorParam.slice(2), 10) || 0) : null;
    const after =
      cursorParam && offsetCursor === null
        ? await prisma.crawlPage.findFirst({
            where: { id: cursorParam, crawlJobId: crawl.id },
            select: { id: true, depth: true, url: true, statusCode: true, issueTotal: true, pageScore: true, inlinkCount: true, linkScore: true },
          })
        : null;
    const usingCursor = cursorParam !== null;
    const skip = usingCursor ? (offsetCursor ?? 0) : (page - 1) * pageSize;
    // One more than a page: whether there is a next one.
    const take = pageSize + 1;

    let keyset: Prisma.CrawlPageWhereInput = {};
    if (after && native) {
      const v = after[native];
      keyset =
        v === null
          ? { [native]: null, id: { gt: after.id } }
          : { OR: [{ [native]: dir === "desc" ? { lt: v } : { gt: v } }, { [native]: v, id: { gt: after.id } }, { [native]: null }] };
    } else if (after && sort === null) {
      keyset = {
        OR: [{ depth: { gt: after.depth } }, { depth: after.depth, url: { gt: after.url } }, { depth: after.depth, url: after.url, id: { gt: after.id } }],
      };
    }

    const ids =
      sort === null || native !== null
        ? null
        : await pageIdsByMetric(
            {
              jobId: crawl.id,
              ...(inSitemapParam !== null ? { inSitemap: inSitemapParam === "true" } : {}),
              ...(depth.value !== undefined ? { depth: depth.value } : {}),
              ...(minInlinks.value !== undefined ? { minInlinks: minInlinks.value } : {}),
              ...(maxInlinks.value !== undefined ? { maxInlinks: maxInlinks.value } : {}),
              ...(searchIndex !== null ? { search: { index: searchIndex, hit: hitParam === "true" } } : {}),
              ...(urlPrefix !== null ? { urlPrefix } : {}),
              ...(ruleParam !== null ? { rule: ruleParam } : {}),
              ...(q ? { q } : {}),
              ...(scope ? { scope } : {}),
              ...(statusClass ? { status: statusClass } : {}),
              segment: segment.index,
            },
            sort,
            dir,
            skip,
            take,
          );
    const orderBy: Prisma.CrawlPageOrderByWithRelationInput[] = native
      ? [{ [native]: { sort: dir, nulls: "last" } }, { id: "asc" }]
      : [{ depth: "asc" }, { url: "asc" }, { id: "asc" }];
    const [total, fetched] = await Promise.all([
      prisma.crawlPage.count({ where }),
      prisma.crawlPage.findMany({
        where: ids !== null ? { id: { in: ids } } : after ? { AND: [where, keyset] } : where,
        orderBy,
        // A keyset cursor starts after its row; an offset or `page` skips.
        ...(ids === null ? { skip: after ? 0 : skip, take } : {}),
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
          foundOn: true,
          searchHits: true,
          metrics: { select: { source: true, data: true } },
          linkScore: true,
          pageScore: true,
          issueTotal: true,
          issueHigh: true,
          _count: { select: { issues: true } },
        },
      }),
    ]);
    const ordered = ids === null ? fetched : ids.flatMap((id) => fetched.filter((r) => r.id === id));
    const more = ordered.length > pageSize;
    const rows = ordered.slice(0, pageSize);
    const last = rows[rows.length - 1];
    // Metric sorts page by offset; the default and native orders by keyset on the last row.
    const nextCursor = !more || !last ? null : ids !== null ? `o:${skip + pageSize}` : last.id;

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
        foundOn: r.foundOn,
        searchHits: (r.searchHits as Record<string, number> | null) ?? null,
        issueCount: r._count.issues,
        linkScore: r.linkScore,
        pageScore: r.pageScore,
        issueTotal: r.issueTotal,
        issueHigh: r.issueHigh,
        metrics: Object.fromEntries((r.metrics ?? []).map((m) => [m.source, m.data])),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      nextCursor,
    });
  } catch (err) {
    return crawlRouteError(err);
  }
}
