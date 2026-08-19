import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe/client";
import { productKindFor, type ProductKind } from "@/lib/ai-monitor/watcher-entitlement";
import { reconcileTenantMatrixAccounts } from "@/lib/matrix-accounts";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/infrastructure/observability/logger";
import { resolvePlanFromPriceId } from "@/lib/stripe/prices";
import { quotaEnforcer } from "@/infrastructure/metering/quota";
import {
  cancelTrialEndingNotice,
  scheduleTrialEndingNotice,
} from "@/lib/billing/trial-notice";
import { handleCreditPackCompleted, isCreditPackSession } from "@/lib/billing/credit-webhook";

const log = logger.child({ module: "stripe-webhook" });

// The client comes from src/lib/stripe/client.ts now, not from a constructor
// here. This file used to build its own from the same env var, which meant the
// sandbox boot guard in that module (PORT=4501 must carry a sk_test_ key) had
// exactly one way around it — and the webhook is the last place that should be
// the exception, since it both reads and writes billing state.

// ─── Subscription status mapping ────────────────────────────────────────────

/**
 * Stripe's subscription status -> ours.
 *
 * IT CAN NEVER RETURN "NONE", AND THAT IS ENFORCED BY THIS SIGNATURE.
 *
 * NONE means "registered, never subscribed". Stripe has no such status — it
 * has no opinion about an account that never reached checkout — so there is no
 * input that could legitimately map to it. Spelling the four values out here
 * rather than writing `BillingStatus` is what makes that structural: a webhook
 * cannot demote a paying tenant to NONE, because the function every status
 * write flows through has no way to produce the value. The only writer of NONE
 * anywhere is the Tenant.billingStatus column default.
 *
 * The same reasoning is why Subscription.status is documented as never-NONE in
 * prisma/schema.prisma: this is the function that fills it.
 */
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
  // ── A TWO-WAY DISPATCH, AND THE EARLY RETURN IS LOAD-BEARING ────────────
  //
  // Everything below this branch assumes a session for a tenant that ALREADY
  // EXISTS, found by client_reference_id, and ends at:
  //
  //     if (subscriptionId ? productKind === "PLAN" : true)
  //       updateData.billingStatus = "ACTIVE";
  //
  // credit_pack has to return before that line: it carries no subscription, so
  // the ternary short-circuits to true and a $19 pack of lookups would set the
  // tenant ACTIVE. It must not reach the line because it would wrongly GRANT.
  // tests/credit-webhook.test.ts drives the real dispatcher rather than
  // re-implementing it, so this ordering is what is under test.
  //
  // THE guest_signup ARM IS GONE, along with the flow that produced it. The
  // funnel is register -> checkout again: every session this app creates now
  // carries a client_reference_id, because a tenant always exists before
  // Stripe is called. A session arriving here without one is what it was
  // before the inversion — something started outside this app — and is handled
  // by the warn-and-return below rather than by provisioning an account from
  // a payment. src/lib/billing/guest-signup.ts is now unreferenced; it is
  // removed in its own commit with the rest of that cluster.
  if (isCreditPackSession(session)) {
    await handleCreditPackCompleted(session);
    return;
  }

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

  // PLAN or WATCHER, resolved BEFORE the tenant is written.
  //
  // The sibling handler reads the lookup key off the subscription item, but a
  // checkout session carries no line-item price, so the subscription itself has
  // to be fetched — the same retrieve the trial notice below already needed,
  // now expanded and hoisted above the write rather than added to it.
  let subscription: Stripe.Subscription | null = null;
  let productKind: ProductKind | null = null;
  if (subscriptionId) {
    try {
      subscription = await getStripe().subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.price"],
      });
      const lookupKey = (
        subscription.items?.data?.[0]?.price as { lookup_key?: string | null } | undefined
      )?.lookup_key;
      productKind = productKindFor(lookupKey);
    } catch (err) {
      log.warn({ err, subscriptionId }, "Could not resolve product kind for checkout session");
    }
  }

  // A WATCHER PURCHASE DOES NOT ACTIVATE THE TENANT.
  //
  // hasPaidPlan falls back to this column when the tenant has no PLAN
  // subscription row — and at this point in the flow there is no row at all:
  // the row is written by customer.subscription.*, a separate event. Promoting
  // here unconditionally therefore handed a $9 add-on buyer every paid feature
  // in the product for the whole window between the two events, and
  // indefinitely whenever the second one is delayed, dropped or retried. It is
  // the same hole productKind was introduced to close, reached through the
  // handler that fires first.
  //
  // AN UNRESOLVED KIND FAILS CLOSED. If the retrieve above failed we do not
  // promote: customer.subscription.created follows for every real purchase and
  // sets billingStatus correctly there, so a plan customer activates a moment
  // later, whereas assuming PLAN grants a watcher buyer the run of the product
  // on the strength of a network error. A session with no subscription at all
  // is not a watcher — that SKU is subscription-only — so it keeps the old
  // behaviour.
  const updateData: Record<string, unknown> = {};
  if (subscriptionId ? productKind === "PLAN" : true) {
    updateData.billingStatus = "ACTIVE";
  }

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
  if (subscription) {
    try {
      await scheduleTrialEndingNotice({
        tenantId: tenant.id,
        stripeSubscriptionId: subscription.id,
        trialEnd: subscription.trial_end,
      });
    } catch (err) {
      // Never fail the webhook over the reminder: Stripe would retry the whole
      // event, and the subscription itself is already recorded.
      log.warn({ err, subscriptionId }, "Could not schedule trial-ending notice");
    }
  }

  log.info(
    { tenantId: tenant.id, customerId, subscriptionId, productKind },
    updateData.billingStatus
      ? "Checkout completed — tenant activated"
      : "Checkout completed — watcher purchase, tenant not activated"
  );
}

