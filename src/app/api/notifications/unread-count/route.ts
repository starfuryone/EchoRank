/**
 * GET /api/notifications/unread-count — the number behind the header bell.
 *
 * Its own endpoint because the badge lives in the dashboard chrome on every
 * page and must not pull a page of rows it will not render.
 *
 * Guard chain: requireTenant → nothing else. All tiers, no plan gate.
 *
 * AUTHENTICATED — do not add /api/notifications/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import { unreadNotificationCount } from "@/lib/notifications/store";

export async function GET() {
  try {
    const membership = await requireTenant();
    const unreadCount = await unreadNotificationCount(
      membership.tenantId,
      membership.userId,
    );
    return NextResponse.json({ unreadCount });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Not authenticated")) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    // The badge is chrome on every dashboard page: a failure here returns zero
    // rather than an error the shell would have to render around.
    console.error("[notifications] count failed:", err instanceof Error ? err.name : typeof err);
    return NextResponse.json({ unreadCount: 0 });
  }
}
