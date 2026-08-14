// Reads and writes for the in-app notification record.
//
// EVERY QUERY IN THIS FILE IS TENANT-SCOPED. The page, the badge and the
// mark-read endpoints all come through here, and none of them accepts a bare
// id: `markNotificationRead` re-finds the row by (id, tenantId) before it
// writes, so a guessed cuid from another tenant marks nothing. Same bar as the
// [id] API routes.

import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";
import {
  NOTIFICATION_HREF,
  type NotificationDto,
  type NotificationSeverity,
  type NotificationType,
  type PayloadFor,
} from "./types";

export interface RecordNotificationInput<T extends NotificationType> {
  tenantId: string;
  type: T;
  severity: NotificationSeverity;
  payload: PayloadFor<T>;
  /**
   * English fallback, shown only for a type the display catalog does not know.
   * Pass the emitting worker's own title — it is already written.
   */
  title: string;
  body?: string | null;
  /** Per source + subject + day. Two sweeps of the same event write one row. */
  dedupeKey: string;
  /** "<Model>:<id>" of the row this mirrors, when the source stores one. */
  sourceRef?: string | null;
  /** Null (the default) means every member of the tenant. */
  userId?: string | null;
  /** Overrides NOTIFICATION_HREF — for a type that can deep-link precisely. */
  href?: string;
}

/**
 * Write one notification. NEVER THROWS.
 *
 * This is called from inside alert emission paths — a Stripe-adjacent webhook,
 * a BullMQ worker mid-sweep, an event consumer. A notification is a convenience
 * record; the alert it mirrors has already been stored and emailed by the time
 * we get here. Failing loudly would turn "the notifications table is briefly
 * unreachable" into "the risk engine crashed", which is a strictly worse
 * outcome. Failures are logged and swallowed, exactly like the onboarding-drip
 * enqueue in the register route.
 *
 * Returns true when a row was written, false on duplicate or failure — for
 * tests and for callers that want to count.
 */
export async function recordNotification<T extends NotificationType>(
  input: RecordNotificationInput<T>,
): Promise<boolean> {
  try {
    const result = await prisma.notification.createMany({
      data: [
        {
          tenantId: input.tenantId,
          userId: input.userId ?? null,
          type: input.type,
          severity: input.severity,
          title: input.title,
          body: input.body ?? null,
          href: input.href ?? NOTIFICATION_HREF[input.type],
          payload: input.payload as object,
          sourceRef: input.sourceRef ?? null,
          dedupeKey: input.dedupeKey,
        },
      ],
      // The dedupeKey unique index is the idempotency guarantee; a retried
      // sweep must be a no-op, not a second row and not an exception.
      skipDuplicates: true,
    });
    return result.count > 0;
  } catch (err) {
    logger.error(
      {
        tenantId: input.tenantId,
        type: input.type,
        err: err instanceof Error ? err.message : String(err),
      },
      "Notification write failed - alert itself is unaffected",
    );
    return false;
  }
}

export interface ListNotificationsInput {
  tenantId: string;
  userId: string;
  type?: string;
  severity?: string;
  unreadOnly?: boolean;
  /** Id of the last row on the previous page. */
  cursor?: string;
  limit?: number;
}

export interface ListNotificationsResult {
  items: NotificationDto[];
  nextCursor: string | null;
}

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/**
 * A page of this tenant's notifications, newest first, each flagged read or
 * unread for THIS user.
 *
 * userId scoping is an OR, not an equality: every current source writes
 * tenant-wide rows (userId null) because none of them knows a user, and a row
 * addressed to someone else must not appear here.
 */
export async function listNotifications(
  input: ListNotificationsInput,
): Promise<ListNotificationsResult> {
  const take = Math.min(Math.max(input.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  const rows = await prisma.notification.findMany({
    where: {
      tenantId: input.tenantId,
      OR: [{ userId: null }, { userId: input.userId }],
      ...(input.type ? { type: input.type } : {}),
      ...(input.severity ? { severity: input.severity } : {}),
      ...(input.unreadOnly ? { reads: { none: { userId: input.userId } } } : {}),
    },
    // Two keys so the cursor is stable when several rows share a timestamp —
    // a sweep writes a batch inside the same millisecond.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      type: true,
      severity: true,
      title: true,
      body: true,
      href: true,
      payload: true,
      createdAt: true,
      reads: { where: { userId: input.userId }, select: { id: true }, take: 1 },
    },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;

  return {
    items: page.map((row) => ({
      id: row.id,
      type: row.type,
      severity: row.severity,
      title: row.title,
      body: row.body,
      href: row.href,
      payload: (row.payload as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt.toISOString(),
      read: row.reads.length > 0,
    })),
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}

/** Unread count for the header badge. Tenant-wide rows minus this user's reads. */
export async function unreadNotificationCount(
  tenantId: string,
  userId: string,
): Promise<number> {
  return prisma.notification.count({
    where: {
      tenantId,
      OR: [{ userId: null }, { userId }],
      reads: { none: { userId } },
    },
  });
}

/**
 * Mark one notification read for one user.
 *
 * Returns false when the id does not belong to this tenant — the caller turns
 * that into a 404. The findFirst on (id, tenantId) is the isolation bar: it is
 * why a cuid harvested from another tenant cannot be marked, and why this
 * cannot be collapsed into a bare upsert on notificationId.
 */
export async function markNotificationRead(
  tenantId: string,
  userId: string,
  notificationId: string,
): Promise<boolean> {
  const found = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      tenantId,
      OR: [{ userId: null }, { userId }],
    },
    select: { id: true },
  });
  if (!found) return false;

  await prisma.notificationRead.upsert({
    where: { notificationId_userId: { notificationId: found.id, userId } },
    create: { notificationId: found.id, userId },
    // Already read: keep the original readAt rather than moving it forward.
    update: {},
  });
  return true;
}

/**
 * Mark every currently-unread notification read for this user.
 *
 * Reads the unread ids first and inserts rows for them, rather than deleting or
 * stamping anything on the notifications themselves — marking all read is a
 * per-user act and must stay invisible to teammates.
 */
export async function markAllNotificationsRead(
  tenantId: string,
  userId: string,
): Promise<number> {
  const unread = await prisma.notification.findMany({
    where: {
      tenantId,
      OR: [{ userId: null }, { userId }],
      reads: { none: { userId } },
    },
    select: { id: true },
  });
  if (unread.length === 0) return 0;

  const result = await prisma.notificationRead.createMany({
    data: unread.map((n) => ({ notificationId: n.id, userId })),
    // A concurrent single mark-read on one of these is not an error.
    skipDuplicates: true,
  });
  return result.count;
}
