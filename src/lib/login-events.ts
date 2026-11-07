// Login log: every sign-in attempt, kept 90 days.
//
// One row per attempt in login_events: time, user, IP, success or failure (and
// why). This is the record; the application log (pm2) no longer carries the
// email or IP, because pm2 logs rotate by size, not by age, and could not keep
// the 90-day promise.
//
// The nightly purge (visibility-monitoring queue, job "login-events-purge")
// deletes rows older than LOGIN_EVENT_RETENTION_DAYS. Deleting an account
// deletes its rows (FK cascade).
import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/infrastructure/observability/logger";

export const LOGIN_EVENT_RETENTION_DAYS = 90;

/** A short, stable hash: correlates repeated attempts on one address without storing it. */
export function loginEmailHash(email: string): string | null {
  const e = email.toLowerCase().trim();
  return e ? createHash("sha256").update(e).digest("hex").slice(0, 16) : null;
}

/** Never throws: a failed write must not turn into a failed sign-in. */
export async function recordLogin(e: {
  userId?: string | null;
  email: string;
  ip: string | null;
  success: boolean;
  reason?: string | null;
}): Promise<void> {
  try {
    await prisma.loginEvent.create({
      data: {
        userId: e.userId ?? null,
        emailHash: e.userId ? null : loginEmailHash(e.email),
        ip: e.ip && e.ip !== "unknown" ? e.ip : null,
        success: e.success,
        reason: e.success ? null : (e.reason ?? null),
      },
    });
  } catch (err) {
    logger.error({ err, operation: "auth.login-event" }, "login event not recorded");
  }
}

export async function purgeOldLoginEvents(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - LOGIN_EVENT_RETENTION_DAYS * 86_400_000);
  const { count } = await prisma.loginEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  logger.info({ count, cutoff: cutoff.toISOString() }, "login events purged");
  return count;
}
