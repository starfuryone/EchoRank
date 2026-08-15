// src/lib/billing/credit-webhook.ts
//
// What a completed credit-pack checkout does.
//
// ── WHY THIS IS NOT IN THE ROUTE FILE ───────────────────────────────────────
// Next's App Router validates the export surface of a `route.ts`: exporting a
// handler function beside POST fails the build. This is the logic the webhook's
// credit branch calls, in a module a test can import — and the branch ordering
// in the route stays trivially reviewable as a result.
//
// ── IT RUNS BEFORE ANY SUBSCRIPTION LOGIC, AND THAT ORDER IS THE POINT ──────
// handleCheckoutCompleted decides whether to activate a tenant with:
//
//     if (subscriptionId ? productKind === "PLAN" : true)
//
// A one-time payment session carries NO subscription, so `subscriptionId` is
// undefined, the ternary short-circuits to `true`, and the tenant is set
// billingStatus = "ACTIVE" — a $19 pack of prospect lookups silently granting
// every paid feature in the product. The route therefore returns after calling
// this rather than adding a condition to that line, and
// tests/credit-webhook.test.ts asserts a mode=payment session never touches
// billingStatus.
//
// ── TWO IDEMPOTENCY LAYERS, BOTH LOAD-BEARING ───────────────────────────────
// ProcessedWebhook.stripeEventId is the first, but the dispatcher DELETES that
// marker when a handler throws so Stripe's retry re-runs the event — which is
// exactly the window in which a partially-applied credit could be applied
// twice. The (tenantId, reason, ref) unique on CreditLedger closes it: `ref` is
// the session id, so the second write is refused by the database no matter how
// many times this runs. recordPurchase reports whether it was the one that
// landed, and the notification only fires when it was.
//
// ── THE CREDIT COUNT COMES FROM THE PRICE, NOT THE METADATA ─────────────────
// The session's metadata carries `credits`, but metadata is set by whoever
// created the session. The authoritative number is the lookup key on the line
// item, resolved against our own catalogue: a session for a price we do not
// sell credits nothing, whatever its metadata claims.

import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe/client";
import { logger } from "@/infrastructure/observability/logger";
import { packForLookupKey } from "@/lib/credit-packs";
import { recordPurchase } from "@/lib/credits/store";
import { notifyCreditsPurchased } from "@/lib/notifications/adapters";

const log = logger.child({ module: "credit-webhook" });

/** True for a session this module owns. The route branches on it. */
export function isCreditPackSession(session: Stripe.Checkout.Session): boolean {
  return session.mode === "payment" || session.metadata?.flow === "credit_pack";
}

export async function handleCreditPackCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const tenantId = session.client_reference_id ?? session.metadata?.tenantId ?? null;
  if (!tenantId) {
    log.warn({ sessionId: session.id }, "credit pack session with no tenant reference — ignored");
    return;
  }

  // Paid, and only paid. Stripe can complete a session whose payment is still
  // processing (delayed methods); crediting on that would hand out lookups for
  // money that has not cleared.
  if (session.payment_status !== "paid") {
    log.info(
      { sessionId: session.id, tenantId, paymentStatus: session.payment_status },
      "credit pack session not paid yet — nothing credited",
    );
    return;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });
  if (!tenant) {
    log.warn({ sessionId: session.id, tenantId }, "credit pack for a tenant that does not exist");
    return;
  }

  let pack: ReturnType<typeof packForLookupKey> = null;
  try {
    const items = await getStripe().checkout.sessions.listLineItems(session.id, {
      limit: 1,
      expand: ["data.price"],
    });
    const lookupKey = (items.data[0]?.price as { lookup_key?: string | null } | undefined)
      ?.lookup_key;
    pack = lookupKey ? packForLookupKey(lookupKey) : null;
  } catch (err) {
    // Rethrown, not swallowed: the dispatcher rolls the idempotency marker back
    // and Stripe retries. A network blip must not cost the customer their
    // credits, and this is the one failure here that is genuinely transient.
    log.error({ err, sessionId: session.id, tenantId }, "could not read credit pack line items");
    throw err;
  }

  if (!pack) {
    log.warn(
      { sessionId: session.id, tenantId, metadataCredits: session.metadata?.credits },
      "credit pack session for a price we do not sell — nothing credited",
    );
    return;
  }

  const { applied, balance } = await recordPurchase({
    tenantId,
    credits: pack.credits,
    sessionId: session.id,
  });

  // A replay credited nothing, so it announces nothing.
  if (!applied) return;

  await notifyCreditsPurchased({ tenantId, credits: pack.credits, balance });

  log.info(
    { sessionId: session.id, tenantId, credits: pack.credits, balance },
    "credit pack purchased",
  );
}
