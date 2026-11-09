// GET /api/admin/purchase-archive/health — staff only (PLATFORM_ADMIN_EMAILS).
// The purchase archive's health (ECHORANK-DATA-ARCHIVE.md Phase 3): last
// write, spool depth, objects and bytes this month, and the estimated Spaces
// cost. Counts only: no key, no tenant, no payload. The proxy 403s everyone
// else at /api/admin/*; this handler checks again because the internal-secret
// bypass skips the proxy.

import { NextResponse } from "next/server";
import { requirePlatformAdminApi } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requirePlatformAdminApi();
  if (admin instanceof NextResponse) return admin;
  try {
    const { archiveHealth } = await import("@/lib/purchase-archive/health");
    return NextResponse.json(await archiveHealth(), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[purchase-archive] health failed:", err instanceof Error ? err.name : typeof err);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
