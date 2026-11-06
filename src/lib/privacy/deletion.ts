import "server-only";

// src/lib/privacy/deletion.ts — "delete my data", with a 14-day grace period.
//
// A signed-in user asks from /settings/account. The request waits GRACE_DAYS
// (cancellable until then, the account keeps working), then the nightly sweep
// (visibility-monitoring queue, dataDeletionSweep) carries it out:
//
//   WORKSPACE scope — the requester OWNS the workspace:
//     - the Stripe subscription is cancelled (the Stripe customer, invoices and
//       payments stay at Stripe: accounting records, see KEPT below);
//     - every table that carries tenantId WITHOUT a foreign key to Tenant is
//       emptied for it (read from the Prisma schema, so a new table is covered
//       the day it is added), page-snapshot objects in Spaces deleted first;
//     - stored Stripe webhook payloads for it are blanked (the idempotency row stays);
//     - the Tenant row is deleted, which cascades to everything with a FK;
//     - then the requester as in USER scope.
//   USER scope — a member, or the owner after the workspace:
//     - every table with userId and no FK to User, Matrix accounts, invite
//       tokens for the email, the login rate-limit key in Redis;
//     - the User row (cascading to accounts, sessions, memberships, tokens).
//   Redis: every key that contains the tenant id is removed (SCAN, never KEYS).
//
// The request row is the log: on completion userId and tenantId are cleared;
// subjectHash, per-table counts and timestamps remain. No names, no emails.
//
// KEPT (not deleted here), and why — see the retention proposal:
//   ConsentEvent       proof of what the customer accepted at checkout (legal
//                      claims; Limitation Act 1980, 6 years).
//   Stripe records     customer, invoices, payments, refunds live at Stripe and
//                      are the accounting records HMRC requires for 6 years
//                      after the end of the accounting period.
//   AuditLog rows of OTHER workspaces that mention the user (e.g. a team
//                      invite by email): not touched by a user-scope deletion.

import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe/client";
import { sendMail } from "@/lib/mailer";
import { getRedisConnection } from "@/infrastructure/redis/connection";
import { deleteSnapshotObject, isSpacesConfigured } from "@/lib/historical/spaces";
import { logger } from "@/infrastructure/observability/logger";

const log = logger.child({ module: "data-deletion" });

export const GRACE_DAYS = 14;
const DAY_MS = 86_400_000;

/** Models never emptied by a deletion (see KEPT above). */
export const KEPT_MODELS = new Set(["ConsentEvent", "DataDeletionRequest", "PrivacyComplaint"]);

export const subjectHash = (userId: string) => createHash("sha256").update(`er-subject:${userId}`).digest("hex");

type Model = (typeof Prisma.dmmf.datamodel.models)[number];
const delegateOf = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

/** Models with a scalar `field` and no relation to `target` through it: the ones a cascade cannot reach. */
export function modelsWithoutFk(field: "tenantId" | "userId", target: "Tenant" | "User", models: readonly Model[] = Prisma.dmmf.datamodel.models): string[] {
  return models
    .filter((m) => m.fields.some((f) => f.name === field && f.kind === "scalar"))
    // The runtime DMMF (Prisma 7) carries relationName but not relationFromFields,
    // so a relation field to the target IS the foreign key when the build does not
    // say otherwise. No model here relates to Tenant/User through another column.
    .filter(
      (m) =>
        !m.fields.some(
          (f) =>
            f.kind === "object" &&
            f.type === target &&
            (f.relationFromFields === undefined || f.relationFromFields.includes(field)),
        ),
    )
    .map((m) => m.name)
    .filter((n) => !KEPT_MODELS.has(n));
}

type Delegate = { deleteMany: (args: { where: Record<string, unknown> }) => Promise<{ count: number }> };
const delegate = (name: string) => (prisma as unknown as Record<string, Delegate>)[delegateOf(name)];

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function pendingDeletion(userId: string) {
  return prisma.dataDeletionRequest.findFirst({ where: { userId, status: "PENDING" }, orderBy: { requestedAt: "desc" } });
}

/** Records the request (idempotent: an existing pending request is returned). Scope from the user's role in `tenantId`. */
export async function requestDeletion(userId: string, tenantId: string | null, now = new Date()) {
  const existing = await pendingDeletion(userId);
  if (existing) return existing;
  const membership = tenantId
    ? await prisma.tenantMember.findFirst({ where: { userId, tenantId }, select: { role: true } })
    : null;
  const scope = membership?.role === "OWNER" ? "WORKSPACE" : "USER";
  const row = await prisma.dataDeletionRequest.create({
    data: {
      userId,
      tenantId: scope === "WORKSPACE" ? tenantId : null,
      subjectHash: subjectHash(userId),
      scope,
      runAfter: new Date(now.getTime() + GRACE_DAYS * DAY_MS),
    },
  });
  await notify(userId, "requested", row.runAfter).catch((err) => log.warn({ err, id: row.id }, "deletion request email failed"));
  log.info({ id: row.id, scope, runAfter: row.runAfter }, "data deletion requested");
  return row;
}

export async function cancelDeletion(userId: string, now = new Date()) {
  const row = await pendingDeletion(userId);
  if (!row) return null;
  const done = await prisma.dataDeletionRequest.update({ where: { id: row.id }, data: { status: "CANCELLED", cancelledAt: now } });
  log.info({ id: row.id }, "data deletion cancelled");
  return done;
}

// ---------------------------------------------------------------------------
// The sweep
// ---------------------------------------------------------------------------