// ─── Tenant resolution for subscription events ──────────────────────────────

/**
 * Raised when an event WE created cannot be attached to a tenant.
 *
 * Thrown, not logged, so the route returns non-2xx and Stripe retries with
 * backoff. That is the escape hatch for the one ordering case metadata cannot
 * cover: a subscription created before tenantId was stamped (in flight during
 * the deploy that added it), whose tenant is identifiable only by a
 * stripeCustomerId that checkout.session.completed has not written yet. The
 * retry lands after that event and succeeds.
 */
class TenantNotResolvedError extends Error {
  constructor(customerId: string | undefined, subscriptionId: string) {
    super(
      `No tenant for subscription ${subscriptionId} (customer ${customerId ?? "unknown"}). ` +
        "Returning non-2xx so Stripe retries after checkout.session.completed lands.",
    );
    this.name = "TenantNotResolvedError";
  }
}

/**
 * Find the tenant a subscription belongs to, WITHOUT depending on event order.
 *
 * TWO ROUTES, IN THIS ORDER, AND THE ORDER IS THE FIX:
 *
 *   1. metadata.tenantId, stamped by /api/billing/checkout onto
 *      subscription_data.metadata. Present on the Subscription object itself, so
 *      it answers the question from the event in hand and needs nothing to have
 *      happened first.
 *   2. stripeCustomerId, as before. Still required: a subscription created in
 *      the Stripe dashboard or by the billing portal carries no metadata of
 *      ours, and by then the tenant has a customer id anyway.
 *
 * ── WHY AN UNRESOLVED EVENT IS NOT ALWAYS AN ERROR ─────────────────────────
 *
 * THE LIVE STRIPE ACCOUNT IS SHARED WITH SEVEN OR MORE OTHER PRODUCTS
 * (docs/agents/gotchas.md). A webhook endpoint receives every account event of
 * a subscribed type, so this handler is routinely handed subscriptions that
 * belong to AgoraIQ or AI Membership Hub and never had a tenant to find. Those
 * must keep returning 200: making "no tenant" a retryable failure would put
 * every foreign subscription event into a three-day retry loop and bury real
 * failures in the noise.
 *
 * So the two cases are separated by whether the subscription is OURS, which
 * metadata.app answers:
 *
 *   app === "echorank", no tenant  ->  THROW. Our event, genuinely unattached.
 *   no app marker,      no tenant  ->  warn + 200. Somebody else's product.
 *
 * A subscription that names a tenantId which no longer exists also returns 200:
 * the tenant was deleted, and no number of retries will bring it back.
 */
