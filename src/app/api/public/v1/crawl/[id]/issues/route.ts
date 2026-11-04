/**
 * GET /api/public/v1/crawl/{id}/issues?ruleId=&family=&kind=&segment=&cursor=&limit=
 * — one crawl's findings (Phase 3d-A), cursor-paged on the finding id, at
 * most 200 a page (default 100): rule, family, kind, priority, the page's
 * URL, status and "found on", and the finding's evidence — the fields the
 * dashboard's per-rule list shows. → { issues, nextCursor }
 *
 * Auth: the public API key. Tenant-scoped: another workspace's id is a 404.
 */

import { NextResponse } from "next/server";
import { authenticatePublicRequest } from "@/lib/api-keys";
import { prisma } from "@/lib/prisma";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { PublicApiInputError, publicIssues } from "@/lib/site-crawler/public-api";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatePublicRequest(request);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const crawl = await prisma.crawlJob.findFirst({ where: { id, tenantId: auth.tenantId }, select: { id: true, config: true } });
    if (!crawl) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const q = new URL(request.url).searchParams;
    const limit = q.get("limit");
    return NextResponse.json(
      await publicIssues(crawl, {
        ruleId: q.get("ruleId"),
        family: q.get("family"),
        kind: q.get("kind"),
        segment: q.get("segment"),
        cursor: q.get("cursor"),
        limit: limit === null ? null : Number.parseInt(limit, 10),
      }),
    );
  } catch (err) {
    if (err instanceof PublicApiInputError) return NextResponse.json({ error: err.code }, { status: 400 });
    return crawlRouteError(err);
  }
}
