/**
 * GET /api/notifications — a page of this tenant's notifications.
 *
 * Guard chain: requireTenant → nothing else. ALL TIERS, NO PLAN GATE. The
 * durable record of an alert a tenant already received is not a feature to sell
 * back to them; a STARTER tenant gets escalation and visibility alerts today
 * and must be able to read them.
 *
 * Query: ?type=&severity=&unread=1&cursor=&limit=
 * Filters are validated against the known vocabularies rather than passed
 * through, so a crafted ?type= cannot probe the column.
 *
 * AUTHENTICATED — do not add /api/notifications/* to publicPaths in src/proxy.ts.
 */

import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/tenant";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  listNotifications,
  unreadNotificationCount,
} from "@/lib/notifications/store";
import { isNotificationSeverity, isNotificationType } from "@/lib/notifications/types";

export async function GET(request: Request) {
  try {
    const membership = await requireTenant();
    const url = new URL(request.url);

    const typeParam = url.searchParams.get("type");
    const severityParam = url.searchParams.get("severity");
    const limitParam = Number(url.searchParams.get("limit") ?? DEFAULT_PAGE_SIZE);

    const { items, nextCursor } = await listNotifications({
      tenantId: membership.tenantId,
      userId: membership.userId,
      type: typeParam && isNotificationType(typeParam) ? typeParam : undefined,
      severity:
        severityParam && isNotificationSeverity(severityParam) ? severityParam : undefined,
      unreadOnly: url.searchParams.get("unread") === "1",
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: Number.isFinite(limitParam)
        ? Math.min(Math.max(limitParam, 1), MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE,
    });

    // Returned alongside the page so the badge and the list can never disagree
    // after a mark-read — one round trip, one consistent view.
    const unreadCount = await unreadNotificationCount(
      membership.tenantId,
      membership.userId,
    );

    return NextResponse.json({ items, nextCursor, unreadCount });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Not authenticated")) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("[notifications] list failed:", err instanceof Error ? err.name : typeof err);
    return NextResponse.json(
      { error: "Could not load notifications.", code: "LIST_FAILED" },
      { status: 500 },
    );
  }
}
