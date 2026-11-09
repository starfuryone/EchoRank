/**
 * GET /api/seo/v1/crawl/[id]/pages/[pageId]/stored-copy?kind=raw|rendered —
 * "View stored copy" (ECHORANK-DATA-ARCHIVE.md Phase 4): a 302 to a
 * short-lived presigned download of the customer's own crawled page as the
 * crawl fetched it. Content-Disposition: attachment, on the bucket's host —
 * never rendered inline on our domain. Purchased provider data is never
 * offered here (src/lib/page-archive/stored-copy.ts).
 *
 * Tenant-scoped: the crawl by id AND the session's tenant, the page by id AND
 * that crawl; the key is built from those, never from input. A page of another
 * crawl or workspace, or one with no stored copy, is a 404.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { prisma } from "@/lib/prisma";
import { crawlRouteError } from "@/lib/site-crawler/http";
import { archiveStore } from "@/lib/spaces/client";
import { presignStoredCopy, storedCopyInfo, type StoredKind } from "@/lib/page-archive/stored-copy";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; pageId: string }> }) {
  try {
    const tenant = await requirePaidPlan();
    const { id, pageId } = await params;
    const kind: StoredKind = new URL(request.url).searchParams.get("kind") === "rendered" ? "rendered" : "raw";
    const notFound = () => NextResponse.json({ error: "No stored copy", code: "NOT_FOUND" }, { status: 404 });

    const crawl = await prisma.crawlJob.findFirst({ where: { id, tenantId: tenant.tenantId }, select: { id: true } });
    if (!crawl) return notFound();
    const page = await prisma.crawlPage.findFirst({ where: { id: pageId, crawlJobId: crawl.id }, select: { url: true } });
    if (!page) return notFound();

    const store = archiveStore();
    if (!store) return notFound();
    const info = await storedCopyInfo(store, tenant.tenantId, crawl.id, page.url);
    if (!info || !info[kind]) return notFound();
    const url = await presignStoredCopy(store, { tenantId: tenant.tenantId, crawlId: crawl.id, url: page.url, kind, date: info.fetchedAt.slice(0, 10) });
    if (!url) return notFound();
    return new Response(null, { status: 302, headers: { location: url, "cache-control": "no-store" } });
  } catch (err) {
    return crawlRouteError(err);
  }
}