/** Runs every request whose grace period is over. Throws at the end if any failed, so the queue's failure alert fires. */
export async function runDueDeletions(now = new Date()): Promise<{ completed: number; failed: number }> {
  const due = await prisma.dataDeletionRequest.findMany({
    where: { status: "PENDING", runAfter: { lte: now } },
    orderBy: { runAfter: "asc" },
    take: 50,
  });
  let completed = 0;
  let failed = 0;
  for (const req of due) {
    try {
      const summary: Record<string, number> = {};
      if (req.scope === "WORKSPACE" && req.tenantId) Object.assign(summary, await deleteWorkspace(req.tenantId));
      if (req.userId) Object.assign(summary, await deleteUser(req.userId));
      await prisma.dataDeletionRequest.update({
        where: { id: req.id },
        data: { status: "COMPLETED", completedAt: new Date(), userId: null, tenantId: null, summary, error: null },
      });
      completed++;
      log.info({ id: req.id, scope: req.scope, tables: Object.keys(summary).length }, "data deletion completed");
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message.slice(0, 300) : "unknown error";
      await prisma.dataDeletionRequest.update({ where: { id: req.id }, data: { status: "FAILED", error: message } }).catch(() => {});
      log.error({ err, id: req.id }, "data deletion failed — retry by setting status back to PENDING");
    }
  }
  if (failed) throw new Error(`${failed} data deletion request(s) failed`);
  return { completed, failed };
}

/** Everything of one workspace. Returns rows deleted per table (no values). */
export async function deleteWorkspace(tenantId: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, stripeSubscriptionId: true, stripeCustomerId: true },
  });
  if (!tenant) return out;

  if (tenant.stripeSubscriptionId) {
    try {
      await getStripe().subscriptions.cancel(tenant.stripeSubscriptionId);
      out["stripe.subscription.cancelled"] = 1;
    } catch (err) {
      // Already cancelled is the common case; anything else is logged and the deletion goes on.
      log.warn({ err, tenantId }, "could not cancel the Stripe subscription during deletion");
    }
  }

  // Page-snapshot objects first: their rows (no FK) hold the keys.
  if (isSpacesConfigured()) {
    const snaps = await prisma.pageSnapshot.findMany({ where: { tenantId }, select: { objectKey: true } });
    let n = 0;
    for (const key of new Set(snaps.map((s) => s.objectKey))) {
      await deleteSnapshotObject(key).then(() => n++, (err) => log.warn({ err }, "snapshot object delete failed"));
    }
    out["spaces.snapshots"] = n;
  }

  for (const model of modelsWithoutFk("tenantId", "Tenant")) {
    const r = await delegate(model).deleteMany({ where: { tenantId } });
    if (r.count) out[model] = r.count;
  }

  const blanked = await prisma.$executeRaw`
    UPDATE "processed_webhooks" SET "payload" = NULL
    WHERE "payload" IS NOT NULL
      AND ("payload"->>'client_reference_id' = ${tenantId}
           OR (${tenant.stripeCustomerId}::text IS NOT NULL AND "payload"->>'customer' = ${tenant.stripeCustomerId}))`;
  if (blanked) out["ProcessedWebhook.payload"] = blanked;

  await prisma.tenant.delete({ where: { id: tenantId } });
  out["Tenant"] = 1;
  out["redis.keys"] = await deleteRedisKeysContaining(tenantId);
  return out;
}

/** One user and what is theirs. */
export async function deleteUser(userId: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user) return out;
  await notify(userId, "completed").catch(() => {}); // before the address is gone

  for (const model of modelsWithoutFk("userId", "User")) {
    const r = await delegate(model).deleteMany({ where: { userId } });
    if (r.count) out[model] = r.count;
  }
  const mx = await prisma.matrixAccount.deleteMany({ where: { appUserId: userId } });
  if (mx.count) out["MatrixAccount"] = (out["MatrixAccount"] ?? 0) + mx.count;
  if (user.email) {
    const vt = await prisma.verificationToken.deleteMany({ where: { identifier: user.email } });
    if (vt.count) out["VerificationToken"] = vt.count;
    try {
      out["redis.keys"] = (out["redis.keys"] ?? 0) + (await getRedisConnection().del(`ratelimit:login-email:${user.email}`));
    } catch {
      /* 5-minute key; it expires on its own */
    }
  }
  await prisma.user.delete({ where: { id: userId } });
  out["User"] = 1;
  return out;
}

async function deleteRedisKeysContaining(fragment: string): Promise<number> {
  if (!/^[a-z0-9]{10,40}$/i.test(fragment)) return 0; // a cuid; never a pattern that could match everything
  try {
    const redis = getRedisConnection();
    let cursor = "0";
    let n = 0;
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", `*${fragment}*`, "COUNT", 500);
      cursor = next;
      if (keys.length) n += await redis.del(...keys);
    } while (cursor !== "0");
    return n;
  } catch (err) {
    log.warn({ err }, "redis cleanup during deletion failed");
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------

async function notify(userId: string, what: "requested" | "completed", runAfter?: Date) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (!user?.email) return;
  const subject = what === "requested" ? "Your Echorank data will be deleted" : "Your Echorank data has been deleted";
  const text =
    what === "requested"
      ? `Hello${user.name ? " " + user.name : ""},\n\nWe received your request to delete your Echorank data. It will be deleted on ${runAfter!.toISOString().slice(0, 10)} (14 days from your request). Until then you can cancel it in Settings → Account.\n\nIf you did not ask for this, cancel it there and change your password.\n\nEchorank`
      : `Hello${user.name ? " " + user.name : ""},\n\nYour Echorank account data has now been deleted, as you asked. Billing records held by our payment provider are kept as the law requires.\n\nEchorank`;
  await sendMail({ to: [user.email], subject, text, html: `<p style="font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>` });
}
