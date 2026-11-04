/**
 * POST /api/public/v1/crawl/{id}/cancel — stop a queued or running crawl
 * (Phase 3d-A); a crawl that already ended is left as it is. Answers with
 * the crawl as GET /crawl/{id} describes it (no summary). A crawl with a
 * callbackUrl still gets its callback, with status "cancelled".
 *
 * Auth: the public API key. Tenant-scoped: another workspace's id is a 404.
 */

import { NextResponse } from "next/server";
import { authenticatePublicRequest } from "@/lib/api-keys";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { findPublicCrawl, toPublicCrawl } from "@/lib/site-crawler/public-api";
import { cancelCrawl } from "@/lib/site-crawler/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatePublicRequest(request);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    if (!(await cancelCrawl(auth.tenantId, id))) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const row = await findPublicCrawl(auth.tenantId, id);
    return row ? NextResponse.json(toPublicCrawl(row)) : NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch (err) {
    return crawlRouteError(err);
  }
}
