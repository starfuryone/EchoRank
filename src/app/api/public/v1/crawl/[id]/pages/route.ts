/**
 * GET /api/public/v1/crawl/{id}/pages?cursor=&segment=&status=&limit= — one
 * crawl's pages (Phase 3d-A), cursor-paged, at most 200 a page (default
 * 100); status = 2xx | 3xx | 4xx | 5xx | none. The dashboard's Pages handler
 * answers, run as the key's tenant, so the rows are the dashboard's rows
 * (page score, findings, inlinks, link score, metrics).
 * → { pages, total, nextCursor, … }
 *
 * Auth: the public API key. Tenant-scoped: another workspace's id is a 404.
 */

import { publicArchived } from "@/lib/site-crawler/public-api-archived";
import { NextResponse } from "next/server";
import { authenticatePublicRequest } from "@/lib/api-keys";
import { runAsApiTenant } from "@/lib/api-tenant-context";
import { GET as dashboardPages } from "@/app/api/seo/v1/crawl/[id]/pages/route";

const PAGE_DEFAULT = 100;
const PAGE_MAX = 200;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatePublicRequest(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const q = new URL(request.url).searchParams;
  const limit = Math.max(1, Math.min(PAGE_MAX, Number.parseInt(q.get("limit") ?? "", 10) || PAGE_DEFAULT));
  const forward = new URLSearchParams({ pageSize: String(limit) });
  for (const k of ["cursor", "segment", "status"]) {
    const v = q.get(k);
    if (v !== null) forward.set(k, v);
  }
  const res = await runAsApiTenant(auth, () =>
    dashboardPages(new Request(`https://internal.invalid/api/seo/v1/crawl/${encodeURIComponent(id)}/pages?${forward}`), { params: Promise.resolve({ id }) }),
  );
  if (res.status === 404) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return publicArchived(res);
}
