import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/infrastructure/observability/logger";

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
    default:
      return "ACTIVE";
  }
}

function mapStripePlan(
  priceId: string | null | undefined
): "STARTER" | "GROWTH" | "AGENCY" | "ENTERPRISE" | null {
  if (!priceId) return null;
  const mapping: Record<string, "STARTER" | "GROWTH" | "AGENCY" | "ENTERPRISE"> = {
    [process.env.STRIPE_PRICE_STARTER ?? ""]: "STARTER",
    [process.env.STRIPE_PRICE_GROWTH ?? ""]: "GROWTH",
    [process.env.STRIPE_PRICE_AGENCY ?? ""]: "AGENCY",
    [process.env.STRIPE_PRICE_ENTERPRISE ?? ""]: "ENTERPRISE",
  };
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

  if (!customerId) {
    log.warn({ sessionId: session.id }, "Checkout session missing customer");
    return;
  }

  const tenant = await prisma.tenant.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!tenant) {
    log.warn({ customerId }, "No tenant found for Stripe customer");
    return;
  }

  const updateData: Record<string, unknown> = {
    billingStatus: "ACTIVE",
  };

  if (subscriptionId) {
    updateData.stripeSubscriptionId = subscriptionId;
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: updateData,
  });

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
  const planType = mapStripePlan(priceId);

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

  log.info(
    { tenantId: tenant.id, status: billingStatus, planType },
    "Subscription updated"
  );
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
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

    // Idempotency: check if we already processed this event
    const existing = await prisma.processedWebhook.findUnique({
      where: { stripeEventId: event.id },
    });

    if (existing) {
      log.info(
        { eventId: event.id, eventType: event.type },
        "Duplicate webhook event — skipping"
      );
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Route to the appropriate handler
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

    // Record the processed webhook for idempotency
    await prisma.processedWebhook.create({
      data: {
        stripeEventId: event.id,
        eventType: event.type,
        payload: JSON.parse(JSON.stringify(event.data.object)) as Record<string, string | number | boolean | null>,
      },
    });

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
