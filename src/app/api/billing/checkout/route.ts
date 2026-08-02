// POST /api/billing/checkout — create a Stripe Checkout Session.
//
// ANONYMOUS CHECKOUT IS ALLOWED. The trial takes no card, so requiring an
// account before the trial starts would put the signup wall in front of the
// thing that is supposed to remove it. Signed-in visitors are stamped with
// client_reference_id (tenantId) so the webhook can reconcile; anonymous ones
// are reconciled by email when they later register. See the note in
// src/app/api/webhooks/route.ts.
//
// Prices are NOT defined here. The eight lookup keys already exist in Stripe
// and are resolved live — this app never creates or edits a price, and there
// is deliberately no second hardcoded price list (src/lib/seo/constants.ts
// drifted that way once and is now guarded by tests/seo-jsonld.test.ts).

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import {
  checkoutLookupKey,
  isBillingInterval,
  isCheckoutTier,
} from "@/lib/stripe/lookup-keys";
import { getCurrentTenant } from "@/lib/tenant";
import { auth } from "@/lib/auth";
import { logger } from "@/infrastructure/observability/logger";
import { SITE_URL, normalizeLocale } from "@/lib/seo";

const log = logger.child({ module: "billing-checkout" });

/** Trial length. Single source — see TRIAL_DAYS in src/lib/plan-config.ts. */
import { TRIAL_DAYS } from "@/lib/plan-config";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { tier, interval, locale } = (body ?? {}) as {
    tier?: unknown;
    interval?: unknown;
    locale?: unknown;
  };

  // Enterprise is rejected by the type guard as well as by name: it is custom
  // priced, has no lookup key, and must stay a "contact us" conversation.
  if (tier === "enterprise") {
    return NextResponse.json(
      { error: "Enterprise is custom priced. Contact us instead." },
      { status: 400 },
    );
  }
  if (!isCheckoutTier(tier)) {
    return NextResponse.json({ error: "Unknown tier." }, { status: 400 });
  }
  if (!isBillingInterval(interval)) {
    return NextResponse.json({ error: "Interval must be month or year." }, { status: 400 });
  }

  const lookupKey = checkoutLookupKey(tier, interval);
  const loc = normalizeLocale(typeof locale === "string" ? locale : "en");

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    // Missing key is a deploy fault, not a client error.
    log.error("STRIPE_SECRET_KEY is not configured");
    return NextResponse.json({ error: "Billing is not configured." }, { status: 500 });
  }

  // Resolve the price live. A missing key means the catalog and the code
  // disagree, which is a 404 rather than a silent fallback to another price.
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const price = prices.data[0];
  if (!price) {
    log.error({ lookupKey }, "No active Stripe price for lookup key");
    return NextResponse.json({ error: "That plan is not available." }, { status: 404 });
  }

  // Signed-in visitors get their tenant stamped on the session. Anonymous ones
  // are fine — getCurrentTenant returns null and we simply omit the linkage.
  let tenantId: string | null = null;
  let customerId: string | null = null;
  let customerEmail: string | null = null;
  try {
    const [membership, session] = await Promise.all([getCurrentTenant(), auth()]);
    if (membership) {
      tenantId = membership.tenant.id;
      customerId = membership.tenant.stripeCustomerId ?? null;
    }
    // The email comes from the session: getCurrentTenant returns the membership
    // and its tenant, not the user.
    customerEmail = session?.user?.email ?? null;
  } catch {
    // Never block checkout on a session lookup problem.
    log.warn("Session lookup failed during checkout; continuing anonymously");
  }

  const base = `${SITE_URL}/${loc}`;
  const metadata = { app: "echorank", tier, interval };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      // The trial takes no card. Collecting one anyway is the single biggest
      // drop-off in a no-card-required funnel.
      payment_method_collection: "if_required",
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        metadata,
      },
      metadata,
      // client_reference_id is how the webhook links a session to a tenant
      // that has no Stripe customer yet — which is every tenant today, since
      // no checkout has ever run in this app.
      ...(tenantId ? { client_reference_id: tenantId } : {}),
      ...(customerId
        ? { customer: customerId }
        : customerEmail
          ? { customer_email: customerEmail }
          : {}),
      success_url: `${base}/welcome?s={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}#pricing`,
    });

    if (!session.url) {
      log.error({ sessionId: session.id }, "Checkout session created without a url");
      return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
    }

    log.info({ tier, interval, tenantId, sessionId: session.id }, "Checkout session created");
    return NextResponse.json({ url: session.url });
  } catch (err) {
    log.error({ err, tier, interval }, "Stripe checkout session creation failed");
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }
}