async function resolveSubscriptionTenant(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  const metadata = subscription.metadata ?? {};
  const stampedTenantId = metadata.tenantId;
  const isOurs = metadata.app === "echorank";

  if (stampedTenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: stampedTenantId } });
    if (tenant) return { tenant, customerId, resolvedBy: "metadata" as const };
    // Named a tenant that is gone. Retrying cannot help.
    log.warn(
      { subscriptionId: subscription.id, stampedTenantId, customerId },
      "Subscription names a tenant that no longer exists — not retrying",
    );
    return { tenant: null, customerId, resolvedBy: "none" as const };
  }

  if (customerId) {
    const tenant = await prisma.tenant.findFirst({ where: { stripeCustomerId: customerId } });
    if (tenant) return { tenant, customerId, resolvedBy: "customer" as const };
  }

  if (isOurs) {
    // Ours, unattached, and a retry can plausibly fix it. See the doc above.
    throw new TenantNotResolvedError(customerId, subscription.id);
  }

  log.warn(
    { subscriptionId: subscription.id, customerId },
    "No tenant for subscription and no echorank marker — foreign product, ignoring",
  );
  return { tenant: null, customerId, resolvedBy: "none" as const };
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // Order-independent: see resolveSubscriptionTenant. This used to look the
  // tenant up by stripeCustomerId alone, which is a column the SIBLING event
  // writes — so whichever event Stripe happened to deliver second decided
  // whether a paying customer got a Subscription row at all.
  const { tenant, customerId, resolvedBy } = await resolveSubscriptionTenant(subscription);
  if (!tenant) return;

  const billingStatus = mapStripeStatus(subscription.status);
  const firstItem = subscription.items?.data?.[0];
  const priceId = firstItem?.price?.id;
  // Prefer the DB price catalog (multi-currency, no code change to add prices);
  // fall back to the env-var mapping for backwards compatibility.
  const dbPlan = priceId ? await resolvePlanFromPriceId(priceId) : null;

  // PLAN or WATCHER, from the price's lookup key — ours and stable, unlike the
  // price id. A watcher subscription must never promote tenant.planType or
  // satisfy requirePaidPlan: Subscription.tenantId is unique, so it occupies
  // the same single row a tier would, and the `planType ?? tenant.planType`
  // fallback below would otherwise stamp it with whatever tier the tenant
  // already had.
  const lookupKey = (firstItem?.price as { lookup_key?: string | null } | undefined)?.lookup_key;
  const productKind = productKindFor(lookupKey);
  const isWatcher = productKind === "WATCHER";

  const planType = isWatcher ? null : (dbPlan?.planType ?? mapStripePlan(priceId));

  // Period dates live on the subscription item in current Stripe API versions
  const periodStart = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000)
    : null;
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000)
    : null;

  const tenantUpdate: Record<string, unknown> = {
    stripeSubscriptionId: subscription.id,
  };
  // WRITE THE CUSTOMER ID IF WE ARRIVED BY METADATA.
  //
  // Only checkout.session.completed used to persist this, so a tenant resolved
  // here by metadata — because this event won the race — would still have a null
  // stripeCustomerId. Every invoice handler below finds its tenant by that
  // column and by nothing else, so leaving it unwritten just moves the same race
  // onto invoice.payment_failed. Written here, the column exists as soon as
  // EITHER event lands, whichever that is.
  if (customerId && tenant.stripeCustomerId !== customerId) {
    tenantUpdate.stripeCustomerId = customerId;
  }
  // A watcher purchase does not move the tenant's billing status either. The
  // paid gate falls back to this column when the row is not a plan, so writing
  // ACTIVE here would reopen the hole one level down.
  if (!isWatcher) {
    tenantUpdate.billingStatus = billingStatus;
  }
  if (planType) {
    tenantUpdate.planType = planType;
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: tenantUpdate,
  });

  // WATCHER -> PLAN is a REPLACEMENT, not a second subscription.
  //
  // One row per tenant, so the upgrade flips this row. Stripe is cancelled
  // FIRST and the row flipped only if that succeeded: the reverse order leaves
  // a row saying PLAN while the old watcher subscription keeps charging, which
  // is a double bill the customer sees and we do not. Cancelling first can at
  // worst leave a cancelled watcher and an un-flipped row, which the next
  // webhook or a retry repairs.
  const existing = await prisma.subscription.findUnique({
    where: { tenantId: tenant.id },
    select: { productKind: true, stripeSubscriptionId: true },
  });
  if (
    !isWatcher &&
    existing?.productKind === "WATCHER" &&
    existing.stripeSubscriptionId &&
    existing.stripeSubscriptionId !== subscription.id
  ) {
    try {
      await getStripe().subscriptions.cancel(existing.stripeSubscriptionId);
      log.info({ tenantId: tenant.id }, "cancelled standalone watcher on plan upgrade");
    } catch (err) {
      // Already cancelled is fine; anything else must stop the flip.
      const message = err instanceof Error ? err.message : String(err);
      if (!/No such subscription|already canceled/i.test(message)) {
        log.error({ tenantId: tenant.id, err: message }, "watcher cancel failed; not flipping row");
        throw err;
      }
    }
  }

  // Upsert subscription record
  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {
      status: billingStatus,
      productKind,
      planType: planType ?? tenant.planType,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId ?? undefined,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    create: {
      tenantId: tenant.id,
      productKind,
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

  // Matrix chat is GROWTH+. A downgrade has to take the chat accounts with it,
  // or a cancelled customer keeps a working login on our homeserver forever.
  //
  // THIS RUNS AFTER the tenant row is already updated, and it is wrapped so it
  // can never throw: Stripe retries a webhook that returns non-2xx, and a
  // Synapse blip must not replay a plan change that has already been applied.
  // reconcileTenantMatrixAccounts logs and counts its own per-account
  // failures; reconcileMatrixAccounts() finishes the job by hand.
  if (planType) {
    try {
      const reconciled = await reconcileTenantMatrixAccounts(tenant.id, planType);
      if (reconciled.checked > 0) {
        log.info(
          {
            tenantId: tenant.id,
            planType,
            deactivated: reconciled.deactivated,
            failed: reconciled.failed,
          },
          "Matrix accounts reconciled after plan change"
        );
      }
    } catch (err) {
      log.error(
        { tenantId: tenant.id, planType, err: err instanceof Error ? err.name : typeof err },
        "Matrix reconcile threw — plan change stands, run reconcileMatrixAccounts()"
      );
    }
  }

  log.info(
    { tenantId: tenant.id, status: billingStatus, planType, resolvedBy },
    "Subscription updated"
  );
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Drop any queued 24h trial notice: there is no charge coming now, and a
  // warning about one would be worse than silence.
  await cancelTrialEndingNotice(subscription.id);

  // Same resolver as the update path: a cancellation must not be dropped just
  // because it arrived before the checkout event that would have written the
  // customer id.
  const { tenant } = await resolveSubscriptionTenant(subscription);
  if (!tenant) return;

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

// ─── Invoice handlers ───────────────────────────────────────────────────────
//
// THESE TWO STILL RESOLVE BY stripeCustomerId ALONE, AND THAT IS SOUND HERE.
//
// An Invoice does not carry our subscription metadata inline, so giving them the
// resolver above would mean an extra Stripe API call on every invoice event to
// fetch the subscription. It buys nothing: both handlers only ever adjust a
// tenant BETWEEN paid states — one clears PAST_DUE, the other sets it — and a
// tenant with no stripeCustomerId has not completed a checkout, so it has no
// paid state to move and nothing to correct. The race that mattered was the one
// that skipped writing a row; there is no row to miss here.
//
// The customer id is now written by whichever of the two subscription events
// lands first (see tenantUpdate above), which shortens even this window.
/**
 * PAST_DUE -> ACTIVE when an invoice is paid.
 *
 * ── DRIVEN BY TWO EVENT TYPES, DELIBERATELY ─────────────────────────────────
 *
 * Stripe sends BOTH `invoice.paid` and `invoice.payment_succeeded` for the same
 * successful invoice. Only the latter was in the switch, while the sandbox
 * destination was subscribed to only the former — so this recovery had never
 * once been reachable in that environment: every payment fell through to
 * `default:` and logged as an unhandled type. Handling both makes the code
 * indifferent to which of the two a given destination happens to be configured
 * with, which matters because there are two destinations (sandbox, and a live
 * endpoint not yet created) ticked off by hand at different times.
 *
 * ── WHY HANDLING BOTH IS SAFE WITHOUT NEW MACHINERY ─────────────────────────
 *
 * The route's idempotency marker is keyed on event id, and these are two
 * DIFFERENT events, so both reach this function. What makes the second one a
 * no-op is the `=== "PAST_DUE"` guard below, which was already here: the first
 * delivery moves the tenant to ACTIVE, the second reads ACTIVE, fails the guard,
 * and returns without a write and without a log line. That is idempotence by
 * construction rather than by a flag, and it is the reason this needed no
 * dedupe layer added on top.
 *
 * Note for anyone tightening this later: a $0 invoice (a proration credit, a
 * fully discounted period) also fires these events, so it can clear PAST_DUE
 * without money arriving. That is pre-existing behaviour of the
 * `payment_succeeded` path and is unchanged here, not introduced by it.
 */
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

        // `created` shares the handler, which is an idempotent upsert.
        //
        // It was previously unhandled, so the Subscription row — and with it
        // productKind — appeared only when Stripe next sent `updated`, which
        // for a subscription that never changes may be the first renewal. That
        // left the checkout/subscription window above open for far longer than
        // the moment it looks like, which is why it is worth closing here
        // rather than relying on a follow-up event that may not come.
        case "customer.subscription.created":
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

        // Both, sharing one handler. Stripe emits the pair for a single paid
        // invoice; the handler's PAST_DUE guard makes the second delivery a
        // no-op. `invoice.paid` is what the sandbox destination was already
        // sending, and its absence here is why the recovery never ran.
        case "invoice.paid":
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
