/**
 * POST /api/seo/v1/crawl/[id]/cancel — stop a crawl.
 *
 * Cooperative for a RUNNING crawl: this sets a Redis flag the worker checks
 * once per batch, so the crawl stops within a batch rather than instantly.
 * A QUEUED crawl is marked CANCELLED directly, since no worker is watching.
 *
 * Idempotent: cancelling an already-finished crawl is a 200, not an error —
 * the caller wanted it stopped and it is stopped.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { cancelCrawl, toCrawlDto } from "@/lib/site-crawler/service";
import { crawlRouteError } from "@/lib/site-crawler/http";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;

    const found = await cancelCrawl(tenant.tenantId, id);
    if (!found) {
      return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const row = await prisma.crawlJob.findFirst({
      where: { id, tenantId: tenant.tenantId },
    });
    if (!row) {
      return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json(toCrawlDto(row));
  } catch (err) {
    return crawlRouteError(err);
  }
}
