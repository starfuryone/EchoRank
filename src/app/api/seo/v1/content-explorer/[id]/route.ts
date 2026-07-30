/**
 * GET /api/seo/v1/content-explorer/[id] — one stored search, for the history
 * list's "View" action. Costs nothing: this only ever reads the row.
 *
 * Free reopening is a product decision, not just an optimization. At ~5 cents a
 * search with a fixed floor, a tenant who has to pay again to look at something
 * they already ran would learn to screenshot results instead of using the tool.
 *
 * Tenant-scoped by construction: getSearchById filters on BOTH id and the
 * caller's tenantId, so another workspace's search id is a 404, never a leak.
 *
 * AUTHENTICATED — do not add /api/seo/v1/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { getSearchById } from "@/lib/content-explorer/service";
import { contentRouteError } from "@/lib/content-explorer/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;

    const search = await getSearchById(tenant.tenantId, id);
    if (!search) {
      return NextResponse.json(
        { error: "Search not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json({ search });
  } catch (err) {
    return contentRouteError(err);
  }
}
