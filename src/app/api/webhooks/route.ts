import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/infrastructure/observability/logger";
import { resolvePlanFromPriceId } from "@/lib/stripe/prices";
import { quotaEnforcer } from "@/infrastructure/metering/quota";
import {
  cancelTrialEndingNotice,
  scheduleTrialEndingNotice,
} from "@/lib/billing/trial-notice";

const log = logger.child({ module: "stripe-webhook" });

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key);
}

// ─── Subscription status mapping ────────────────────────────────────────────

function mapStripeStatus(
  status: string
): "ACTIVE" | "PAST_DUE" | "CANCELED" | "TRIALING" {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "CANCELED";
    case "trialing":
      return "TRIALING";
    case "incomplete":
    case "paused":
      return "PAST_DUE";
    default:
      // Never default to ACTIVE: an unknown/unpaid status (e.g. a freshly
      // created but never-paid subscription) must not activate the tenant.
      // PAST_DUE is the safe, access-denying state.
      return "PAST_DUE";
  }
}

function mapStripePlan(
  priceId: string | null | undefined
): "STARTER" | "GROWTH" | "AGENCY" | "ENTERPRISE" | null {
  if (!priceId) return null;
  const mapping: Record<string, "STARTER" | "GROWTH" | "AGENCY" | "ENTERPRISE"> = {};
  // Accept BOTH naming conventions so the mapping works regardless of which
  // names are present in the runtime .env:
  //   STRIPE_<PLAN>_PRICE_ID  (documented in .env.example)
  //   STRIPE_PRICE_<PLAN>     (original code)
  const registerPlan = (
    plan: "STARTER" | "GROWTH" | "AGENCY" | "ENTERPRISE",
    ...ids: Array<string | undefined>
  ) => {
    for (const id of ids) {
      if (id) mapping[id] = plan;
    }
  };
  registerPlan("STARTER", process.env.STRIPE_STARTER_PRICE_ID, process.env.STRIPE_PRICE_STARTER);
  registerPlan("GROWTH", process.env.STRIPE_GROWTH_PRICE_ID, process.env.STRIPE_PRICE_GROWTH);
  registerPlan("AGENCY", process.env.STRIPE_AGENCY_PRICE_ID, process.env.STRIPE_PRICE_AGENCY);
  registerPlan("ENTERPRISE", process.env.STRIPE_ENTERPRISE_PRICE_ID, process.env.STRIPE_PRICE_ENTERPRISE);
  return mapping[priceId] ?? null;
}

// ─── Event handlers ─────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  // Resolve the tenant by client_reference_id FIRST, then by customer id.
  //
  // Looking up by stripeCustomerId alone only works for a tenant that already
  // has one — which no tenant does until a checkout has completed, so on its
  // own it never matches the first time and billing silently never activates.
  // /api/billing/checkout stamps client_reference_id with the tenant id
  // precisely so this handler can close that loop.
  const tenant = session.client_reference_id
    ? await prisma.tenant.findUnique({ where: { id: session.client_reference_id } })
    : customerId
      ? await prisma.tenant.findFirst({ where: { stripeCustomerId: customerId } })
      : null;

  if (!tenant) {
    // Our checkout route requires an account and always stamps
    // client_reference_id, so this should not happen for sessions we created.
    // It still can for a session started elsewhere (a payment link, the Stripe
    // dashboard), which is why it warns and returns rather than throwing —
    // there is simply no tenant to attach to.
    log.warn(
      {
        sessionId: session.id,
        customerId,
        email: session.customer_details?.email ?? session.customer_email ?? null,
      },
      "Checkout completed with no tenant to attach — session not created by this app",
    );
    return;
  }

  const updateData: Record<string, unknown> = {
    billingStatus: "ACTIVE",
  };

  // Persist the customer id when we matched by client_reference_id, otherwise
  // the next event has nothing to match on and we are back to the same gap.
  if (customerId && tenant.stripeCustomerId !== customerId) {
    updateData.stripeCustomerId = customerId;
  }

  if (subscriptionId) {
    updateData.stripeSubscriptionId = subscriptionId;
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: updateData,
  });

  // 24h trial-ending notice. Stripe's own trial_will_end fires 3 days out, so
  // the exact timing has to come from trial_end on the subscription itself.
  if (subscriptionId) {
    try {
      const sub = await getStripe().subscriptions.retrieve(subscriptionId);
      await scheduleTrialEndingNotice({
        tenantId: tenant.id,
        stripeSubscriptionId: subscriptionId,
        trialEnd: sub.trial_end,
      });
    } catch (err) {
      // Never fail the webhook over the reminder: Stripe would retry the whole
      // event, and the subscription itself is already recorded.
      log.warn({ err, subscriptionId }, "Could not schedule trial-ending notice");
    }
  }

  log.info(
    { tenantId: tenant.id, customerId, subscriptionId },
    "Checkout completed — tenant activated"
  );
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) return;

  const tenant = await prisma.tenant.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!tenant) {
    log.warn({ customerId }, "No tenant found for subscription update");
    return;
  }

  const billingStatus = mapStripeStatus(subscription.status);
  const firstItem = subscription.items?.data?.[0];
  const priceId = firstItem?.price?.id;
  // Prefer the DB price catalog (multi-currency, no code change to add prices);
  // fall back to the env-var mapping for backwards compatibility.
  const dbPlan = priceId ? await resolvePlanFromPriceId(priceId) : null;
  const planType = dbPlan?.planType ?? mapStripePlan(priceId);

  // Period dates live on the subscription item in current Stripe API versions
  const periodStart = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000)
    : null;
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000)
    : null;

  const tenantUpdate: Record<string, unknown> = {
    billingStatus,
    stripeSubscriptionId: subscription.id,
  };
  if (planType) {
    tenantUpdate.planType = planType;
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: tenantUpdate,
  });

  // Upsert subscription record
  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {
      status: billingStatus,
      planType: planType ?? tenant.planType,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId ?? undefined,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    create: {
      tenantId: tenant.id,
      planType: planType ?? tenant.planType,
      status: billingStatus,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId ?? undefined,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });

  // Re-provision quota limits to match the (possibly changed) plan, so quota
  // enforcement tracks the tier the customer is actually paying for.
  if (planType) {
    await quotaEnforcer.setQuota(
      tenant.id,
      quotaEnforcer.getDefaultQuotas(planType)
    );
  }

  log.info(
    { tenantId: tenant.id, status: billingStatus, planType },
    "Subscription updated"
  );
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Drop any queued 24h trial notice: there is no charge coming now, and a
  // warning about one would be worse than silence.
  await cancelTrialEndingNotice(subscription.id);

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!customerId) return;

  const tenant = await prisma.tenant.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!tenant) {
    log.warn({ customerId }, "No tenant found for subscription deletion");
    return;
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { billingStatus: "CANCELED" },
  });

  await prisma.subscription.updateMany({
    where: { tenantId: tenant.id, stripeSubscriptionId: subscription.id },
    data: { status: "CANCELED" },
  });

  log.info({ tenantId: tenant.id }, "Subscription canceled");
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) return;

  const tenant = await prisma.tenant.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!tenant) return;

  // If the tenant was past_due, re-activate
  if (tenant.billingStatus === "PAST_DUE") {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { billingStatus: "ACTIVE" },
    });

    log.info({ tenantId: tenant.id }, "Invoice paid — tenant re-activated");
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) return;

  const tenant = await prisma.tenant.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!tenant) return;

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { billingStatus: "PAST_DUE" },
  });

  log.warn(
    { tenantId: tenant.id, invoiceId: invoice.id },
    "Invoice payment failed — tenant set to PAST_DUE"
  );
}

