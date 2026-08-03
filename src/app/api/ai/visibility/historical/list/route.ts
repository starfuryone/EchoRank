/**
 * GET /api/ai/visibility/historical/list — snapshot index.
 *
 * With ?url= : that URL's snapshots, newest first.
 * Without   : one entry per URL the tenant has snapshots for.
 *
 * Metadata only — no Spaces object is read, so this stays fast and keeps
 * working while object storage is down.
 *
 * AUTHENTICATED — do not add /api/ai/visibility/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requirePaidPlan } from "@/lib/paid-plan";
import { listSnapshots, listSnapshotUrls } from "@/lib/historical/snapshots";
import { historicalRouteError } from "@/lib/historical/http";

export async function GET(request: Request) {
  try {
    const tenant = await requirePaidPlan();
    const url = new URL(request.url).searchParams.get("url");
    if (url) {
      return NextResponse.json({ url, snapshots: await listSnapshots(tenant.tenantId, url) });
    }
    return NextResponse.json({ urls: await listSnapshotUrls(tenant.tenantId) });
  } catch (err) {
    return historicalRouteError(err);
  }
}
