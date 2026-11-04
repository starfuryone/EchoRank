/**
 * GET /api/public/v1/crawl/{id}/export?view=issues|pages|broken-links|external|redirects&segment=
 * — one crawl as CSV (Phase 3d-A), streamed by the dashboard's own export
 * handlers run as the key's tenant: the same columns, the same formula
 * guard and row cap as the dashboard's downloads.
 *
 * Auth: the public API key. Tenant-scoped: another workspace's id is a 404.
 */

import { NextResponse } from "next/server";
import { authenticatePublicRequest } from "@/lib/api-keys";
import { runAsApiTenant } from "@/lib/api-tenant-context";
import { GET as dashboardExport } from "@/app/api/seo/v1/crawl/[id]/export/route";
import { GET as dashboardExternal } from "@/app/api/seo/v1/crawl/[id]/external/route";
import { GET as dashboardPages } from "@/app/api/seo/v1/crawl/[id]/pages/route";

const EXPORT_VIEWS = ["issues", "pages", "broken-links", "external", "redirects"] as const;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatePublicRequest(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const q = new URL(request.url).searchParams;
  const view = q.get("view") ?? "issues";
  if (!(EXPORT_VIEWS as readonly string[]).includes(view)) return NextResponse.json({ error: "unknown_view" }, { status: 400 });
  const forward = new URLSearchParams();
  const segment = q.get("segment");
  if (segment !== null) forward.set("segment", segment);
  const base = `https://internal.invalid/api/seo/v1/crawl/${encodeURIComponent(id)}`;
  const ctx = { params: Promise.resolve({ id }) };
  const res = await runAsApiTenant(auth, () => {
    if (view === "pages") return dashboardPages(new Request(`${base}/pages?${forward}&format=csv`), ctx);
    if (view === "external") return dashboardExternal(new Request(`${base}/external?${forward}&format=csv`), ctx);
    if (view !== "issues") forward.set("view", view);
    return dashboardExport(new Request(`${base}/export?${forward}`), ctx);
  });
  if (res.status === 404) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return res;
}