// ─── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const rl = await rateLimit(`webhook:${ip}`, 100, 60_000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Verify webhook secret is configured
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      log.error("STRIPE_WEBHOOK_SECRET is not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    // Read raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      log.warn({ ip }, "Missing stripe-signature header");
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    // Verify Stripe signature
    let event: Stripe.Event;
    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn({ ip, error: message }, "Invalid Stripe signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // Idempotency: insert the marker FIRST, guarded by the unique constraint on
    // stripeEventId. This is atomic — two concurrent retries of the same event
    // race on the insert and exactly one wins; the loser gets P2002 and is
    // treated as a duplicate. (The previous findUnique-then-create left a window
    // where both retries passed the check and both ran the handler.)
    try {
      await prisma.processedWebhook.create({
        data: {
          stripeEventId: event.id,
          eventType: event.type,
          payload: JSON.parse(
            JSON.stringify(event.data.object)
          ) as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        log.info(
          { eventId: event.id, eventType: event.type },
          "Duplicate webhook event — skipping"
        );
        return NextResponse.json({ received: true, duplicate: true });
      }
      throw err;
    }

    // Route to the appropriate handler. If it throws, delete the idempotency
    // marker so Stripe's retry reprocesses the event (otherwise the marker we
    // just wrote would make the retry a no-op and the event would be lost).
    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(
            event.data.object as Stripe.Checkout.Session
          );
          break;

        case "customer.subscription.updated":
          await handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription
          );
          break;

        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription
          );
          break;

        // Logged only. Stripe fires this 3 days out; the 24h notice customers
        // actually get is the delayed trial-notice job scheduled at checkout.
        case "customer.subscription.trial_will_end": {
          const sub = event.data.object as Stripe.Subscription;
          log.info(
            {
              subscriptionId: sub.id,
              customerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
              trialEnd: sub.trial_end,
            },
            "Stripe trial_will_end (3-day) — informational; 24h notice is queued separately"
          );
          break;
        }

        case "invoice.payment_succeeded":
          await handleInvoicePaymentSucceeded(
            event.data.object as Stripe.Invoice
          );
          break;

        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          log.debug({ eventType: event.type }, "Unhandled Stripe event type");
          break;
      }
    } catch (err) {
      await prisma.processedWebhook
        .delete({ where: { stripeEventId: event.id } })
        .catch(() => {
          // best-effort rollback of the idempotency marker
        });
      throw err;
    }

    log.info(
      { eventId: event.id, eventType: event.type },
      "Webhook processed successfully"
    );

    return NextResponse.json({
      received: true,
      eventId: event.id,
      eventType: event.type,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({ error: message }, "Webhook processing error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
