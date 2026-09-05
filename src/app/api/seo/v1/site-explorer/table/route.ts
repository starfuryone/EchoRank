// GET /api/seo/v1/site-explorer/table — filter, sort and page a STORED analysis.
//
// ── THIS ROUTE CANNOT SPEND, AND THAT IS ITS WHOLE POINT ───────────────────
// It reads one stored SiteExplorerAnalysis and slices it. There is no
// DataForSEO call here, no quota check and no metering, because there is
// nothing to meter: the rows were bought when the analysis ran, and the
// customer is entitled to look at all of them.
//
// It exists as a route rather than as client-side filtering because a stored
// analysis holds up to a thousand keyword rows and five hundred page rows.
// Shipping all of that to the browser to filter it there would be a megabyte
// of JSON per page load, and CSV export would then disagree with the table
// whenever the two implementations drifted. One filter implementation, on the
// server, used by both.
//
// AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { toAnalysisDto } from "@/lib/site-explorer/service";
import { siteExplorerRouteError } from "@/lib/site-explorer/http";
import {
  applyTable,
  filterKeywords,
  filterPages,
  isKeywordSortField,
  isPageSortField,
  normalizePageSize,
  type DomainKeywordFilters,
  type DomainPageFilters,
} from "@/lib/site-explorer/pagination";

const QuerySchema = z.object({
  id: z.string().trim().min(1),
  tab: z.enum(["keywords", "pages"]).default("keywords"),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().optional(),
  sort: z.string().trim().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  // Shared filter inputs. Absent means "no filter", never "filter on empty".
  q: z.string().trim().max(200).optional(),
  minVolume: z.coerce.number().int().min(0).optional(),
  maxVolume: z.coerce.number().int().min(0).optional(),
  minPosition: z.coerce.number().int().min(1).max(100).optional(),
  maxPosition: z.coerce.number().int().min(1).max(100).optional(),
  urlContains: z.string().trim().max(300).optional(),
  minKeywords: z.coerce.number().int().min(0).optional(),
  minTraffic: z.coerce.number().int().min(0).optional(),
});

export async function GET(req: Request) {
  try {
    const tenant = await requirePaidPlan();

    // `new URL(req.url)` rather than NextRequest.nextUrl: this handler takes
    // only query parameters, and the plain-Request form works identically in
    // the route and in a test that constructs a Request by hand.
    const parsed = QuerySchema.safeParse(
      Object.fromEntries(new URL(req.url).searchParams.entries()),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", code: "INVALID_REQUEST" },
        { status: 400 },
      );
    }
    const q = parsed.data;

    // findFirst with BOTH ids — never findUnique on the id alone. CLAUDE.md's
    // rule for any route taking an :id, and this row holds a competitor's whole
    // keyword profile.
    const row = await prisma.siteExplorerAnalysis.findFirst({
      where: { id: q.id, tenantId: tenant.tenantId },
    });
    if (!row) {
      return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const analysis = toAnalysisDto(row);
    const pageSize = normalizePageSize(q.pageSize);

    if (q.tab === "pages") {
      const filters: DomainPageFilters = {
        query: q.q,
        minKeywords: q.minKeywords,
        minTraffic: q.minTraffic,
      };
      const result = applyTable(analysis.pages?.items ?? [], {
        filter: (rows) => filterPages(rows, filters),
        sortField: isPageSortField(q.sort ?? "") ? (q.sort as "etv") : "etv",
        sortOrder: q.order,
        page: q.page,
        pageSize,
      });
      // `totalCount` is DataForSEO's figure for the whole domain and is far
      // larger than what was fetched. Returned beside `total` so the UI can say
      // "50 of 500 fetched, of 12,000 on the domain" rather than implying the
      // fetched set is everything.
      return NextResponse.json({ ...result, fetched: analysis.pages?.totalCount ?? 0 });
    }

    const filters: DomainKeywordFilters = {
      query: q.q,
      minVolume: q.minVolume,
      maxVolume: q.maxVolume,
      minPosition: q.minPosition,
      maxPosition: q.maxPosition,
      urlContains: q.urlContains,
    };
    const result = applyTable(analysis.rankedKeywords?.items ?? [], {
      filter: (rows) => filterKeywords(rows, filters),
      sortField: isKeywordSortField(q.sort ?? "") ? (q.sort as "etv") : "etv",
      sortOrder: q.order,
      page: q.page,
      pageSize,
    });
    return NextResponse.json({
      ...result,
      fetched: analysis.rankedKeywords?.totalCount ?? 0,
    });
  } catch (err) {
    return siteExplorerRouteError(err);
  }
}
