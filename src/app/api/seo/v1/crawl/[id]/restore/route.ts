/**
 * POST /api/seo/v1/crawl/[id]/restore — bring an archived crawl's pages,
 * findings and links back from the Spaces archive (CRAWL-ARCHIVE.md Phase 4).
 *
 * Same gating as viewing the crawl: requirePaidPlan, and the crawl looked up
 * by id AND the session's tenantId (another workspace's id is a 404). The
 * crawl goes ARCHIVED → RESTORING here (a conditional update, so two clicks
 * are one restore) and the crawl-archive queue does the work; the UI polls
 * GET /api/seo/v1/crawl/[id] until storageState is HOT again (or back to
 * ARCHIVED: the restore failed, the archive is untouched).
 *
 *   202 { storageState: "RESTORING" }   accepted (or already restoring)
 *   200 { storageState: "HOT" }         nothing to restore
 *   409 PURGED                          retention deleted it: nothing to restore
 *   409 ARCHIVING                       it is being archived right now; try later
 *   503 ARCHIVE_UNAVAILABLE             Spaces not configured on this server
 *
 * A restore is not a crawl: it creates no crawl_jobs row and never touches
 * the monthly crawl quota.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { spacesConfigured } from "@/lib/spaces/client";
import { enqueueRestore } from "@/lib/site-crawler/archive/queue";
import { logger } from "@/infrastructure/observability/logger";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;
    const crawl = await prisma.crawlJob.findFirst({
      where: { id, tenantId: tenant.tenantId },
      select: { id: true, storageState: true, dataPurgedAt: true },
    });
    if (!crawl) return NextResponse.json({ error: "Crawl not found", code: "NOT_FOUND" }, { status: 404 });
    if (crawl.dataPurgedAt) {
      return NextResponse.json({ error: "This crawl's pages were deleted by retention; there is nothing to restore.", code: "PURGED" }, { status: 409 });
    }
    if (crawl.storageState === "HOT") return NextResponse.json({ storageState: "HOT" });
    if (crawl.storageState === "RESTORING") return NextResponse.json({ storageState: "RESTORING" }, { status: 202 });
    if (crawl.storageState === "ARCHIVING") {
      return NextResponse.json({ error: "This crawl is being archived right now. Try again in a few minutes.", code: "ARCHIVING" }, { status: 409 });
    }
    if (!spacesConfigured()) {
      return NextResponse.json({ error: "The crawl archive is not available right now.", code: "ARCHIVE_UNAVAILABLE" }, { status: 503 });
    }

    const claimed = await prisma.crawlJob.updateMany({
      where: { id: crawl.id, tenantId: tenant.tenantId, storageState: "ARCHIVED", dataPurgedAt: null },
      data: { storageState: "RESTORING" },
    });
    if (claimed.count === 1) {
      try {
        await enqueueRestore(crawl.id);
      } catch (err) {
        await prisma.crawlJob.update({ where: { id: crawl.id }, data: { storageState: "ARCHIVED" } });
        logger.error({ err, crawlId: crawl.id }, "crawl restore: enqueue failed");
        return NextResponse.json({ error: "The restore could not be queued. Try again.", code: "ARCHIVE_UNAVAILABLE" }, { status: 503 });
      }
    }
    return NextResponse.json({ storageState: "RESTORING" }, { status: 202 });
  } catch (err) {
    return crawlRouteError(err);
  }
}
