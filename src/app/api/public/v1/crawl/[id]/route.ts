/**
 * GET /api/public/v1/crawl/{id} — one crawl (Phase 3d-A): status, progress
 * (pages crawled / cap, rendered / render cap, phase), the queue position
 * while queued, and once it has settled the summary, site health, findings
 * by kind and by rule family, and pages and findings per segment
 * (src/lib/site-crawler/public-api.ts).
 *
 * Auth: the public API key. Tenant-scoped: another workspace's id is a 404.
 */

import { NextResponse } from "next/server";
import { authenticatePublicRequest } from "@/lib/api-keys";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { findPublicCrawl, publicCrawlDetail, queueEstimate } from "@/lib/site-crawler/public-api";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatePublicRequest(request);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const row = await findPublicCrawl(auth.tenantId, id);
    if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const [detail, queue] = await Promise.all([publicCrawlDetail(row), queueEstimate(row)]);
    return NextResponse.json({ ...detail, ...queue });
  } catch (err) {
    return crawlRouteError(err);
  }
}
