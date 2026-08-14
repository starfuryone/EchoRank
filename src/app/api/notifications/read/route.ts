/**
 * POST /api/notifications/read — mark one notification read, or all of them.
 *
 * Body: { id: "<cuid>" } | { all: true }
 *
 * Read state is PER USER. This writes a NotificationRead row and never touches
 * the notification itself, so one teammate clearing their tray leaves everyone
 * else's untouched. Do not "optimise" this into a flag on the notification —
 * that is the EscalationAlert.acknowledged bug, and it is why this table exists.
 *
 * Guard chain: requireTenant → nothing else. All tiers, no plan gate.
 *
 * AUTHENTICATED — do not add /api/notifications/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import {
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
} from "@/lib/notifications/store";

export async function POST(request: Request) {
  try {
    const membership = await requireTenant();
    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown;
      all?: unknown;
    };

    if (body.all === true) {
      const marked = await markAllNotificationsRead(membership.tenantId, membership.userId);
      return NextResponse.json({ marked, unreadCount: 0 });
    }

    if (typeof body.id !== "string" || body.id.length === 0) {
      return NextResponse.json(
        { error: "id or all is required", code: "BAD_REQUEST" },
        { status: 400 },
      );
    }

    // markNotificationRead re-finds the row by (id, tenantId). A 404 here is a
    // notification belonging to another tenant just as much as one that does
    // not exist, and the response deliberately cannot tell the two apart.
    const ok = await markNotificationRead(
      membership.tenantId,
      membership.userId,
      body.id,
    );
    if (!ok) {
      return NextResponse.json(
        { error: "Notification not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const unreadCount = await unreadNotificationCount(
      membership.tenantId,
      membership.userId,
    );
    return NextResponse.json({ marked: 1, unreadCount });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Not authenticated")) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("[notifications] mark read failed:", err instanceof Error ? err.name : typeof err);
    return NextResponse.json(
      { error: "Could not update notifications.", code: "MARK_READ_FAILED" },
      { status: 500 },
    );
  }
}
