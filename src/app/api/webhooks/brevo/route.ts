import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Prisma, MessageStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/infrastructure/observability/logger";
import { meteringService } from "@/infrastructure/metering/service";

const log = logger.child({ module: "brevo-webhook" });

// ─── Auth ──────────────────────────────────────────────────────────────────
// Brevo does NOT sign webhook payloads. The accepted hardening is (1) a secret
// only we and Brevo know, carried in the URL/header, and (2) optionally an IP
// allowlist. Configure the Brevo webhook URL as:
//   https://app.echorank.com/api/webhooks/brevo?token=<BREVO_WEBHOOK_SECRET>
// We compare in constant time to avoid leaking the secret via timing.
function tokenValid(request: NextRequest): boolean {
  const expected = process.env.BREVO_WEBHOOK_SECRET;
  if (!expected) {
    log.error("BREVO_WEBHOOK_SECRET is not configured");
    return false;
  }
  const provided =
    request.nextUrl.searchParams.get("token") ||
    request.headers.get("x-brevo-token") ||
    "";

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ─── Event normalization ─────────────────────────────────────────────────────
// Brevo email events: request, delivered, opened (unique_opened), click,
// hard_bounce, soft_bounce, blocked, spam, unsubscribed, deferred, error.
// Brevo SMS events: sent, delivered, hard_bounce, soft_bounce, etc.
// We map the ones that change a log's lifecycle; the rest are recorded for
// audit but don't mutate status.
type LifecyclePatch = Partial<{
  status: MessageStatus;
  deliveredAt: Date;
  openedAt: Date;
  clickedAt: Date;
  bouncedAt: Date;
  failedAt: Date;
  errorMessage: string;
}>;

function emailPatch(event: string, at: Date): LifecyclePatch | null {
  switch (event) {
    case "delivered":
      return { status: "DELIVERED", deliveredAt: at };
    case "opened":
    case "unique_opened":
      return { openedAt: at };
    case "click":
      return { clickedAt: at };
    case "hard_bounce":
    case "soft_bounce":
    case "blocked":
      return { status: "BOUNCED", bouncedAt: at };
    case "spam":
    case "error":
    case "invalid_email":
    case "deferred":
      return { status: "FAILED", failedAt: at };
    default:
      return null; // request/unsubscribed/etc: audit-only
  }
}

function smsPatch(event: string, at: Date): LifecyclePatch | null {
  switch (event) {
    case "delivered":
      return { status: "DELIVERED", deliveredAt: at };
    case "sent":
      return { status: "SENT" };
    case "hard_bounce":
    case "soft_bounce":
    case "blocked":
    case "error":
      return { status: "FAILED", failedAt: at };
    default:
      return null;
  }
}

// Brevo sends a single object per POST for transactional webhooks, but batched
// webhooks can send an array. Normalize to an array either way.
function asEvents(parsed: unknown): Record<string, unknown>[] {
  if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
  if (parsed && typeof parsed === "object")
    return [parsed as Record<string, unknown>];
  return [];
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

// X-Mailin-custom is echoed back as the `X-Mailin-custom` field (string we set
// at send time). Parse out our emailLogId/tenantId. Defensive: it may be absent
// (e.g. emails not sent by our worker) or non-JSON.
function parseMailinCustom(
  raw: unknown
): { emailLogId?: string; tenantId?: string } {
  const s = str(raw);
  if (!s) return {};
  try {
    const obj = JSON.parse(s);
    return {
      emailLogId: str(obj?.emailLogId) ?? undefined,
      tenantId: str(obj?.tenantId) ?? undefined,
    };
  } catch {
    return {};
  }
}

async function handleEmailEvent(
  e: Record<string, unknown>,
  occurredAt: Date
): Promise<{ tenantId: string | null; emailLogId: string | null }> {
  const event = (str(e["event"]) ?? "").toLowerCase();
  const messageId = str(e["message-id"]) ?? str(e["messageId"]);
  const recipient = str(e["email"]);
  const { emailLogId: customLogId, tenantId: customTenantId } =
    parseMailinCustom(e["X-Mailin-custom"] ?? e["mailin_custom"]);

  // An unsubscribe from any Brevo email suppresses the onboarding/marketing
  // drip for every tenant this address owns. Lifecycle patching below stays
  // audit-only for this event.
  if (event === "unsubscribed" && recipient) {
    await prisma.tenant.updateMany({
      where: {
        marketingConsent: true,
        members: { some: { role: "OWNER", user: { email: recipient.toLowerCase() } } },
      },
      data: { marketingConsent: false },
    });
  }

  // Resolve the target log: prefer the custom-token id (exact), then the
  // provider message id, then a recipient+recency fallback.
  let emailLog =
    (customLogId
      ? await prisma.emailLog.findUnique({ where: { id: customLogId } })
      : null) ??
    (messageId
      ? await prisma.emailLog.findFirst({
          where: { providerMessageId: messageId },
          orderBy: { createdAt: "desc" },
        })
      : null);

  if (!emailLog && recipient) {
    emailLog = await prisma.emailLog.findFirst({
      where: { to: recipient, channel: "EMAIL" },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!emailLog) {
    log.warn({ event, messageId, recipient }, "No EmailLog matched event");
    return { tenantId: customTenantId ?? null, emailLogId: null };
  }

  // Backfill the provider message id the first time we learn it.
  const patch = emailPatch(event, occurredAt) ?? {};
  const data: Prisma.EmailLogUpdateInput = { ...patch };
  if (messageId && !emailLog.providerMessageId) {
    data.providerMessageId = messageId;
  }

  if (Object.keys(data).length > 0) {
    await prisma.emailLog.update({ where: { id: emailLog.id }, data });
  }

  // A click on a review-request email is the conversion signal the dashboard
  // counts. Mirror it onto the ReviewRequest tied to this customer's feedback.
  if (event === "click") {
    await markReviewRequestClicked(emailLog.tenantId, emailLog.customerId, occurredAt);
  }

  return { tenantId: emailLog.tenantId, emailLogId: emailLog.id };
}

async function handleSmsEvent(
  e: Record<string, unknown>,
  occurredAt: Date
): Promise<{ tenantId: string | null; smsLogId: string | null }> {
  const event = (str(e["event"]) ?? "").toLowerCase();
  const messageId = str(e["message-id"]) ?? str(e["messageId"]);
  // Brevo SMS reports the recipient under `to` (E.164).
  const recipient = str(e["to"]) ?? str(e["recipient"]);

  let smsLog =
    (messageId
      ? await prisma.smsLog.findFirst({
          where: { providerMessageId: messageId },
          orderBy: { createdAt: "desc" },
        })
      : null) ?? null;

  if (!smsLog && recipient) {
    smsLog = await prisma.smsLog.findFirst({
      where: { to: recipient },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!smsLog) {
    log.warn({ event, messageId, recipient }, "No SmsLog matched event");
    return { tenantId: null, smsLogId: null };
  }

  const patch = smsPatch(event, occurredAt) ?? {};
  const data: Prisma.SmsLogUpdateInput = { ...patch };
  if (messageId && !smsLog.providerMessageId) {
    data.providerMessageId = messageId;
  }
  if (Object.keys(data).length > 0) {
    await prisma.smsLog.update({ where: { id: smsLog.id }, data });
  }

  return { tenantId: smsLog.tenantId, smsLogId: smsLog.id };
}

// Mark the most recent unconverted ReviewRequest for this customer as clicked.
async function markReviewRequestClicked(
  tenantId: string,
  customerId: string,
  at: Date
): Promise<void> {
  const rr = await prisma.reviewRequest.findFirst({
    where: { clicked: false, feedback: { tenantId, customerId } },
    orderBy: { sentAt: "desc" },
  });
  if (rr) {
    await prisma.reviewRequest.update({
      where: { id: rr.id },
      data: { clicked: true, clickedAt: at },
    });
  }
}

// SMS events carry no X-Mailin-custom; distinguish channel by event shape.
// Brevo SMS payloads include a `type: "transactional"` + sms-specific fields;
// the simplest robust signal is presence of `msisdn`/`to` without `subject`,
// or an explicit `?channel=sms` we set on the SMS webhook URL.
function isSmsEvent(e: Record<string, unknown>, forcedChannel: string | null): boolean {
  if (forcedChannel === "sms") return true;
  if (forcedChannel === "email") return false;
  return "msisdn" in e || (("to" in e) && !("subject" in e) && !("X-Mailin-custom" in e));
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // Public endpoint → rate limit aggressively by IP.
    const rl = await rateLimit(`brevo-webhook:${ip}`, 240, 60_000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    if (!tokenValid(request)) {
      log.warn({ ip }, "Brevo webhook rejected: bad or missing token");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const forcedChannel = request.nextUrl.searchParams.get("channel");
    const events = asEvents(parsed);
    let processed = 0;
    let duplicates = 0;

    for (const e of events) {
      const eventName = (str(e["event"]) ?? "unknown").toLowerCase();
      // Brevo timestamps: `ts` (epoch seconds) or `date`/`ts_event` strings.
      const tsRaw = e["ts"] ?? e["ts_event"] ?? e["date"];
      const occurredAt =
        typeof tsRaw === "number"
          ? new Date(tsRaw * 1000)
          : tsRaw
          ? new Date(String(tsRaw))
          : new Date();

      const sms = isSmsEvent(e, forcedChannel);
      const channel = sms ? "SMS" : "EMAIL";
      const messageId =
        str(e["message-id"]) ?? str(e["messageId"]) ?? "no-msgid";
      const recipient = sms
        ? str(e["to"]) ?? str(e["recipient"])
        : str(e["email"]);

      // Idempotency: Brevo has no event id, so derive a stable dedupe key.
      // Same message + same event + same second = same notification (retries).
      const dedupeKey = createHash("sha256")
        .update(
          `${channel}|${messageId}|${eventName}|${recipient ?? ""}|${Math.floor(
            occurredAt.getTime() / 1000
          )}`
        )
        .digest("hex");

      // Insert the marker FIRST (unique constraint). A retry loses the race,
      // gets P2002, and is skipped — same approach as the Stripe route.
      let created = true;
      try {
        await prisma.messageEvent.create({
          data: {
            channel,
            event: eventName,
            recipient,
            messageId: messageId === "no-msgid" ? null : messageId,
            dedupeKey,
            occurredAt,
            payload: JSON.parse(JSON.stringify(e)) as Prisma.InputJsonValue,
          },
        });
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code: string }).code === "P2002"
        ) {
          duplicates += 1;
          created = false;
        } else {
          throw err;
        }
      }
      if (!created) continue;

      // Apply the lifecycle update; if it throws, drop the marker so a Brevo
      // retry reprocesses (mirrors the Stripe rollback).
      try {
        let tenantId: string | null = null;
        let emailLogId: string | null = null;
        let smsLogId: string | null = null;

        if (sms) {
          ({ tenantId, smsLogId } = await handleSmsEvent(e, occurredAt));
        } else {
          ({ tenantId, emailLogId } = await handleEmailEvent(e, occurredAt));
        }

        // Backfill the marker with the resolved associations.
        await prisma.messageEvent.update({
          where: { dedupeKey },
          data: { tenantId, emailLogId, smsLogId },
        });

        // Meter the webhook call for usage/billing (best-effort).
        if (tenantId) {
          await meteringService
            .record(tenantId, "WEBHOOK_CALL", 1, {
              source: "brevo",
              event: eventName,
              channel,
            })
            .catch(() => {});
        }

        processed += 1;
      } catch (err) {
        await prisma.messageEvent
          .delete({ where: { dedupeKey } })
          .catch(() => {});
        throw err;
      }
    }

    return NextResponse.json({ received: true, processed, duplicates });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({ error: message }, "Brevo webhook processing error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
