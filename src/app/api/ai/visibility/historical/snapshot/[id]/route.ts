/**
 * GET /api/ai/visibility/historical/snapshot/[id] — one snapshot's markdown.
 *
 * The ONLY way a snapshot body reaches a client. Spaces objects are private and
 * no bucket URL is ever handed to the browser, so this route re-checks tenant
 * ownership on every read (findFirst on { id, tenantId }, never findUnique by
 * id alone) and streams the gunzipped markdown back itself.
 *
 * Also serves the diff pair: ?against=<otherId> returns both bodies plus the
 * computed word diff, so the side-by-side view is one request rather than three.
 *
 * AUTHENTICATED — do not add /api/ai/visibility/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { readSnapshotMarkdown } from "@/lib/historical/snapshots";
import { wordDiff } from "@/lib/historical/diff";
import { historicalRouteError } from "@/lib/historical/http";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requirePaidPlan();
    const { id } = await params;

    const markdown = await readSnapshotMarkdown(tenant.tenantId, id);
    if (markdown === null) {
      // Same response for "does not exist" and "belongs to another tenant" —
      // a distinguishable 403 would confirm the id is real.
      return NextResponse.json({ error: "Snapshot not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const against = new URL(request.url).searchParams.get("against");
    if (!against) return NextResponse.json({ id, markdown });

    const other = await readSnapshotMarkdown(tenant.tenantId, against);
    if (other === null) {
      return NextResponse.json({ error: "Snapshot not found", code: "NOT_FOUND" }, { status: 404 });
    }

    // `against` is the OLDER side by convention: the caller passes the earlier
    // snapshot, so additions read as "what this page gained since then".
    const diff = wordDiff(other, markdown);
    return NextResponse.json({
      id,
      againstId: against,
      markdown,
      againstMarkdown: other,
      diff,
    });
  } catch (err) {
    return historicalRouteError(err);
  }
}
