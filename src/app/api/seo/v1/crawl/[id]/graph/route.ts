/**
 * GET /api/seo/v1/crawl/[id]/graph?kind=directory|crawl-tree|links&limit=2000
 *
 * The Structure tab's data (Phase 4a; drawn in 4c): a directory tree, the
 * BFS crawl tree, or the internal-link graph among the most-linked pages.
 * At most 2,000 nodes (and 20,000 edges). Refused once retention has deleted
 * the crawl's pages.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { GRAPH_KINDS, GRAPH_MAX_NODES, crawlGraph } from "@/lib/site-crawler/graph";
import { crawlRouteError } from "@/lib/site-crawler/http";

const QuerySchema = z.object({
  kind: z.enum(GRAPH_KINDS),
  limit: z.coerce.number().int().min(1).max(GRAPH_MAX_NODES).default(GRAPH_MAX_NODES),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;
    const sp = new URL(request.url).searchParams;
    const parsed = QuerySchema.safeParse({ kind: sp.get("kind"), limit: sp.get("limit") ?? undefined });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query", code: "INVALID_REQUEST", issues: parsed.error.issues }, { status: 400 });
    }
    const crawl = await prisma.crawlJob.findFirst({
      where: { id, tenantId: tenant.tenantId },
      select: { id: true, dataPurgedAt: true },
    });
    if (!crawl) return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    if (crawl.dataPurgedAt) {
      return NextResponse.json({ error: "This crawl's pages were deleted by retention.", code: "PURGED" }, { status: 409 });
    }
    return NextResponse.json(await crawlGraph(crawl.id, parsed.data.kind, parsed.data.limit));
  } catch (err) {
    return crawlRouteError(err);
  }
}
